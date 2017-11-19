const CFG_PATH = "config.json";

const NONCE_WORKER_DELTA = 1e5;

const TIMEINTERVAL_SHOW_STAT = 1e3 * 60 * 5;

const APP_DIR = __dirname + "/";
const APP_WEB_DIR = APP_DIR + "/web/";
const APP_WEB_PUBLIC_DIR = APP_WEB_DIR + "/public/";

process.on('uncaughtException', function(e) {});

class Logger {
	constructor(printer, prefix) {
		this.printer = printer;
		this.prefix = prefix || "";
		this.noPrint = false;
	}

	dev(text) { this.log(Logger.LOG_COLOR_SR + "[DEV] " + text) }

	success(text) { this.log(Logger.LOG_COLOR_GREEN + "[SUCCESS] " + text) }
	notice(text)  { this.log(Logger.LOG_COLOR_SR + "[NOTICE] " + text) }
	warning(text) { this.log(Logger.LOG_COLOR_YELLOW + "[WARNING] " + text) }
	error(text)   { this.log(Logger.LOG_COLOR_RED + "[ERROR] " + text) }

	log(text) {
		text += Logger.LOG_COLOR_RESET;
		
		if ( this.noPrint ) {
			return;
		}
		
		text = `[${this.prefix}] ${text}`;
		
		if ( this.printer instanceof Logger ) {
			this.printer.log(text);
		} else {
			this.printer(text);
		}
	}
	
	close() {
		this.noPrint = true;
	}
}
Logger.LOG_COLOR_RESET   = "\033[0m";
Logger.LOG_COLOR_SR	     = "\033[1;30m";
Logger.LOG_COLOR_RED     = "\033[1;31m";
Logger.LOG_COLOR_GREEN   = "\033[1;32m";
Logger.LOG_COLOR_YELLOW  = "\033[1;33m";
Logger.LOG_COLOR_BLUE    = "\033[1;34m";
Logger.LOG_COLOR_WHITE   = "\033[1;37m";
Logger.LOG_COLOR_DEVMODE = "\033[1;35m";
Logger.LOG_COLOR_MAGENTA = "\033[1;35m";
Logger.LOG_COLOR_CYAN    = "\033[1;36m";

Logger.LOG_COLOR_MAGENTA_LIGHT = "\033[0;35m";
Logger.LOG_COLOR_GREEN_LIGHT   = "\033[0;32m";


class Common {
}
Common.revers2b = function(s) {
	let _s = "";
	for(let i = 0; i < s.length; i+=2) {
		_s = s.substr(i, 2) + _s;
	}
	return _s;
}
Common.parseIntByHex = function(hex) {
	return parseInt(Common.revers2b(hex), 16);
}
Common.strToHashSimplie = function(s) {
	let r = "";
	for(let i = 0; i < s.length; i++) {
		r += "_" + s.charCodeAt(i).toString(16);
	}
	return r;
}
Common.addressEx = function(address) {
	let m;
	if ( typeof address !== 'string' || !(m = address.match(/([^\\/]*?)\s*\:\s*(\d+)/)) ) {
		return null;
	}

	return [m[1], m[2]];
}
Common.randHex = function(len) {
	let s = "";
	while(len--)
		s += Math.random().toString(16).substr(4, 2);
	return s;
}
Common.getId = function(key) {
	var id_list = Object.create(null);
	
	Common.getId = function(key) {
		if ( id_list[key] === undefined ) {
			id_list[key] = 0;
		}
		
		return id_list[key]++;
	}
	
	return Common.getId(key);
}
Common.objToArray = function(obj) {
	let arr = [];
	for(let i in obj) {
		arr.push(obj[i]);
	}
	return arr;
}

const Message = require(APP_WEB_PUBLIC_DIR + "/app/message");


function currTimeMiliSec() {
	return (new Date()).getTime();
}
	
class Send {
	sendMsg(name, data) {
		
	}
}

const MAX_LOG_DATA_LENGTH = 1024*1024;
const MAX_WORKERS_DATA_LENGTH = 1024*1024;
const MAX_WORKERS_RESULT_DATA_LENGTH = 1024*1024;

class MessageData {
	constructor(msgName, maxLen) {
		maxLen = maxLen || (1024*1024);
		
		this.msgName = msgName;
		this.nextId = 0;
		this.data = "";
	}
	add(obj) {
		this.nextId++;
		
		let msg = (new Message()).writeMsg(this.msgName, obj);
		this.data += msg;
		
		return msg;
	}
	
	getNextId() {
		return this.nextId;
	}
	getData() {
		return this.data;
	}
}

class Stat {
	constructor() {
		this.socketIoList = [];
		
		this.logNextId = 0;
		this.logData = "";
		
		this.workerList = Object.create(null);
		this.workerListDeadData = "";
		
		this.resultJobNextId = 0;
		this.resultJobListData = "";
		
		this.jobs = new MessageData('jobs');
		
		this.statId = Common.randHex(16);
		
		this.poolList = Object.create(null);
		this.poolListDeadData = new MessageData('dead_pools');
	}

