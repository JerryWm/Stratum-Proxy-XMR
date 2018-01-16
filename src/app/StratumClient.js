
const EventEmitter = require("events").EventEmitter;

const Logger = require("./Logger");
const Common = require("./Common");
const HashRate = require("./HashRate");
const StratumConfig = require("./StratumConfig");
const StratumCommon = require("./StratumCommon");

class SetIntervalMng {
	constructor(timeInterval) {
		this.list = [];
		this.iid = setInterval(this.frame.bind(this), timeInterval);
	}
	
	frame() {
		for(let cb of this.list) {
			cb();
		}
	}
	
	on(cb) {
		this.list.push(cb);
	}
	close() {
		clearInterval(this.iid);
	}
}


/**
{
	pool_address: "",
	pool.pool_password: "",
	wallet_address: "",
	keepalive: 60,
	response_timeout: 20,
}
*/

class StratumClient {	
	/**
	{
		EventEmitter {
			stratum:client:open
			stratum:client:close
			stratum:client:connect
			stratum:client:disconnect
			stratum:client:ping
			stratum:client:accepted_job
			stratum:client:accepted_share
			stratum:client:rejected_share
		}
	}
	*/
	constructor(options, events, logger) {		
		this.prefix = "stratum:client:";
		this.events = events;
		
		this.id = Common.getGlobalUniqueId();
		
		this.logger = new Logger(logger, "STRATUM-CLIENT #" + this.id);

		this.events.emit(this.prefix + "open", this);
		
		this.pool = new StratumConfig(this.logger, options);
		if ( !this.pool.valid ) {
			this.events.emit(this.prefix + "close", this);
			return;
		}
		
		this.pool_id = null;
		
		this.ping = null;

		this.incoming = new StratumCommon.Recv();
		
		this.socket = null;
		
		this.USER_AGENT = "JerryPROXY~CRYPTONIGHT";
		
		this.difficulty = null;
		
		this.share_count = 0;
		this.rejected_share_count = 0;
		this.hash_count = 0;
		
		this.job = null;
		
		this.disconnected = true;
		this.closed = false;
		
		this.target = null;
		
		this.lastShareUpdateTime = Common.currTimeMiliSec();
		
		this.hashRate = new HashRate.HashRate();
		this.hashRateLast = new HashRate.HashRateLast();
		
		this.sendSeq = 1;
		this.expectedResult = Object.create(null);
		
		this.connect();

		this.keepaliveSIM = new SetIntervalMng(this.pool.keepalive);
		if ( !this.pool.keepalive ) { this.keepaliveSIM.close(); }
		this.expectedResultSIM = new SetIntervalMng(1e3);

		this.expectedResultSIM.on(() => {
			let ctms = Common.currTimeMiliSec();
			for(let i in this.expectedResult) {
				let obj = this.expectedResult[i];
				
				if ( obj.startTime + obj.timeoutMiliSec < ctms ) {
					this.logger.error("Pool did not send the result. Timeout error");
					this.disconnect("Pool did not send the result. Timeout error");
					return;
				}
			}
		});
	}
	
	logPoolInfo(colorSelect, colorNormal) {
		return '['+colorSelect+(this.pool.ssl?"SSL ON":"SSL OFF")+colorNormal+'] ' + 
			'[' + colorSelect + (this.pool.keepalive?"KPALV "+(this.pool.keepalive*1e-3):"KPALV OFF") +colorNormal+'] ' +
			'[' + colorSelect + ("RSP TO "+(this.pool.response_timeout*1e-3)) +colorNormal+ '] ' +
			'"'+colorSelect+ this.pool.host+':'+this.pool.port +colorNormal+'" ' ;
	}

	connect() {
		this.logger.notice("Attempting to connect to "+this.logPoolInfo(Logger.LOG_COLOR_MAGENTA_LIGHT, Logger.LOG_COLOR_GRAY));

		if ( !this.pool.ssl ) {
			this.socket = require('net').createConnection({
				host: this.pool.host,
				port: this.pool.port
			});
		} else {
			process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
			this.socket = require('tls').connect({
				host: this.pool.host,
				port: this.pool.port,
				requestCert: false,
				rejectUnauthorized: false
			});
		}
		
		this.setEvents();
	}
	
	disconnect(msg) {
		this.keepaliveSIM.close();
		this.expectedResultSIM.close();
		
		if ( !this.disconnected ) {
			this.events.emit(this.prefix + "disconnect", this, msg || "");
		}
		if ( !this.closed ) {
			this.events.emit(this.prefix + "close", this, msg || "");
		}
		
		this.disconnected = true;
		this.closed = true;
		
		if ( this.socket ) {
			this.socket.destroy();
			this.socket = null;
			return;
		}		
	}
	
