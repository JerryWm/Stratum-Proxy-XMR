
const EventEmitter = require("events").EventEmitter;

const Logger = require("./Logger");
const Common = require("./Common");
const WebServer = require("./WebServer");
const StratumConfig = require("./StratumConfig");
const StratumCommon = require("./StratumCommon");
const StratumClient = require("./StratumClient");
const StratumServer = require("./StratumServer");


const STRATUM_PROXY_SERVER_RECONNECT_INTERVAL = 5e3;
const STRATUM_PROXY_CLIENT_RECONNECT_INTERVAL = 5e3;
const HTTP_SERVER_RECONNECT_INTERVAL = 5e3;

const STRATUM_LOOP_CONNECT_POOL_TIMEOUT = 5e3;

/**

stratumClient
	out:
		newJob
		ping
		acceptedShare
		rejectedShare
		
	in:
		submitResultJob

stratumServer
	out:
		workerConnect
		workerDisconnect
		workerLogin
		workerShare
		
		workerInfo
		workerDiff
		workerHashrate
		
		worker
	in:
		newJob
		
*/

let MAX_WORKERS = 100;

class JobMng {
	constructor(job) {
		this.job = job;
		let blob = job.blob;

		let ofs = 0;
		this.part1 = blob.substr(0, 39*2);
		ofs += 39*2;
		this.nonce3byte = blob.substr(ofs, 6); ofs += 6;
		this.nonce1byte = blob.substr(ofs, 2); ofs += 2;
		this.part2 = blob.substr(ofs);
		
		this.nonce3byte = Common.hexToUint32(this.nonce3byte + "00") | 0;
		this.nonce1byte = parseInt(this.nonce1byte) | 0;
		
		this.seq = 0;
	}
	
	getNonceHex() {
		return Common.uint32ToHex(this.nonce3byte).substr(0, 6) + Common.uint32ToHex(this.nonce1byte).substr(0, 2);
	}
	
	getJob() {
		this.seq++;
		
		//console.log("`~`this.getNonceHex(): " + this.getNonceHex());
		
		return {
			job_id: this.job.job_id,
			target: this.job.target,
			blob  : this.part1 + this.getNonceHex() + this.part2
		};
	}
}

class WrapperPool {
	constructor(id, pool, options) {
		this.id = id;
		this.pool = pool;
		
		this.options = options;
		
		this.workersCount = 0;
		this.workers = {};
		
		this.jobSeq = 0;
		this.blob_nonce = 0;
		this.job = null;
		
		this.jobMng = null;
	}
	
	clear() {
		this.workersCount = 0;
		this.workers = {};
	}
	
	addWorker(id, worker) {
		if ( this.workersCount >= this.options.maxWorkersCount ) {
			return false;
		}

		this.workers[id] = worker;
		this.workersCount++;
		
		return true;
	}
	delWorker(id) {
		delete this.workers[id];
		this.workersCount--;
	}
	
	newJob(job) {		
		if ( job ) {
			this.job = job;
			this.jobMng = new JobMng(job);
			
			this.jobMng.nonce3byte = 0;
			if ( this.options.emu_nicehash ) {
				this.jobMng.nonce1byte = 0;
			}
		
			for(let i in this.workers) {
				this.workers[i].worker.updateJob();
			}
		}
	}
	resultJob(resultJob) {
		if ( !this.job || !resultJob ) {
			return;
		}
		
		if ( resultJob.job_id === this.job.job_id ) {
			this.pool.submitJob(resultJob);
		}
	}
	
	getJob() {
		if ( !this.jobMng ) {
			return null;
		}
		
		if ( this.jobMng.seq >= this.options.maxWorkersCount ) {
			return null;
		}
		
		let job = this.jobMng.getJob();
		
		if ( this.options.emu_nicehash ) {
			this.jobMng.nonce1byte++;
		} else {
			this.jobMng.nonce3byte += ((1<<24) - 1) / (this.options.maxWorkersCount+1);
		}
		
		return job;
	}
}

class WrapperWorker {
	constructor(id, worker) {
		this.id = id;
		this.worker = worker;
		this.pool = null;
	}
	
	addPool(pool) {
		this.pool = pool;
	}
	
	setWorker(worker) {
		this.worker = worker;
	}
}