	timeToString(d) {
		return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
	}
	currTimeToString() {
		return this.timeToString(new Date());
	}
	
	addLog(text) {
		if ( this.logData.length >= MAX_LOG_DATA_LENGTH ) {
			this.logData = this.logData.substr(MAX_LOG_DATA_LENGTH>>1);
		}
		
		let id = this.logNextId++;

		let msg = (new Message()).writeMsg('log', [id, this.currTimeToString(), text]);
		this.logData += msg;

		this.sendAll('log', msg);
	}
	
	noty(type, text) {
		this.sendAll("noty", {type: type, text: text});
	}
	
	addWorkerDead(worker) {
		if ( this.workerListDeadData.length >= MAX_WORKERS_DATA_LENGTH ) {
			this.workerListDeadData = this.workerListDeadData.substr(MAX_WORKERS_DATA_LENGTH>>1);
		}
		
		let msg = (new Message()).writeMsg('dead_worker', worker);
		
		this.workerListDeadData += msg;
		
		this.sendAll('dead_worker', msg);
	}

	sendWorker(id, socketIo) {
		let worker = this.workerList[id];
		if ( worker.alive ) {
			worker.time_in_work = (currTimeMiliSec() - worker.connection_time);
		}
		
		this.sendAll('worker_list', [worker], socketIo);
	}
	sendWorkerList(socketIo) {
		let workeArray = [];
		for(let i in this.workerList) {
			let worker = this.workerList[i];
			if ( worker.alive ) {
				worker.time_in_work = (currTimeMiliSec() - worker.connection_time);
			}
			
			workeArray.push(worker);
		}
		
		this.sendAll('worker_list', workeArray, socketIo);
	}

	addWorker(id, worker) {
		this.workerList[id] = {
			id: id,
			wallet_address: worker.user_wallet,
			pool_password: worker.pool_password,
			agent: worker.agent,
			ip: worker.socket.remoteAddress,
			port: worker.socket.remotePort,
			connection_time: currTimeMiliSec(),
			disconnection_time: null,
			time_in_work: 0,
			
			hash_rate_list: {},
			doneHashesCount: 0,
			
			alive: true,
		};
		
		this.sendWorker(id);
		
		this.noty("success", "Worker connected");
		
	}
	delWorker(id) {
		let worker = this.workerList[id];
		if ( worker ) {
			worker.disconnection_time = currTimeMiliSec();
			worker.time_in_work = (worker.disconnection_time - worker.connection_time);
			worker.alive = false;
			this.addWorkerDead(worker);
		
			this.noty("warning", "Worker disconnected");
		
			delete this.workerList[id];
		}
	}
	insDoneHashesCount(id, difficulty, time, hash_rate_list) {
		let worker = this.workerList[id];
		
		if ( !worker ) {
			return;
		}
		
		
		worker.hash_rate_list = hash_rate_list;
		worker.doneHashesCount++;
		
		this.sendWorker(worker.id);
	}
	
	updateGlobalHashRate(statHashRate) {
		let hash_rate_list = {
			sec15: statHashRate.get(   15*1e3),
			sec60: statHashRate.get(   60*1e3),
			min5 : statHashRate.get( 5*60*1e3),
			min15: statHashRate.get(15*60*1e3),
			min30: statHashRate.get(30*60*1e3),
			min60: statHashRate.get(60*60*1e3),
		};
		
		this.sendAll('global_hash_rate', hash_rate_list);
	}
	
