
const Logger = require("./Logger");
const Common = require("./Common");

const DEF_POOL_RESPONSE_TIMEOUT = 30;
const DEF_POOL_KEEPALIVE = 0;

class StratumConfig {
	constructor(logger, cfg) {
		this.logger = logger;
		this.valid = this.parseConfig(cfg);
	}

	parseInteger(val, def, min, max) {
		if ( val === undefined ) {
			val = def;
		}
		val = parseInt(val);
		
		if ( isNaN(val) ) {
			val = def;
		}
		
		if ( min !== undefined ) { if ( val < min ) { val = min; } }
		if ( max !== undefined ) { if ( val > max ) { val = max; } }
		
		return val;
	}
	parseConfig(pool_info) {
		this.pool_password = pool_info.pool_password;
		this.wallet_address = pool_info.wallet_address;
		if ( !this.wallet_address.length ) {
			this.logger.error("Invalid wallet address");
			return false;
		}

		this.keepalive = this.parseInteger(pool_info.keepalive, DEF_POOL_KEEPALIVE, 0, 999999999) * 1e3;

		this.response_timeout = this.parseInteger(pool_info.response_timeout, DEF_POOL_RESPONSE_TIMEOUT, 1, 999999999) * 1e3;
		
		if ( !this.parseConfigPoolAddress(pool_info.pool_address) ) {
			return false;
		}
		
		return true;
	}
	parseConfigPoolAddress(_pool_address) {
		this.pool_address = _pool_address;
		
		let pool_address = _pool_address;
		if ( !pool_address.length ) {
			this.logger.error("Invalid pool address");
			return false;
		}
		
		pool_address = pool_address.replace(/^stratum\+/i, "");
		
		pool_address = pool_address.replace(/^tcp\:\/\//i, "");

		this.ssl = false;
		let m_list = [/^ssl\:\/\//i, /^tls\:\/\//i];
		for(let rg of m_list) {
			if ( pool_address.match(rg) ) {
				pool_address = pool_address.replace(rg, "");
				this.ssl = true;
			}
		}
		
		let tmphp = Common.addressEx(pool_address);
		if ( !tmphp ) {
			this.logger.error("Invalid pool address \"" + _pool_address + "\"");
			return false;
		}
		[this.host, this.port] = tmphp;
		return true;
	}
}

module.exports = StratumConfig;
