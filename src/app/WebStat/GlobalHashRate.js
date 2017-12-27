
const Common = require("../Common");
const PackArray = require("../PackArray");
const WebStatBase = require("./WebStatBase");
const HashRate = require("./../HashRate");

class GlobalHashRate extends WebStatBase {
	constructor(events) {
		super(events);
		
		this.hashrate_obj = {};
		
		this.hash_count = 0;
		this.hashRate = new HashRate.HashRate();
		this.hashRateLast = new HashRate.HashRateLast(100);
		
		events.on("web:server:connect_web_socket", (socket) => {
			this._webUpdate(socket);
		});

		events.on("stratum:client:accepted_share", this.poolAcceptedShare.bind(this));
	}
	_webUpdate(socket) {
		this.hashrate_obj = this.hashRate.getHashRate([5, 10, 15, 30, 60, 60*2, 60*3, 60*6, 60*12, 60*24, "all"]);
		this.hashrate_obj["current"] = this.hashRateLast.getHashRate();
		
		this.webEmit("global_hashrate", [this.hashrate_obj], socket);
	}

	poolAcceptedShare(origPool, share) {
		this.hash_count += share.difficulty;
		
		this.hashRate.addResultJob(this.hash_count);
		this.hashRateLast.addResultJob(this.hash_count);
		
		this._webUpdate();
	}


	
}

module.exports = GlobalHashRate;