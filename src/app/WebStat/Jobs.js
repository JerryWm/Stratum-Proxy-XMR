
const Common = require("../Common");
const PackArray = require("../PackArray");
const WebStatBase = require("./WebStatBase");

class Jobs extends WebStatBase {
	constructor(events) {
		super(events);

		this.jobs = {};
		this.jobsArchive = new PackArray(1024*1024);
		
		this.poolsJobs = {};
		this.poolsWorkerCount = {};
		
		events.on("web:server:connect_web_socket", (socket) => {
			this._update();

			this.webEmit("jobsArchive", this.jobsArchive.getData(), socket);
			this.webEmit("jobs", Common.objToArray(this.jobs), socket);
		});			
		
		events.on("stratum:client:disconnect"    , this.poolDisconnect.bind(this));
		events.on("stratum:client:accepted_job"  , this.acceptedJob  .bind(this));
		events.on("stratum:client:accepted_share", this.acceptedShare.bind(this));
		events.on("stratum:client:rejected_share", this.rejectedShare.bind(this));
		
		events.on("stratum:proxy:pool_add_worker", this.poolAddWorker.bind(this));
		events.on("stratum:proxy:pool_del_worker", this.poolDelWorker.bind(this));
	}
	
	_update(id) {
		if ( !id ) {
			for(let i in this.jobs) {
				this._update(i);
			}
			return;
		}
		
		let job = this.jobs[id];
		if ( !job ) { return; }
		
		if ( job.alive ) {
			job.time_in_work = Common.currTimeMiliSec() - job.time_start;
		}
	}
	_updateMini(id, info) {
		let data = [
			id, 
			info.accepted_share_count,
			info.rejected_share_count,
		];

		this.webEmit("job_info_mini", data);				
	}
	
	poolAddWorker(origPool) {
		this.poolsWorkerCount[origPool.id] = this.poolsWorkerCount[origPool.id] || 0;
		this.poolsWorkerCount[origPool.id]++;
	}
	poolDelWorker(origPool) {
		if ( this.poolsWorkerCount[origPool.id] ) {
			this.poolsWorkerCount[origPool.id]--;
		}
	}
	_getWorkerCount(poolId) {
		return this.poolsWorkerCount[poolId] ? this.poolsWorkerCount[poolId] : 0;
	}
	
	poolDisconnect(origPool) {
		this._endJob(this.poolsJobs[origPool.id], "Pool disconnect");
	}
	acceptedJob(origPool, origJob) {
		let uid = Common.strToHashSimplie(origPool.id + "\x00" + origJob.job_id);
		
		this._endJob(this.poolsJobs[origPool.id], "Switch job");
		
		this.poolsJobs[origPool.id] = origJob.id;
		
		let job = this.jobs[origJob.id] = {
			id: origJob.id,
			
			pool_id: origPool.id,
			
			job_id: origJob.job_id,
			nonce : Common.extNonceJobBlob(origJob.blob),
			difficulty: origPool.difficulty,
			
			accepted_share_count: 0,
			rejected_share_count: 0,
			
			time_in_work: 0,
			time_start: Common.currTimeMiliSec(),
			time_end: null,

			alive: true,
			
			worker_count: this._getWorkerCount(origPool.id)
		};
		
		this.webEmit("jobs", [job]);
	}
	acceptedShare(origPool, share) {
		let job = this.jobs[share.id]; if ( !job ) { return; }
		
		job.accepted_share_count++;
		
		this._updateMini(job.id, {accepted_share_count: job.accepted_share_count});
	}
	rejectedShare(origPool, share) {
		let job = this.jobs[share.id]; if ( !job ) { return; }
	
		job.rejected_share_count++;
		
		this._updateMini(job.id, {rejected_share_count: job.rejected_share_count});
	}
	_endJob(id, end_message) {
		let job = this.jobs[id]; if ( !job ) { return; }
		
		job.alive = false;
		job.time_end = Common.currTimeMiliSec();
		job.time_in_work = job.time_end - job.time_start;
		job.end_message = end_message || "";
		
		this.webEmit("jobs", [job]);
		
		this.jobsArchive.write("job", job);
		
		delete this.jobs[id];
	}

	
}

module.exports = Jobs;
