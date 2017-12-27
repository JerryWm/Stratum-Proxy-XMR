
const EventEmitter = require("events").EventEmitter;

const Logger = require("./Logger");
const Common = require("./Common");
const StratumConfig = require("./StratumConfig");
const StratumCommon = require("./StratumCommon");
const HashRate = require("./HashRate");

/**
	bind_address,
	start_difficulty,
	share_time,
*/
/**
	onClose,
	
	onWorkerConnect,
	onWorkerDisconnect,
	onWorkerLogin,
	onWorkerHashRate,
	onWorkerGetJob,
	onWorkerResultJob,
	
	
*/

class TimeEvents {
	constructor() {
		this.data = [];
	}
	on(sec, cb, time) {
		if ( time === undefined ) {time = Common.currTimeSec();}
		
		this.data.push({
			interval: sec,
			lastTime: time,
			cb: cb,
		});
	}
	emit(time) {
		if ( time === undefined ) {time = Common.currTimeSec();}
		
		for(let v of this.data) {
			if ( v.lastTime + v.interval <= time ) {
				v.lastTime = time;
				v.cb();
			}
		}
	}
}



/**
	EventEmitter {
		stratum:server:open
		stratum:server:close
		stratum:server:listening
		
		stratum:server:worker:connect
		stratum:server:worker:disconnect
		stratum:server:worker:close
		stratum:server:worker:login
		stratum:server:worker:share
		stratum:server:worker:info
		stratum:server:worker:get_job
		stratum:server:worker:set_difficulty
		stratum:server:worker:
		stratum:server:worker:

		
	}
*/
class StratumServer {
	constructor(options, events, logger) {
		this.prefix = "stratum:server:";
		this.options = options;
		this.events = events;
		this.id = Common.getGlobalUniqueId();
		this.logger = new Logger(logger, "STRATUM-SERVER #" + this.id);
		
		this.events.emit(this.prefix + "open", this);

		let tmphp = Common.addressEx(this.options.bind_address);
		if ( !tmphp ) {
			this.logger.error("Invalid pool address \"" + this.options.bind_address + "\"");
			this.events.emit(this.prefix + "close", this);
			return;
		}
		[this.host, this.port] = tmphp;
		
		this.options.start_difficulty = this.options.start_difficulty || 100000;
		this.options.share_time  = this.options.share_time  || 20;

		this.socket = require('net').createServer(this.onClient.bind(this));
		
		this.job = null;
		this.workers = [];

		this.setEvents();
	}
	
	setEvents() {
		this.socket.on("error", (e) => {
			this.logger.error('An error has occurred ' + (e.code ? e.code : ""));
			this.close();
		});
		
		this.socket.on("listening", () => {
			this.logger.success("Opened server on \""+this.host+':'+this.port+'"' );
			this.events.emit(this.prefix + "listening", this);
		});

		try {
			this.logger.notice("Attempting opened server on "+Logger.LOG_COLOR_MAGENTA_LIGHT+"\""+this.host+':'+this.port+'"');
			this.socket.listen(this.port, this.host);
		} catch(e) {
			this.logger.error('An error has occurred ' + (e.message ? e.message : ""));
			this.close();
		}
	}
	
	close() {
		for(let worker of this.workers) {
			worker.close();
		}

		this.socket.close();
		this.logger.close();
		this.events.emit(this.prefix + "close", this);
	}

	onClient(socket) {
		let worker = new StratumServerClient(this.options, this.events, socket, this.logger);

		this.workers.push(worker);
	}

	updateJob() {
		for(let i = 0; i < this.workers.length; i++) {
			this.workers[i].updateJob();
		}
	}
}