/**
	onConnectPool
*/
class StratumProxy {
	constructor(options, pool_connect_info, events, logger) {
		this.logger = new Logger(logger, "STRATUM-PROXY");

		this.prefix = "stratum:proxy:";

		this.options = options;
		
		this.pool_connect_info = pool_connect_info;
		
		this.stratumClient = null;
		this.stratumServer = null;

		this.maxWorkersCount = 2;//100;
		this.emu_nicehash = false;
		
		this.worker_seq = 0;
		
		this.job = null;
		
		this._jobs = {};
		
		this.events = events;
		
		this.pools = {};
		this.workers = {};
		
		this.workerToPool = {};
		this.poolToWorker = {};
		
		this.openNoConnectPools = {};
		this.freeWorkers = [];
		
		this.poolAddCount = 0;
		
		
		this.serverFrame();
		
		this.events.on("stratum:server:worker:connect"       , this.workerConnect      .bind(this));
		this.events.on("stratum:server:worker:disconnect"    , this.workerDisconnect   .bind(this));
		this.events.on("stratum:server:worker:get_job"       , this.workerGetJob       .bind(this));
		this.events.on("stratum:server:worker:share"         , this.workerShare        .bind(this));
		//this.events.on("stratum:server:worker:login"         , this.workerLogin        .bind(this));
		//this.events.on("stratum:server:worker:info"          , this.workerInfo         .bind(this));
		//this.events.on("stratum:server:worker:set_difficulty", this.workerSetDifficulty.bind(this));

		
		this.events.on("stratum:client:open"           , this.poolOpen         .bind(this));
		this.events.on("stratum:client:close"          , this.poolClose        .bind(this));
		this.events.on("stratum:client:connect"        , this.poolConnect      .bind(this));
		this.events.on("stratum:client:disconnect"     , this.poolDisconnect   .bind(this));
		this.events.on("stratum:client:accepted_job"   , this.poolAcceptedJob  .bind(this));
		//this.events.on("stratum:client:accepted_share" , this.poolAcceptedShare.bind(this));
		//this.events.on("stratum:client:rejected_share" , this.poolRejectedShare.bind(this));
		//this.events.on("stratum:client:ping"           , this.poolPing         .bind(this));

		this.addPoolAuto();
		
		
		this.events.on("control:pool:connect", (pool) => {
			this.events.emit("control:pool:disconnect");
			
			this.pool_connect_info = pool;
			this.maxWorkersCount = pool.max_workers || 100;
			this.emu_nicehash = pool.emu_nicehash;
			
			this.addPoolAuto();
		});
		
		this.events.on("control:pool:disconnect", () => {
			for(let i in this.pools) {
				this.pools[i].pool.disconnect("Switch pool");
			}	
			this.pool_connect_info = null;
		});
	
		setInterval(() => {
			for(let freeWrapperWorker of this.freeWorkers) {
				freeWrapperWorker.worker.updateJob();
			}
		}, 20e3);
		
		events.on("stratum:server:close", () => setTimeout(this.serverFrame.bind(this), STRATUM_PROXY_SERVER_RECONNECT_INTERVAL));
	}

	serverFrame() {
		this.stratumServer = new StratumServer(this.options.server, this.events, this.logger);
	}


	
	freeWorkersToPools() {
		for(let pool_id in this.pools) {
			let wrapperPool = this.pools[pool_id];
		
			let i;
			for(i = 0; i < this.freeWorkers.length; i++) {
				let wrapperWorker = this.freeWorkers[i];

				if ( !wrapperPool.addWorker(wrapperWorker.worker.id, wrapperWorker) ) {
					break;
				}
				
				this.events.emit(this.prefix + "pool_add_worker", wrapperPool.pool, wrapperWorker.worker);
				wrapperWorker.addPool(wrapperPool);
			}
			
			this.freeWorkers.splice(0, i);
		}
		
		if ( this.freeWorkers.length ) {
			this.addPoolAuto();
		}
	}
	addPoolAuto() {
		if ( !this.pool_connect_info ) {
			return;
		}
		
		let poolCount = Math.ceil( this.freeWorkers.length / this.maxWorkersCount );
		
		poolCount -= Object.keys(this.openNoConnectPools).length;
		
		if ( !Object.keys(this.pools).length && !Object.keys(this.openNoConnectPools).length && !poolCount ) {
			poolCount++;
		}
		
		//console.log("	New connect to pool count " +poolCount)
		
		while(poolCount-- > 0) {
			this.connectPool(this.pool_connect_info);
		}
	}
	