	addResultJob(params, isAccepted, errMsg) {
		if ( this.resultJobListData.length >= MAX_WORKERS_RESULT_DATA_LENGTH ) {
			this.resultJobListData = this.resultJobListData.substr(MAX_WORKERS_RESULT_DATA_LENGTH>>1);
		}
		
		let resJobInfo = {
			difficulty   : params.difficulty,
			endTime      : currTimeMiliSec(),
			timeOfWork   : params.time,
			is_accepted  : isAccepted,
			error_message: errMsg,
			worker_info  : params.workerInfo,
		};
		
		let id = this.resultJobNextId++;
		
		let msg = (new Message()).writeMsg('result_job_info', [id, resJobInfo]);
		this.resultJobListData += msg;
		
		this.sendAll('result_job_info', msg);
		
		this.noty("success", "Submit result job, difficulty " + Math.round(params.difficulty));
	}
	
	
	acceptedJob(job_id, difficulty, startNonce) {
		GB_Stat.noty("info", "Pool sent new job, difficulty " + difficulty.toFixed(2));
		
		let msg = this.jobs.add({
			id: this.jobs.getNextId(),
			job_id: job_id,
			difficulty: difficulty,
			start_time: currTimeMiliSec(),
			start_nonce: startNonce,
		});
		
		this.sendAll('jobs', msg);
	}
	
	
	poolConnect(id, host, port) {
		this.noty("success", "Connected to pool "+host+":"+port);
		
		this.poolList[id] = {
			id: id,
			host: host,
			port: port,
			
			time_in_work: 0,
			connection_time: currTimeMiliSec(),
			disconnection_time: null,
			
			job_count: 0,
			accepted_result: 0,
			rejected_result: 0,
			disconnection_error: "",
			
			alive: true,
		};
		
		this.sendAll("pools", Common.objToArray(this.poolList));
	}
	poolDisconnect(id, error) {
		if ( !this.poolList[id] ) {
			return;
		}
		
		this.noty("error", "Disconnected pool");
		
		let pool = this.poolList[id];
		
		delete this.poolList[id];
		
		pool.alive = false;
		pool.disconnection_time = currTimeMiliSec();
		pool.time_in_work = currTimeMiliSec() - pool.connection_time;
		
		this.poolListDeadData.add(pool);
		this.sendAll("pools", [pool]);
		
	}
	poolAcceptedJob(id) {
		if ( !this.poolList[id] ) {
			return;
		}
		let pool = this.poolList[id];
		
		pool.job_count++;
		pool.time_in_work = currTimeMiliSec() - pool.connection_time;
		
		this.sendAll("pools", [pool]);
	}
	poolAcceptedResult(id) {
		if ( !this.poolList[id] ) {
			return;
		}
		let pool = this.poolList[id];
		
		pool.accepted_result++;
		pool.time_in_work = currTimeMiliSec() - pool.connection_time;
		
		this.sendAll("pools", [pool]);
	}
	poolRejectedResult(id) {
		if ( !this.poolList[id] ) {
			return;
		}
		let pool = this.poolList[id];
		
		pool.rejected_result++;
		pool.time_in_work = currTimeMiliSec() - pool.connection_time;
		
		this.sendAll("pools", [pool]);
	}
	
	
	
	setEventsSocketIo(socketIo) {
		socketIo.on('logs', () => {
			socketIo.emit('log', this.logData);
		});
		
		socketIo.on('dead_worker', () => {
			socketIo.emit('dead_worker', this.workerListDeadData);
		});
		
		socketIo.on('result_job_info', () => {
			socketIo.emit('result_job_info', this.resultJobListData);
		});
		
		socketIo.on('jobs', () => {
			this.sendAll('jobs', this.jobs.getData());
		});
		
		socketIo.on('dead_pools', () => {
			this.sendAll('dead_pools', this.poolListDeadData.getData());
			this.sendAll("pools", Common.objToArray(this.poolList));
		});
		
		this.sendWorkerList(socketIo);
	}
	
	addSocketIo(socketIo) {
		socketIo.emit("stat_id", this.statId);
		
		this.socketIoList.push(socketIo);
		this.setEventsSocketIo(socketIo);
	}
	
	
	sendAll(name, data, socketIo) {
		if ( socketIo ) {
			socketIo.emit(name, data);
			return;
		}

		this.socketIoList.forEach((v) => v.emit(name, data));
	}
}
let GB_Stat = new Stat();

class StatHashRate {
	constructor(ARRAY_COUNT) {
		ARRAY_COUNT = ARRAY_COUNT | 10000;

		this.time = null;

		this.nextIndex = 0;
		this.ARRAY_COUNT = ARRAY_COUNT;
		this.count_list = new Uint32Array(ARRAY_COUNT);
		this.timeDivDifficulty_list = new Float64Array(ARRAY_COUNT);
		this.time_list = new Float64Array(ARRAY_COUNT);

		for(let i = 0; i < this.time_list.length; i++) {
			this.time_list[i] = 0;
		}
	}

	frame(difficulty, count) {
		count = count || 0;
		
		if ( !this.time ) {
			this.time = currTimeMiliSec();
			return;
		}
		
		let currTime = currTimeMiliSec();

		this.count_list[this.nextIndex] = count;
		this.timeDivDifficulty_list[this.nextIndex] = (currTime - this.time)/difficulty;
		this.time_list[this.nextIndex] = currTime;
		
		this.nextIndex++;
		
		this.time = currTime;
	}
	
	_index(index) {
		while( index < 0 ) {
			index += this.ARRAY_COUNT;
		}
		
		return index % this.ARRAY_COUNT;
	}
	
	get(intervalMiliSec) {
		let sumCount = 0;
		let sumTimeDivDifficulty = 0;

		let maxTime = null;
		
		let maxTimeIndex = null;
		for(let i = this.nextIndex - 1; ; i--) {
			let index = this._index(i);
	
			let time = this.time_list[index];

			if ( time < 1 ) {
				return null;
			}
			
			if ( index === maxTimeIndex ) {
				return null;
			}
			
			if ( maxTime === null ) {
				maxTime = time;
				maxTimeIndex = index;
			}
			
			sumCount += this.count_list[index];
			sumTimeDivDifficulty += this.timeDivDifficulty_list[index];
			
			if ( (maxTime - time) > intervalMiliSec ) {
				return ((1e3 * sumCount) / sumTimeDivDifficulty);
			}
		}
	}
}