class StratumServerClient {
	constructor(options, events, socket, logger) {
		this.prefix = "stratum:server:worker:";
		this.options = options;
		this.events = events;
		this.id = Common.getGlobalUniqueId();
		this.logger = new Logger(logger, "WORKER #" + this.id);

		this.disconnected = false;
		
		this.wid = "wid" + this.id;

		this.socket = socket;
		
		this.incoming = new StratumCommon.Recv();

		this.address = this.socket.remoteAddress+":"+this.socket.remotePort;
		this.agent = "";
		this.pool_password = "";
		this.wallet_address   = "";
		this.difficulty = null;
		this.target = null;
		this.hashes = 0;
		this.shares = 0;
		this.job = null;
		this.pool_target = 0;
		this.start_difficulty = this.options.start_difficulty || 10000;
		
		this.hashRate = new HashRate.HashRate();
		this.hashRateLast = new HashRate.HashRateLast(10);
		
		
		this.state = StratumServerClient.STATE_NO_LOGIN;
		
		this.isSendJob = false;
		
		this.logger.notice(`Accepted worker`);

		this.startTime = Common.currTimeMiliSec();
		
		this.connectionTime = Common.currTimeSec();

		this.events.emit(this.prefix + "connect", this);
		
		this.setEvents();
	}
	
	setEvents() {
		
		this.socket.on('data', (data) => { 
			if ( !this.incoming.recv(data, this.recvFrameObject.bind(this)) ) {
				this.sendError("Bad json");
				this.logger.error("Worker send bad json");
				this.close();
			}
		});
		
		this.socket.on('end', () => {
			this.logger.notice('Client disconnected'); 
			this.close();
		});
		
		this.socket.on('error', () => {
			this.logger.error('Error socket');
			this.close();
		});
		
		this.socket.on('timeout', () => {
			this.logger.error('Error socket timeout');
			this.close();
		});
		
	}

	close() {
		if ( this.disconnected ) {
			return;
		}
		
		this.socket.end();
		this.logger.notice("Disconnected...");
		this.logger.close();
		
		this.events.emit(this.prefix + "disconnect", this);
		this.events.emit(this.prefix + "close", this);
		
		this.disconnected = true;
	}
	
	recvFrameObject(obj) {
		if ( !obj ) {
			this.notice("Worker send bad data");
			return;
		}
		
		let resultId = parseInt(obj.id);
		
		if ( this.state === StratumServerClient.STATE_NO_LOGIN ) {
			
			if ( obj.method !== 'login' ) {
				this.sendResult(resultId, null, "Expected client login method");
				this.logger.error("Send error: Expected client login method");
				this.close();
				return;
			}
		
			if ( obj.params ) {
				this.wallet_address   = obj.params.login;
				this.pool_password = obj.params.pass;
				this.agent         = obj.params.agent;
			}
			
			let job = this.getJob();
			if ( !job ) {
				this.sendResult(resultId, null, "Proxy server is not ready");
				this.logger.error("Send error: Proxy server is not ready");
				this.close();
				return;
			}
			
			this.sendResult(resultId, {
				id: this.wid,
				job: job,
				status: "OK"
			});
			
			this.state = StratumServerClient.STATE_NORMAL;
			
			let agent = (this.agent || "").substr(0, 16) + "...";
			
			this.logger.success(`${this.socket.remoteAddress}:${this.socket.remotePort} / ${agent}`);
			
			this.events.emit(this.prefix + "login", this);
			
			return;
			
		}
		
		if ( !obj.method ) {
			return;
		}
		
		switch(obj.method) {
			case "submit":
				this.sendResult(resultId, {status: "OK"});
				
				if ( !obj.params ) {
					this.logger.warning("Worker send invalid message[method=submit]");
					break;
				}

				if ( !obj.params.job_id ) {
					this.logger.warning("Worker send invalid message[method=submit, invalid job_id]");
					break;
				}
				
				if ( !obj.params.nonce || obj.params.nonce.length !== 8 ) {
					this.logger.warning("Worker send invalid message[method=submit, invalid nonce]");
					break;
				}
				
				if ( !obj.params.result || obj.params.result.length !== 64 ) {
					this.logger.warning("Worker send invalid message[method=submit, invalid result]");
					break;
				}
		
				//this.logger.notice(`Result job [nonce: ${obj.params.nonce}]`);
				
				this.onResultJob(obj.params);
				break;
				
			case "keepalived":
				this.sendResult(resultId, {status: "KEEPALIVED"});
				break;
		}
		
	}