	workerConnect(worker) {
		//console.log('workerConnect');
		
		let wrapperWorker = this.workers[worker.id] = new WrapperWorker(worker.id, worker);

		this.freeWorkers.push(wrapperWorker);
		
		this.freeWorkersToPools();
	}
	workerDisconnect(worker) {
		let wrapperWorker = this.workers[worker.id];
		
		if ( wrapperWorker ) {
			if ( wrapperWorker.pool ) {
				wrapperWorker.pool.delWorker(wrapperWorker.id);
				this.events.emit(this.prefix + "pool_del_worker", wrapperWorker.pool.pool, wrapperWorker.worker);
			}
		}
		
		for(let i = 0; i < this.freeWorkers.length; i++) {
			if ( this.freeWorkers[i].id === wrapperWorker.id ) {
				this.freeWorkers.splice(i, 1);
				break;
			}
		}
		
		delete this.workers[worker.id];
	}
	workerGetJob(worker, retJob) {
		retJob.data = null;
		
		let wrapperWorker = this.workers[worker.id];
		
		if ( !wrapperWorker || !wrapperWorker.pool ) {
			return null;
		}

		retJob.data = wrapperWorker.pool.getJob();
	}
	workerShare(worker, resultJob) {
		//console.log('workerShare')
		let wrapperWorker = this.workers[worker.id];
		
		if ( !wrapperWorker || !wrapperWorker.pool ) {
			return;
		}
		
		wrapperWorker.pool.resultJob(resultJob);
	}
	
	poolOpen(pool) {
		this.openNoConnectPools[pool.id] = pool;
	}
	poolClose(pool) {
		delete this.openNoConnectPools[pool.id];
		
		setTimeout(this.addPoolAuto.bind(this), STRATUM_LOOP_CONNECT_POOL_TIMEOUT);
	}
	poolConnect(pool) {
		delete this.openNoConnectPools[pool.id];
		
		//console.log("poolConnect !!! #" + pool.id)
		
		this.pools[pool.id] = new WrapperPool(pool.id, pool, {maxWorkersCount: this.maxWorkersCount, emu_nicehash: this.emu_nicehash,});
		
		this.freeWorkersToPools();
	}
	poolDisconnect(pool) {
		//console.log("poolDisconnect !!! " + pool.id)
		let wrapperPool = this.pools[pool.id];

		if ( wrapperPool ) {
			for(let i in wrapperPool.workers) {
				let wrapperWorker = wrapperPool.workers[i];
				wrapperWorker.pool = null;
				this.freeWorkers.push(wrapperWorker);
	
				this.events.emit(this.prefix + "pool_del_worker", wrapperPool.pool, wrapperWorker.worker);
			}
			
			wrapperPool.clear();
		}
		
		delete this.pools[pool.id];
	}
	poolAcceptedJob(pool, job) {
		//console.log("poolNewJob !!! " + pool.id)
		let wrapperPool = this.pools[pool.id];

		if ( wrapperPool ) {
			wrapperPool.newJob(job);
		}
	}

	
	connectPool(pool_info) {
		/*
		this.logger.notice("Pool address   > " + Logger.LOG_COLOR_MAGENTA + this.pool_host + ":" + this.pool_port);
		this.logger.notice("Pool password  > " + Logger.LOG_COLOR_MAGENTA + this.options.pool_password);
		this.logger.notice("Wallet address > " + Logger.LOG_COLOR_MAGENTA + this.options.wallet_address);
		*/
		let pool = new StratumClient(pool_info, this.events, this.logger);
	}

	tryResultJob(job_id, nonce) {
		let _job_id = "__" + Common.strToHashSimplie(job_id);
		let _job_nonce = "__" + Common.strToHashSimplie(nonce);

		this._jobs = this._jobs || {};
		
		this._jobs[_job_id] = this._jobs[_job_id] || {};

		if ( this._jobs[_job_id][ _job_nonce ] ) {
			this.logger.warning("The worker sent a duplicate of work");
			return false;
		}
		
		this._jobs[_job_id][ _job_nonce ] = true;
		
		return true;
	}
	
	submitJob(job, params) {
		if ( this.stratumClient ) {
			if ( this.tryResultJob(job.job_id, job.nonce) ) {
				this.stratumClient.submitJob({
					job_id: job.job_id,
					nonce: job.nonce,
					result: job.result,
				}, params);
			}
		}
	}
}

module.exports = StratumProxy;
