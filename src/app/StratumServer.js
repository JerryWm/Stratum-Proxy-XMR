
const EventEmitter = require("events").EventEmitter;

const fs = require('fs');
const Logger = require("./Logger");
const Common = require("./Common");
const StratumConfig = require("./StratumConfig");
const StratumCommon = require("./StratumCommon");
const HashRate = require("./HashRate");
const Paths = require("./Paths");

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

const stratumServerOptionsFilter = {
	start_difficulty: {def: 10000, min: 10, max: undefined},
	
	min_difficulty: {def: 10, min: 10, max: undefined},
	
	share_time: {def: 20, min: 1, max: undefined},
};


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

		this.options = {
			bind_address: options.bind_address,
			
			start_difficulty: Common.parseIntegerFilter(options.start_difficulty, stratumServerOptionsFilter.start_difficulty),
			min_difficulty  : Common.parseIntegerFilter(options.min_difficulty  , stratumServerOptionsFilter.min_difficulty),
			share_time      : Common.parseIntegerFilter(options.share_time      , stratumServerOptionsFilter.share_time),
			ssl: !!options.ssl,
			ssl_options: !options.ssl_options ? null : {
				key : options.ssl_options.key,
				cert: options.ssl_options.cert,
			}
		};
		
		this.events = events;
		this.id = Common.getGlobalUniqueId();
		
		this.job = null;
		this.workers = [];
		
		this.logger = new Logger(logger, "STRATUM-SERVER #" + this.id);
		
		this.events.emit(this.prefix + "open", this);
		
		let tmphp = Common.addressEx(this.options.bind_address);
		if ( !tmphp ) {
			this.logger.error(`Invalid pool address "${this.options.bind_address}"`);
			this.events.emit(this.prefix + "close", this);
			return;
		}
		[this.host, this.port] = tmphp;


		this.create();
		
		this.setEvents();
	}
	
	create() {
		if ( this.options.ssl ) {
			let ssl_options = {
				requestCert: false,
				key: fs.readFileSync(Paths.APP_RESOURCES_DIR + '/default-server-cert/key.pem'),
				cert: fs.readFileSync(Paths.APP_RESOURCES_DIR + '/default-server-cert/cert.pem'),
			};

			if ( this.options.ssl_options && 
					this.options.ssl_options.key && 
						this.options.ssl_options.cert ) {
				do {
					if ( !fs.existsSync(this.options.ssl_options.key) ) {
						this.logger.error(`File "${this.options.ssl_options.key}" for ssl stratum server(${this.options.bind_address}) not found`);
						break;
					}
					
					if ( !fs.existsSync(this.options.ssl_options.cert) )  {
						this.logger.error(`File "${this.options.ssl_options.cert}" for ssl stratum server(${this.options.bind_address}) not found`);
						break;
					}
					
					ssl_options.key = fs.readFileSync(this.options.ssl_options.key);
					ssl_options.cert = fs.readFileSync(this.options.ssl_options.cert);
				} while(0);
				
			}
			
			this.socket = require('tls').createServer(ssl_options, this.onClient.bind(this));
		} else {
			this.socket = require('net').createServer(this.onClient.bind(this));
		}
	}
	
	logInfoServer(color, prevColor) {
		return `[${color}SSL ${this.options.ssl?"ON":"OFF"}${prevColor}] "${color}${this.options.bind_address}${prevColor}"`;
	}
	
	setEvents() {
		this.socket.on("error", (e) => {
			this.logger.error('An error has occurred ' + (e.code ? e.code : ""));
			this.close();
		});
		
		this.socket.on("listening", () => {
			this.logger.success(`Opened server on ${this.logInfoServer(Logger.LOG_COLOR_MAGENTA, Logger.LOG_COLOR_GREEN)}`);
			this.events.emit(this.prefix + "listening", this);
		});

		try {
			this.logger.notice(`Attempting opened server on ${this.logInfoServer(Logger.LOG_COLOR_MAGENTA_LIGHT, Logger.LOG_COLOR_GRAY)}`);
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
         this.socket.setKeepAlive(true);
         this.socket.setEncoding('utf8');
		
		this.socket.on('data', (data) => { 
			if ( !this.incoming.recv(data, this.recvFrameObject.bind(this)) ) {
				this.sendError("Bad json");
				this.closeAndLogError("Worker send bad json");
			}
		});
		
		this.socket.on('end', () => {
			this.closeAndLogError('Client disconnected');
		});
		
		this.socket.on('error', () => {
			this.closeAndLogError('Error socket');
		});
		
		this.socket.on('timeout', () => {
			this.closeAndLogError('Error socket timeout');
		});
		
	}

	close(msg) {
		if ( this.disconnected ) {
			return;
		}
		
		this.socket.end();
		this.logger.notice("Disconnected...");
		this.logger.close();
		
		this.events.emit(this.prefix + "disconnect", this, msg);
		this.events.emit(this.prefix + "close", this, msg);
		
		this.disconnected = true;
	}
	closeAndLogError(msg) {
		this.logger.error(msg);
		this.close(msg);
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
				this.closeAndLogError("Send error: Expected client login method");
				return;
			}
		
			if ( obj.params ) {
				this.wallet_address   = obj.params.login;
				this.pool_password = obj.params.pass;
				this.agent         = obj.params.agent;
			}
			
			this.events.emit(this.prefix + "login", this);
			
			let job = this.getJob();
			if ( !job ) {
				this.sendResult(resultId, null, "Proxy server is not ready");
				this.closeAndLogError("Send error: Proxy server is not ready");
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
		let obj = {
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
		
		diff = Math.max(diff, this.options.min_difficulty);
		
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