	setEvents() {
		this.socket.on('connect', () => {			
			this.logger.success('Connected to ' + this.logPoolInfo(Logger.LOG_COLOR_MAGENTA, Logger.LOG_COLOR_GREEN));
			
			this.disconnected = false;

			this.events.emit(this.prefix + "connect", this);
			
			this.send_Login({
				agent: this.USER_AGENT,
				login: this.pool.wallet_address,
				pass : this.pool.pool_password,
			}, (obj) => {
				if ( obj.error ) {
					this.logger.error('Pool sent a bug "'+(obj.error.message?obj.error.message:'')+'"');
					this.disconnect('Pool sent a bug "'+(obj.error.message?obj.error.message:'')+'"');
					return;
				}
				
				if ( obj.result ) {
					if ( !this._checkParamString(obj.result.id, 1, 256) ) {
						this.logger.error('The pool sent the wrong ID format');
						this.disconnect('The pool sent the wrong ID format');
						return;
					}
					
					this.pool_id = obj.result.id;	
					this.parseJob(obj.result.job);
					
					this.keepaliveSIM.on(this.doPing.bind(this));
				} else {
					this.logger.error('Pool sent a invalid message');
					this.disconnect('Pool sent a invalid message');
					return;
				}

				this.events.emit(this.prefix + "login", this);
				this.doPing();
			});
			
		});
		
		this.socket.on('data', (data) => {
			if ( !this.incoming.recv(data, this.recvFrameObject.bind(this)) ) {
				this.logger.error("Pool send bad json");
				this.disconnect("Pool send bad json");
			}
		});
		
		this.socket.on('close', () => {
			this.logger.error('The server disconnected the connection');
			this.disconnect('The server disconnected the connection');
		});
		
		this.socket.on('error', (e) => {
			this.logger.error('An error has occurred ' + (e.code ? e.code : ""));
			this.disconnect('An error has occurred ' + (e.code ? e.code : ""));
		});
		
		this.socket.on('timeout', () => {
			this.logger.error('Timeout error');
			this.disconnect('Timeout error');
		});
	}
	
	sendLine(line) {
		//this.logger.notice("send... : " + line);
		if ( this.socket ) {
			this.socket.write( line + '\n' );
		}
	}
	sendObj(obj, cbResult) {
		obj.id = this.sendSeq++;
		
		this.expectedResult[ obj.id ] = {
			startTime     : Common.currTimeMiliSec(),
			timeoutMiliSec: this.pool.response_timeout || DEF_POOL_RESPONSE_TIMEOUT,
			cbResult      : cbResult
		};
		
		this.sendLine( JSON.stringify(obj) );
	}
	sendMethod(method, params, cbResult) {
		params = params || {};
		if ( this.pool_id !== null ) {
			params.id = this.pool_id;
		}
		
		this.sendObj({
			method: method,
			params: params
		}, cbResult);
	}
	send_Login(params, cbResult) {
		this.sendMethod("login", params, cbResult);
	}
	send_Submit(params, cbResult) {
		this.sendMethod("submit", params, cbResult);
	}
	send_Keepalived(params, cbResult) {
		this.sendMethod("keepalived", params, cbResult);
	}
	
	doPing() {
		if ( !this.pool.keepalive ) {
			return;
		}

		var dlt = Common.timeDeltaMiliSec();
		
		this.send_Keepalived({}, () => {
			this.ping = dlt();
			this.events.emit(this.prefix + "ping", this, this.ping);
			//this.logger.success("Ping "+Logger.LOG_COLOR_MAGENTA+this.ping+Logger.LOG_COLOR_GREEN+" msec");
		});
	}

	recvFrameObject(obj) {
		//this.logger.notice("recv...: " + JSON.stringify(obj))
		if ( typeof obj !== 'object' ) {
			this.logger.error('Pool sent invalid raw json');
			this.disconnect('Pool sent invalid raw json');
			return;
		}
		
		if ( (typeof obj.id === 'string' || typeof obj.id === 'number') && ( parseInt(obj.id).toString() === obj.id.toString() ) ) {
			let expectedObj = this.expectedResult[obj.id];
			if ( !expectedObj ) {
				this.logger.error('Pool sent a obj, result is not expected');
				this.disconnect('Pool sent a obj, result is not expected');
				return;
			}

			delete this.expectedResult[obj.id];

			if ( expectedObj.cbResult ) {
				expectedObj.cbResult(obj);
			}
			
			return;
		}
	
		if ( obj.error ) {
			this.logger.warning('Pool sent a bug "'+(obj.error.message?obj.error.message:'')+'"');
			return;
		}
		
		if ( obj.method ) {
			switch(obj.method) {
				case "job":
					this.parseJob(obj.params);
					return;
					break;
			}
		}
		
		if ( obj.result && (typeof obj.result === 'object') ) {
			if ( (typeof obj.result.status === 'string') && obj.result.status.length ) {
				this.logger.notice(Logger.LOG_COLOR_GREEN_LIGHT + "Pool has sent the status \""+ obj.result.status + "\"");
			}
		}		
	}
	