const STRATUM_PROXY_SERVER_RECONNECT_INTERVAL = 5e3;
const STRATUM_PROXY_CLIENT_RECONNECT_INTERVAL = 5e3;
const HTTP_SERVER_RECONNECT_INTERVAL = 5e3;

class StratumProxy {
	constructor(options, logger) {
		this.logger = new Logger(logger, "STRATUM-PROXY");
		
		this.options = options;
		
		[this.pool_host  , this.pool_port  ] = this.addressEx(this.options.pool_address);

		[this.server_host, this.server_port] = this.addressEx(this.options.server_address);
		
		this.stratumClient = null;
		this.stratumServer = null;

		this.worker_seq = 0;
		
		this.job = null;
		
		this._jobs = {};
		
		this.serverFrame();
		
		this.clientFrame();
		
		setInterval(() => {
			if ( this.stratumServer ) {
				this.stratumServer.showStat();
			}
		}, TIMEINTERVAL_SHOW_STAT);
	}

	serverFrame() {
		this.stratumServer = new StratumServer(
			this.server_host, 
			this.server_port, 
			this.getJobForWorker.bind(this), 
			this.submitJob.bind(this), 
			() => setTimeout(this.serverFrame.bind(this), STRATUM_PROXY_SERVER_RECONNECT_INTERVAL), 
			this.logger
		);
	}
	
	clientFrame() {
		this.logger.notice("Pool address   > " + Logger.LOG_COLOR_MAGENTA + this.pool_host + ":" + this.pool_port);
		this.logger.notice("Pool password  > " + Logger.LOG_COLOR_MAGENTA + this.options.pool_password);
		this.logger.notice("Wallet address > " + Logger.LOG_COLOR_MAGENTA + this.options.wallet_address);

		this.stratumClient = new StratumClient(
			this.pool_host, 
			this.pool_port, 
			this.options.pool_password, 
			this.options.wallet_address, 
			this.setJob.bind(this), 
			() => setTimeout(this.clientFrame.bind(this), STRATUM_PROXY_CLIENT_RECONNECT_INTERVAL),
			this.logger
		);
	}
	
	addressEx(address) {
		let m;
		if ( !(m = address.match(/([^\\/]*?)\s*\:\s*(\d+)/)) ) {
			this.logger.error("Change you config. Address is invalid")
			throw 0;
		}
		
		return [m[1], m[2]];
	}
	