	makeErrorForSend(errorText, errorCode) {
		let error = null;
		
		if ( errorText !== undefined ) {
			if ( errorCode === undefined ) {
				errorCode = -1;
			}
			
			error = {
				code: errorCode,
				message: errorText,
			};
		}

		return error;
	}
	sendResult(id, result, errorText, errorCode) {
		this.sendObj({
			id: id,
			result: result,
			error: this.makeErrorForSend(errorText, errorCode),
		});
	}
	sendJob(job) {
		let obj = {
			error: null,
			method: "job",
			params: job,
		};
		this.sendObj(obj);
	}
	sendError(errorText, errorCode) {
		obj = {
			error: this.makeErrorForSend(errorText, errorCode),
		};
		this.sendObj(obj);
	}
	sendObj(obj, cb) {
		obj.jsonrpc = "2.0";
		if ( !obj.error ) {
			obj.error = null;
		}

		//this.logger.dev('send: '+JSON.stringify(obj) + "\n");
		this.socket.write(JSON.stringify(obj) + "\n", cb);
	}
	
	onResultJob(job) {
		if ( !(this.job && this.job.job_id === job.job_id) ) {
			return;
		}
		
		this.hashes += this.difficulty;
		this.shares++;
		
		let currTime = Common.currTimeSec();

		this.hashRate.addResultJob(this.hashes);
		this.hashRateLast.addResultJob(this.hashes);		
		
		let hrAvg = this.hashes / (currTime - this.connectionTime);

		let hashTarget = Common.hexToUint32( job.result.substr(28*2, 8) );
		
		job.worker_id = this.id;
		
		this.events.emit(this.prefix + "virtual_share", this, job);
		
		if ( hashTarget >= this.pool_target ) {
			return;
		}
		
		this.events.emit(this.prefix + "share", this, job);
		this.events.emit(this.prefix + "info", this, {
			hashes: this.hashes,
			shares: this.shares,
			difficulty: this.difficulty,
			hashrate: {
				last: this.hashRateLast.getHashRate(),
				minutes: this.hashRate.getHashRate([5, 10, 15, 30, 60]),
				all: hrAvg,
			}
		});
	}
	
	updateJob() {
		let job = this.getJob();
		if ( job ) {
			this.sendJob(job);
		}
	}
	getJob() {
		let currTimeSec = Common.currTimeSec()

		let retJob = {};
		this.events.emit(this.prefix + "get_job", this, retJob);
		let job = retJob.data;
		if ( !job ) {
			job = {
				job_id: Common.randHex(32),
				target: "00000000",
				blob  : Common.randHex(39) + "00000000" + Common.randHex(76 - 39 - 4), 
			};
		}

		if ( this.lastGetJobTime && !this.hashes ) {
			let fr = ((currTimeSec - this.lastGetJobTime) / this.options.share_time);
			fr = Math.max(fr, 2);
			
			this.start_difficulty /= fr;
			this.start_difficulty = Math.max(this.start_difficulty, 10);
		}
		
		let diff = this.start_difficulty;//20 + Math.random() * 100;
		
		this.pool_target = Common.hexToUint32(job.target);
		
		if ( this.hashes ) {
			diff = this.hashRateLast.getHashRate();
			//diff = this.hashRate.getHashRate([10]);
			//diff = ( diff[10] ) ? diff[10] : (this.hashes / (currTimeSec - this.connectionTime));
			diff = ( diff ) ? diff : (this.hashes / (currTimeSec - this.connectionTime));
			diff *= this.options.share_time;
		}
		
		
		let target = (0xFFFFFFFF / diff)|0;
		target = Math.max(target, this.pool_target);
		
		diff = 0xFFFFFFFF / target;
		
		job.target = Common.uint32ToHex(target);
		
		
		this.difficulty = diff;
		this.target = job.target;
		this.job = job;
		this.lastGetJobTime = currTimeSec;

		this.events.emit(this.prefix + "set_difficulty", this, this.difficulty);
		this.events.emit(this.prefix + "accepted_job", this, job);
		 
		return job;
	}
	
}
StratumServerClient.STATE_NO_LOGIN = 1;
StratumServerClient.STATE_NORMAL = 2;

module.exports = StratumServer;