	parseJob(job) {
		if ( !job ) {
			this.logger.error('The pool sent the wrong JOB format');
			this.disconnect('The pool sent the wrong JOB format');
			return;
		}
		
		if ( !this._checkParamString(job.job_id, 1, 256) ) {
			this.logger.error('The pool sent the wrong JOB_ID format');
			this.disconnect('The pool sent the wrong JOB_ID format');
			return;
		}
		
		if ( !this._checkParamString(job.blob, 76*2, 76*2) ) {
			this.logger.error('The pool sent the wrong JOB_BLOB format');
			this.disconnect('The pool sent the wrong JOB_BLOB format');
			return;
		}
		
		if ( !this._checkParamString(job.target, 4*2, 4*2) ) {
			this.logger.error('The pool sent the wrong JOB_TARGET format');
			this.disconnect('The pool sent the wrong JOB_TARGET format');
			return;
		}
		
		this.job = job;
		this.job.is_new = true;
		this.job.id = Common.getGlobalUniqueId();

		let target = Common.parseIntByHex(job.target);
		
		let difficulty = (0xFFFFFFFF / target);
		if ( !this.difficulty || Math.abs(difficulty - this.difficulty) > 0.001 ) {
			this.difficulty = difficulty;
			this.events.emit(this.prefix + "set_difficulty", this, difficulty);
			this.logger.warning("Set difficulty to " + Logger.LOG_COLOR_MAGENTA + difficulty.toFixed(2));
		}
		this.target = job.target;
		
		this.logger.notice(Logger.LOG_COLOR_GREEN_LIGHT + "Accepted new job #" + this.jobIdToLog(job.job_id) + " difficulty " + difficulty.toFixed(2))
		
		this.events.emit(this.prefix + "accepted_job", this, this.job);
	}
	
	submitJob(share) {
		if ( this.job && (share.job_id === this.job.job_id) ) {
			share.id = this.job.id;
			share.share_id = Common.getGlobalUniqueId();
			share.pool_id = this.id;
			share.difficulty = this.difficulty;
			share.time_start = this.lastShareUpdateTime;
			share.time_end = Common.currTimeMiliSec();
			share.time_in_work = share.time_end - share.time_start;
			 
			this.job.shareNonceArray = this.job.shareNonceArray || [];
			if ( this.job.shareNonceArray.indexOf(share.nonce) !== -1 ) {
				this.events.emit(this.prefix + "rejected_share", this, share, "Proxy lvl. Duplicate share");
				return;
			}
			this.job.shareNonceArray.push(share.nonce);
			
			this.lastShareUpdateTime = Common.currTimeMiliSec();
			
			let saveDifficulty = this.difficulty;
			
			this.send_Submit({
				id    : this.pool_id,
				job_id: share.job_id,
				nonce : share.nonce,
				result: share.result,
			}, (obj) => {
				
				if ( obj.error ) {
					this.rejected_share_count++;
					
					this.logger.warning('Pool sent a bug "'+(obj.error.message?obj.error.message:'')+'"');
					this.events.emit(this.prefix + "rejected_share", this, share, (obj.error.message?obj.error.message:''));
					return;
				}
				if ( obj.result ) {
					this.share_count++;
					this.hash_count += saveDifficulty;
					
					this.hashRate.addResultJob(this.hash_count);
					this.hashRateLast.addResultJob(this.hash_count);
					
					if ( obj.result.status.length ) {
						this.logger.notice(Logger.LOG_COLOR_GREEN_LIGHT + "Pool has sent the status \""+ obj.result.status + "\"");
					}
					
					this.events.emit(this.prefix + "accepted_share", this, share);
					return;
				}
			});

			this.logger.notice(Logger.LOG_COLOR_GREEN_LIGHT + "Submit share #" + this.jobIdToLog(share.job_id) + " nonce " + share.nonce);
		}
	}
	
	_checkParamString(s, minlen, maxlen) {
		return ( (typeof(s) === "string") && (s.length >= minlen) && (s.length <= maxlen) );
	}

	
	jobIdToLog(id) {
		const MAXLEN = 32;
		
		if ( id.length <= MAXLEN ) {
			return id;
		}
		
		return id.slice(0, MAXLEN>>1) + "..." + id.slice(-(MAXLEN>>1));
	}
	
}

module.exports = StratumClient;
