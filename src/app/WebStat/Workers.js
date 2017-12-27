
const Common = require("../Common");
const PackArray = require("../PackArray");
const WebStatBase = require("./WebStatBase");

class Workers extends WebStatBase {
	constructor(events) {
		super(events);
	
		this.workers = {};
		this.workersArchive = new PackArray(1024*1024);
		
		events.on("web:server:connect_web_socket", (socket) => {
			this._workerUpdate();

			this.webEmit("workersArchive", this.workersArchive.getData(), socket);
			this.webEmit("workers", Common.objToArray(this.workers), socket);
		});		
		
		events.on("stratum:server:worker:connect"      , this.workerConnect      .bind(this));
		events.on("stratum:server:worker:login"        , this.workerLogin        .bind(this));
		events.on("stratum:server:worker:disconnect"   , this.workerDisconnect   .bind(this));
		events.on("stratum:server:worker:accepted_job" , this.workerAcceptedJob  .bind(this));
		events.on("stratum:server:worker:virtual_share", this.workerVirtualShare .bind(this));
		events.on("stratum:client:accepted_share"      , this.workerAcceptedShare.bind(this));
		events.on("stratum:client:rejected_share"      , this.workerRejectedShare.bind(this));
		events.on("stratum:proxy:pool_add_worker"      , this.workerPoolAddWorker.bind(this));
		events.on("stratum:proxy:pool_del_worker"      , this.workerPoolDelWorker.bind(this));
		
		
	}
	
	_workerUpdate(id) {
		if ( !id ) {
			for(let i in this.workers) {
				this._workerUpdate(i);
			}
			return;
		}
		
		let worker = this.workers[id];
		if ( !worker ) { return; }
		
		if ( worker.alive ) {
			worker.time_in_work = Common.currTimeMiliSec() - worker.connection_time;
		}
	}
	_workerUpdateMini(id, info) {
		let data = [
			id, 
			info.difficulty,
			info.accepted_job_count,
			info.accepted_share_count,
			info.rejected_share_count,
			info.hash_count,
			info.share_count,
			info.hashrate,
			info.pool_id
		];
		//console.log("Update mini worker", data)
		this.webEmit("worker_info_mini", data);		
	}
	workerConnect(origWorker) {
		let worker = this.workers[origWorker.id] = {
			id  : origWorker.id,
			
			agent         : origWorker.agent,
			address       : origWorker.address,
			pool_password : origWorker.pool_password,
			wallet_address: origWorker.wallet_address,
			
			pool_id: 0,
			
			time_in_work: 0,
			connection_time: Common.currTimeMiliSec(),
			disconnection_time: null,
			
			difficulty: null,
			
			worker_count: 0,
			accepted_job_count  : 0,
			accepted_share_count: 0,
			rejected_share_count: 0,
			
			hash_count: 0,
			share_count: 0,

			hashrate: {},
			
			disconnection_error: "",
			
			ping: null,
			
			alive: true,
		};

		this.workerLogin(worker);
	}
	workerLogin(origWorker) {
		let worker = this.workers[origWorker.id]; if ( !worker ) { return; }

		worker.agent         = origWorker.agent;
		worker.address       = origWorker.address;
		worker.pool_password = origWorker.pool_password;
		worker.wallet_address= origWorker.wallet_address;

		worker.time_in_work = 0;
		worker.connection_time = Common.currTimeMiliSec();
		worker.disconnection_time = null;
					
		worker.difficulty = null;
					
		worker.worker_count = 0;
		worker.accepted_job_count   = 0;
		worker.accepted_share_count = 0;
		worker.rejected_share_count = 0;
					
		worker.hash_count = 0;
		worker.share_count = 0;

		worker.hashrate = {};
					
		worker.disconnection_error = "";
					
		worker.ping = null;
					
		worker.alive = true;
		
		this.webEmit("workers", [worker]);
	}
	workerDisconnect(origWorker, msg) {
		let worker = this.workers[origWorker.id]; if ( !worker ) { return; }
		
		worker.disconnection_time = Common.currTimeMiliSec();
		worker.time_in_work = worker.disconnection_time - worker.connection_time;
		worker.disconnection_error = msg || "";
		worker.alive = false;

		this.webEmit("workers", [worker]);
		
		this.workersArchive.write("worker", worker);
		
		delete this.workers[worker.id];
	}
	workerAcceptedJob(origWorker, job) {
		let worker = this.workers[origWorker.id]; if ( !worker ) { return; }
		
		worker.accepted_job_count++;
		worker.difficulty = origWorker.difficulty;
		
		this._workerUpdateMini(worker.id, {
			accepted_job_count: worker.accepted_job_count, 
			difficulty: worker.difficulty
		});
	}
	workerVirtualShare(origWorker, share) {
		let worker = this.workers[origWorker.id]; if ( !worker ) { return; }
		 
		worker.hash_count = origWorker.hashes;
		worker.share_count = origWorker.shares;
		worker.difficulty = origWorker.difficulty;
		
		let hashrate = origWorker.hashRate.getHashRate([5, 10, 15, 30, 60, "all"]);
		hashrate["current"] = origWorker.hashRateLast.getHashRate();
		worker.hashrate = hashrate;
		
		this._workerUpdateMini(worker.id, {
			hash_count: worker.hash_count,
			share_count: worker.share_count,
			hashrate: hashrate,
		});
	}
	workerAcceptedShare(origPool, share) {
		//console.log('share', share)
		if ( !share.worker_id ) { return; }
		let worker = this.workers[share.worker_id]; if ( !worker ) { return; }
		
		worker.accepted_share_count++;
		
		this._workerUpdateMini(worker.id, {
			accepted_share_count: worker.accepted_share_count,
		});
	}
	workerRejectedShare(origPool, share) {
		if ( !share.worker_id ) { return; }
		let worker = this.workers[share.worker_id]; if ( !worker ) { return; }
		
		worker.rejected_share_count++;
		
		this._workerUpdateMini(worker.id, {
			rejected_share_count: worker.rejected_share_count,
		});
	}
	workerPoolAddWorker(origPool, origWorker) {
		let worker = this.workers[origWorker.id]; if ( !worker ) { return; }
		
		worker.pool_id = origPool.id;
		
		this._workerUpdateMini(worker.id, {pool_id: worker.pool_id});
	}
	workerPoolDelWorker(origPool, origWorker) {
		let worker = this.workers[origWorker.id]; if ( !worker ) { return; }
		
		worker.pool_id = 0;
		
		this._workerUpdateMini(worker.id, {pool_id: worker.pool_id});
	}

}

module.exports = Workers;