	setJob(job) {
		this._jobs = {};
		
		this.job = job;
		
		this.worker_seq = 0;
		
		if ( this.stratumServer ) {
			this.stratumServer.updateJob();
		}
	}
	getJobForWorker() {
		if ( !this.job ) {
			return null;
		}
		
		let seq = this.worker_seq++;

		let copyJob = {
			job_id: this.job.job_id,
			target: this.job.target,
			blob: this.job.blob,
		};
		
		if ( !this.options.emu_nicehash ) {
			let nonceInt = Common.parseIntByHex(copyJob.blob.substr(39*2, 6)) | 0;

			nonceInt = (nonceInt + seq * NONCE_WORKER_DELTA) & 0xFFFFFF;
			
			let nonceHex = Common.revers2b("000000" + nonceInt.toString(16)).substr(0, 6);

			copyJob.blob = copyJob.blob.substr(0, 39*2) + nonceHex + copyJob.blob.substr(39*2 + 6);
		} else {
			let __offset_byte = 39*2 + 2*3;
	
			let _byteInt = parseInt(copyJob.blob.substr(__offset_byte, 2), 16)|0;
			let _byteHex = ("00" + (_byteInt + seq).toString(16)).slice(-2);
			
			copyJob.blob = copyJob.blob.substr(0, __offset_byte) + _byteHex + copyJob.blob.substr(__offset_byte + 2);
			
			//this.logger.dev("Emu nicehash start nonce: " + copyJob.blob.substr(39*2, 8));
		}

		this.logger.dev("Start hex-nonce for worker [seq: " + seq + "] "+copyJob.blob.substr(39*2, 8));
		
		return copyJob;
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

class StratumRecv {
	constructor() {
		this.incoming_buf = "";
	}
	
	recv(buf, onRecvObj) {
		this.incoming_buf += buf.toString();

		try {
			this.incoming_buf = this.incoming_buf.replace(/[^\r\n]*[\r\n]/g, (m) => {
				m = m.trim();
				if ( m.length ) {
					onRecvObj(JSON.parse(m));
				}
				return "";
			});
		} catch(e) {
			this.incoming_buf = "";
			return false;
		}

		return true;
	}
}
class StratumServer {
	constructor(host, port, cbGetJob, cbSetResultJob, cbClose, logger) {
		this.logger = new Logger(logger, "STRATUM-SERVER-LISTENING");
		
		this.cbGetJob = cbGetJob;
		this.cbSetResultJob = cbSetResultJob;
		this.cbClose = cbClose;

		this.socket = require('net').createServer(this.onClient.bind(this));
		
		this.job = null;
		this.workerNextId = 0;
		this.workerList = Object.create(null);
		
		this.host = host;
		this.port = port;
		
		this.setEvents();
	}
	
	setEvents() {
		this.socket.on("error", (e) => {
			this.logger.error('An error has occurred ' + (e.code ? e.code : ""));
			this.close();
		});
		
		this.socket.on("listening", () => {
			this.logger.success("Opened server on \""+this.host+':'+this.port+'"' );
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
		let list = [];
		for(let i in this.workerList) { list.push(this.workerList[i]); }
		for(let i in list) { list[i].close(); }
		
		this.socket.close();
		this.logger.close();
		this.cbClose();

		this.cbGetJob = (()=>null);
		this.cbSetResultJob = (()=>null);
		this.cbClose = (()=>null);
	}

	onClient(socket) {
		let workerId = this.workerNextId++;
		
		this.workerList[workerId] = new StratumServerClient(socket, workerId, this.cbGetJob, (resultJob, params) => {
			this.resultJobPrepare(this.workerList[workerId], resultJob, params);
		}, () => {
			delete this.workerList[workerId];
		}, this.logger);
	}

	resultJobPrepare(worker, job, params) {
		this.cbSetResultJob(job, params);
	}

	updateJob() {
		for(let i in this.workerList) {
			this.workerList[i].updateJob();
		}
	}

	showStat() {
		this.logger.notice("Workers count: " + Object.keys(this.workerList).length);
		for(let i in this.workerList) {
			this.workerList[i].logger.notice("Agent: " + this.workerList[i].agent.substr(0, 32) + "...");
		}
	}
}
class StratumServerClient {
	constructor(socket, id, cbGetJob, cbSetResultJob, cbClose, logger) {
		this.id = id;
		this.wid = "wid" + this.id;
		
		this.logger = new Logger(logger, "WORKER #"+this.id+"");

		this.cbGetJob = cbGetJob;
		this.cbSetResultJob = cbSetResultJob;
		this.cbClose = cbClose;
		
		this.socket = socket;
		
		this.incoming = new StratumRecv();

		this.pool_password = "";
		this.user_wallet   = "";
		
		this.state = StratumServerClient.STATE_NO_LOGIN;
		
		this.isSendJob = false;
		
		this.logger.notice(`Accepted worker`);
		
		this.agent = "";
		
		this.STATcurrentJob = {};
		this.STAT = {
			hashRate: null,
			resultJobCount: 0,
			timeDivDifficulty: 0,
		};
		
		this.statHashRate = new StatHashRate();
		
		this.startTime = currTimeMiliSec();

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
		GB_Stat.delWorker(this.id);

		this.socket.end();
		this.logger.notice("Disconnected...");
		this.logger.close();
		this.cbClose();

		this.cbGetJob = (()=>null);
		this.cbSetResultJob = (()=>null);
		this.cbClose = (()=>null);
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
				this.user_wallet   = obj.params.login;
				this.pool_password = obj.params.pass;
				this.agent         = obj.params.agent;
			}
			
			let job = this.cbGetJob();
			if ( !job ) {
				this.sendResult(resultId, null, "Proxy server is not ready");
				this.logger.error("Send error: Proxy server is not ready");
				this.close();
				return;
			}

			this.STAT_startJob(job);
			
			this.sendResult(resultId, {
				id: this.wid,
				job: job,
				status: "OK"
			});
			
			this.state = StratumServerClient.STATE_NORMAL;
			
			let agent = (this.agent || "").substr(0, 16) + "...";
			
			this.logger.success(`${this.socket.remoteAddress}:${this.socket.remotePort} / ${agent}`);
			
			this.statHashRate.frame();

			GB_Stat.addWorker(this.id, this);
			
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
				
		
				this.statHashRate.frame(this.STATcurrentJob.difficulty, 1);
				this.STAT_endJob(obj.params);
				
				let hash_rate_list = {
					sec15: this.statHashRate.get(   15*1e3),
					sec60: this.statHashRate.get(   60*1e3),
					min5 : this.statHashRate.get( 5*60*1e3),
					min15: this.statHashRate.get(15*60*1e3),
					min30: this.statHashRate.get(30*60*1e3),
					min60: this.statHashRate.get(60*60*1e3),
				};
				
				GB_Stat.insDoneHashesCount(this.id, this.STATcurrentJob.difficulty, this.STATcurrentJob.time, hash_rate_list);
		
				this.logger.notice(`Result job [nonce: ${obj.params.nonce}]`);
				this.cbSetResultJob(obj.params, {
					difficulty: this.STATcurrentJob.difficulty, 
					time: this.STATcurrentJob.time,
					hash_rate: this.STAT.hashRate,
					hash_rate_list: hash_rate_list,
					workerInfo: {
						wallet_address: this.user_wallet,
						pool_password: this.pool_password,
						agent: this.agent,
						ip: this.socket.remoteAddress,
						port: this.socket.remotePort,
						id: this.id,
						job_id: obj.params.job_id,
						job_nonce: obj.params.nonce,
					}
				});
				
				
				this.STAT_resetTime();
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
		this.STAT_startJob(job);
		this.statHashRate.frame(this.STATcurrentJob.difficulty, 0);

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

	STAT_update() {
		if ( this.STATcurrentJob.startTime ) {
			this.STAT.timeDivDifficulty += (currTimeMiliSec() - this.STATcurrentJob.startTime) / this.STATcurrentJob.difficulty;
			this.STAT.hashRate = (1e3*this.STAT.resultJobCount / this.STAT.timeDivDifficulty);
		}
	}
	STAT_startJob(job) {
		this.STAT_update();
		
		let targetInt = Common.parseIntByHex(job.target);
		let difficulty = 0xFFFFFFFF / targetInt;
		this.STATcurrentJob = {
			startTime: currTimeMiliSec(),
			target: job.target,
			targetInt: targetInt,
			difficulty: difficulty,
		};
		
	}
	STAT_resetTime() {
		if ( typeof this.STATcurrentJob === 'object' ) {
			this.STATcurrentJob.startTime = currTimeMiliSec();		
		}
	}
	STAT_endJob() {
		this.STAT.resultJobCount++;
		this.STAT_update();

		if ( typeof this.STATcurrentJob === 'object' ) {
			this.STATcurrentJob.endTime = currTimeMiliSec();
			this.STATcurrentJob.time = this.STATcurrentJob.endTime - this.STATcurrentJob.startTime;
		}

	}
	
	updateJob() {
		let job = this.cbGetJob();
		if ( job ) {
			this.sendJob(job);
		}
	}
	
}
StratumServerClient.STATE_NO_LOGIN = 1;
StratumServerClient.STATE_NORMAL = 2;

class StratumClient {
	constructor(pool_host, pool_port, pool_password, user_wallet, onAcceptJob, onDisconnect, logger) {
		this.pool_host     = pool_host;
		this.pool_port     = pool_port;
		this.pool_password = pool_password;
		this.user_wallet   = user_wallet;
		
		this.onAcceptJob   = onAcceptJob || (() => {});

		this.logger = new Logger(logger, "STRATUM-CLIENT");
		
		this.incoming = new StratumRecv();
		
		this.socket = null;
		
		this.onAcceptJob = onAcceptJob;
		this.onDisconnect = onDisconnect;
		
		this.USER_AGENT = "JerryPROXY-STRATUM~XMR";
		
		this.job = null;
		
		this.no_login = true;
		
		this.connected = false;
		this.disconnected = false;
		this.isClose = false;
		
		this.target = null;
		
		this.sendSeq = 1;
		this.expectedResult = Object.create(null);
		
		this.statHashRate = new StatHashRate();
		
		this.__id = Common.getId("StratumClient");
		
		this.connect();
		
		this._intervalId = setInterval(() => {
			for(let i in this.expectedResult) {
				if ( this.expectedResult[i].startTime + this.expectedResult[i].timeoutMiliSec < currTimeMiliSec() ) {
					this.logger.error("Poole did not send the result. Timeout error");
					this.disconnect();
					return;
				}
			}
		}, 1000);
		
	}

	connect() {
		this.logger.notice("Attempting to connect to "+Logger.LOG_COLOR_MAGENTA_LIGHT+"\""+this.pool_host+':'+this.pool_port+'"');
		
		this.socket = require('net').createConnection({
			host: this.pool_host,
			port: this.pool_port,
		});
		
		
		this.setEvents();
	}
	
	disconnect() {
		GB_Stat.poolDisconnect(this.__id, "");
		
		if ( this.socket ) {
			this.socket.end();
			this.socket = null;
			this.onDisconnect();
		}
		
		if ( this._intervalId !== null ) {
			clearInterval(this._intervalId);
			this._intervalId = null;
		}
		
		this.connected = false;
		this.disconnected = true;
		this.isClose = true;
	}
	
	setEvents() {
		this.socket.on('connect', () => {
			this.connected = true;
			
			this.logger.success('Connected to "'+this.pool_host+':'+this.pool_port+'"');

			this.sendMethod("login", {
				agent: this.USER_AGENT,
				login: this.user_wallet,
				pass : this.pool_password,
			}, (errorTimeout, obj) => {
				
				if ( errorTimeout ) {
					this.logger.error('The pool did not send the result for the specified time. Timeout error');
					this.disconnect();
					return;
				}

				if ( obj.error ) {
					this.logger.error('Poole sent a bug "'+(obj.error.message?obj.error.message:'')+'"');
					this.disconnect();
					return;
				}			
				
				if ( obj.result ) {
					if ( !this._checkParamString(obj.result.id, 1, 256) ) {
						this.logger.error('The pool sent the wrong ID format');
						this.disconnect();
						return;
					}
					
					this.id = obj.result.id;	
					this.parseJob(obj.result.job);
				} else {
					this.logger.error('Poole sent a invalid message');
					this.disconnect();
				}
				
			}, 1e3*2);
			
			GB_Stat.poolConnect(this.__id, this.pool_host, this.pool_port);
		});
		
		this.socket.on('data', (data) => {
			if ( !this.incoming.recv(data, this.recvFrameObject.bind(this)) ) {
				this.logErrorClSv("Client send bad json");
				this.disconnect();
			}
		});
		
		this.socket.on('end', () => {
			this.logger.error('The server disconnected the connection');
			this.disconnect();
		});
		
		this.socket.on('error', (e) => {
			this.logger.error('An error has occurred ' + (e.code ? e.code : ""));
			this.disconnect();
		});
		
		this.socket.on('timeout', () => {
			this.logger.error('Timeout error');
			this.disconnect();
		});
	}
	
	sendObj(obj, cbResult, timeoutMiliSec, resParams) {
		obj.id = this.sendSeq++;
		
		if ( cbResult ) {
			this.expectedResult[ obj.id ] = {
				startTime: currTimeMiliSec(),
				timeoutMiliSec: timeoutMiliSec || 1e3,
				cbResult: cbResult,
				resParams: resParams,
			};
		}
		
		this.socket.write( JSON.stringify(obj) + '\n' );
	}
	sendMethod(method, params, cbResult, timeoutMiliSec, resParams) {
		this.sendObj({
			method: method,
			params: params
		}, cbResult, timeoutMiliSec, resParams);
	}
	
	recvFrameObject(obj) {
		if ( typeof obj !== 'object' ) {
			this.logger.error('Poole sent invalid raw json');
			this.disconnect();
			return;
		}
		
		if ( (typeof obj.id === 'string' || typeof obj.id === 'number') && ( parseInt(obj.id).toString() === obj.id.toString() ) ) {
			let expectedObj = this.expectedResult[obj.id];
			if ( !expectedObj ) {
				this.logger.error('Poole sent a obj, result is not expected');
				this.disconnect();
				return;
			}
			
			delete this.expectedResult[obj.id];
			
			expectedObj.cbResult(false, obj, expectedObj.resParams);
			return;
		}
	
		if ( obj.error ) {
			this.logger.warning('Poole sent a bug "'+(obj.error.message?obj.error.message:'')+'"');
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
		
		if ( obj.result ) {
			if ( obj.result.status.length ) {
				this.logger.notice(Logger.LOG_COLOR_GREEN_LIGHT + "Pool has sent the status \""+ obj.result.status + "\"");
			}
		}		
	}
	
	parseJob(job) {
		if ( !job ) {
			this.logger.error('The pool sent the wrong JOB format');
			this.disconnect();
			return;
		}
		
		if ( !this._checkParamString(job.job_id, 1, 256) ) {
			this.logger.error('The pool sent the wrong JOB_ID format');
			this.disconnect();
			return;
		}
		
		if ( !this._checkParamString(job.blob, 76*2, 76*2) ) {
			this.logger.error('The pool sent the wrong JOB_BLOB format');
			this.disconnect();
			return;
		}
		
		if ( !this._checkParamString(job.target, 4*2, 4*2) ) {
			this.logger.error('The pool sent the wrong JOB_TARGET format');
			this.disconnect();
			return;
		}
		
		this.job = job;
		this.job.is_new = true;

		let target = Common.parseIntByHex(job.target);
		
		let difficulty = (0xFFFFFFFF / target);
		this.difficulty = difficulty;
		
		this.statHashRate.frame(this.difficulty, 0);
		
		GB_Stat.acceptedJob(this.job.job_id, difficulty, this.job.blob.substr(39*2, 8));
		GB_Stat.poolAcceptedJob(this.__id);
		
		this.logger.notice(Logger.LOG_COLOR_GREEN_LIGHT + "Accepted new job #" + this.jobIdToLog(job.job_id) + " difficulty " + difficulty.toFixed(2))
		
		if ( this.target !== target ) {
			this.target = target;
			this.logger.warning("Set difficulty to " + Logger.LOG_COLOR_MAGENTA + difficulty.toFixed(2))
		}
		
		this.onAcceptJob(this.job);
	}
	
	submitJob(job, params) {
		if ( this.job && (job.job_id === this.job.job_id) ) {
			this.statHashRate.frame(this.difficulty, 1);
			GB_Stat.updateGlobalHashRate(this.statHashRate);
			
			this.sendMethod("submit", {
				id    : this.id,
				job_id: job.job_id,
				nonce : job.nonce,
				result: job.result,
			}, (errorTimeout, obj) => {

				if ( obj.error ) {
					this.logger.warning('Poole sent a bug "'+(obj.error.message?obj.error.message:'')+'"');
					GB_Stat.addResultJob(params, false, obj.error.message?obj.error.message:'');
					GB_Stat.poolRejectedResult(this.__id, obj.error.message?obj.error.message:'');
					return;
				}
				
				if ( obj.result ) {
					if ( obj.result.status.length ) {
						this.logger.notice(Logger.LOG_COLOR_GREEN_LIGHT + "Pool has sent the status \""+ obj.result.status + "\"");
						GB_Stat.addResultJob(params, true);
						GB_Stat.poolAcceptedResult(this.__id);
					}
				}
				
			}, 2000);

			this.logger.notice(Logger.LOG_COLOR_GREEN_LIGHT + "Submit result job #" + this.jobIdToLog(job.job_id) + " nonce " + job.nonce);
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

class HttpServer {
	
	constructor(host, port, cbClose, logger) {
		this.logger = new Logger(logger, "HTTP-SERVER");

		this.msg = new events.EventEmitter();
		
		this.host = host;
		this.port = port;
		
		this.cbClose = cbClose;
		
		this.socket = require('http').createServer((req, res) => {
			let pathName = url.parse(req.url).pathname;
			
			if ( !( pathName.match(/\.\./) || pathName.match(/[^a-zA-Z0-9_\-\.\/]/) ) ) {
				if ( pathName === "/" ) {
					pathName = "/index.html";
				}

				let ext = ( pathName.match(/\.([^\.]+)$/) || [""] )[1];

				let content_type = "text/plan";
				switch(ext) {
					case "js":
						content_type = "text/javascript"; 
						break;
					case "htm":
					case "html":
						content_type = "text/html"; 
						break;
					case "css":
						content_type = "text/css";
						break;
				}
				
				let absPath = APP_WEB_PUBLIC_DIR + pathName;
				
				fs.readFile(absPath, (err, data) => {
					if ( err ) {
						this.res404(res);
						return;
					}
			
				   res.writeHead(200, {'Content-type': content_type});
				   res.write(data);
				   res.end();
				});
				
				return;
			}

			this.res404(res);

		});
		
		this.setEvents();
	}
	
	close() {
		this.socket.close();
		this.cbClose();
	}

	setEvents() {
		this.socket.on("error", (e) => {
			this.logger.error('An error has occurred ' + (e.code ? e.code : ""));
			this.close();
		});
		
		this.socket.on("listening", () => {
			this.listening();
		});

		try {
			this.logger.notice("Attempting opened server on "+Logger.LOG_COLOR_MAGENTA_LIGHT+"\""+this.host+':'+this.port+'"');
			this.socket.listen(this.port, this.host);
		} catch(e) {
			this.logger.error('An error has occurred ' + (e.message ? e.message : ""));
			this.close();
		}
	}	
	
	listening() {
		this.logger.success("Opened server on \""+this.host+':'+this.port+'"' );
		
		socketIo.
		listen(this.socket).
		sockets.
		on('connection', function (socket) {
			GB_Stat.addSocketIo(socket);
		});		
	}
	
	res404(res) {
		res.writeHead(404, {'Content-type':'text/plan'});
		res.write('Page Was Not Found');
		res.end();
	}

}
HttpServer.loopStart = function(host, port, logger) {
	new HttpServer(host, port, () => setTimeout(() => {
		
		HttpServer.loopStart(host, port, logger);
		
	}, HTTP_SERVER_RECONNECT_INTERVAL), logger);
}


function getConfig(logger, path) {
	let config = null;
	
	try {
		let file = require('fs').readFileSync(path, 'utf8');
		
		eval('var _cfg = ' + file);

		config = _cfg;
	} catch(e) {
		config = null;
		logger.error("Config \"" + path + "\" not found, or config file invalid json");
	}
	
	return config;
}

function main(logger) {
	let cfg = getConfig(logger, CFG_PATH);
	
	if ( !cfg ) {
		setTimeout(() => main(logger), 5e3);
		return;
	}

	let http_addr_info = Common.addressEx(cfg.http_address);
	if ( http_addr_info ) {
		logger.success("Http server is powered on");
		HttpServer.loopStart(http_addr_info[0], http_addr_info[1], logger);
	} else {
		logger.warning("Http server is powered off");
	}
	
	
	new StratumProxy(cfg, logger);
}


const http = require('http');
const fs = require('fs');
const url = require('url');
const events = require('events');
const socketIo = require('socket.io');

1&&
main(
	new Logger((log) => {
		GB_Stat.addLog(log);
		let d = new Date();
		console.log(`[${d.toLocaleDateString()} ${d.toLocaleTimeString()}] ${log}`);
	}, "APP")
);

/***********************************/




//let httpSv = new HttpServer();






setInterval(() => {
	//GB_Stat.addLog("My log = " + Math.random())
}, 1e3)

