
const Logger = require("./Logger");
const StratumConfig = require("./StratumConfig");
const WebStatBase = require("./WebStat/WebStatBase");

class WebControl extends WebStatBase {
	constructor(events, pools) {
		super(events);
		
		this.pools = pools;
		this.events = events;
		
		this.trySettingsPools();
		
		events.on("web:server:connect_web_socket", (socket) => {
			this.setEvents(socket);

			this.webEmit("control:settings:pools", this.pools, socket);
			
			for(let i in this.pools) {
				if ( this.pools[i].pool_count ) {
					this.webEmit("control:command:pool:connect", i, socket);					
				}
			}
			
		});
		
		this.disconnect_count = 0;
		events.on("stratum:client:disconnect", () => {
			if ( this.disconnect_count-- <= 0 ) {
				setTimeout(() => {
					for(let i in this.pools) {
						if ( this.pools[i].pool_count ) {
							this.poolConnect( (parseInt(i)+1) % this.pools.length );
							break;
						}
					}
				}, 0);
			}
		});
		
		this.poolConnect(0);
	}
	
	setEvents(socket) {
		socket.on("control:command:pool:connect", this.poolConnect.bind(this));
		socket.on("control:command:pool:disconnect", this.poolDisconnect.bind(this));

		socket.on("control:settings:pools:change", this.settingsPoolsChange.bind(this));
	}
	
	poolConnect(pool_index) {
		let pool = this.pools[pool_index];
		if ( !pool ) {
			return;
		}
		
		this.poolDisconnect();

		pool.pool_count = 1;
		
		this.webEmit("control:command:pool:connect", pool_index);

		this.disconnect_count = pool.retry_count_connect;
		
		this.events.emit("control:pool:connect", pool);
	}
	poolDisconnect() {		
		this.events.emit("control:pool:disconnect");
		
		for(let pool of this.pools) {
			pool.pool_count = 0;
		}		
		
		this.webEmit("control:command:pool:disconnect");
	}
	settingsPoolsChange(pools) {
		this.pools = pools;
		
		this.poolDisconnect();
		
		this.trySettingsPools();
		
		this.savePools();
		
		this.webEmit("control:settings:pools", this.pools);
	}
	
	trySettingsPools() {
		for(let pool of this.pools) {
			
			if ( pool.keepalive ) {
				pool.keepalive = parseInt(pool.keepalive) | 0;
				pool.keepalive = Math.max(pool.keepalive, 20);
			} else {
				pool.keepalive = null;
			}
			
			pool.emu_nicehash = !!pool.emu_nicehash;
			
			pool.max_workers = parseInt(pool.max_workers) | 0;
			pool.max_workers = Math.max(pool.max_workers, 1);
			pool.max_workers = pool.emu_nicehash ? 
				Math.min(pool.max_workers, 256) :
				Math.min(pool.max_workers, 100) ;
				
			if ( pool.retry_count_connect === null || pool.retry_count_connect === undefined ) {
				pool.retry_count_connect = 5;
			}
			
			pool.retry_count_connect = parseInt(pool.retry_count_connect) | 0;
			pool.retry_count_connect = Math.max(pool.retry_count_connect, 1);
			
			let logger = new Logger((msg) => {
				this.events.emit("web:noty:error", msg);
			});
			new StratumConfig(logger, pool);
		}
	}
	
	savePools() {
		let pools = [];
		for(let pool of this.pools) {
			pools.push({
				pool_address        : pool.pool_address,
				wallet_address      : pool.wallet_address,
				pool_password       : pool.pool_password,
				keepalive           : pool.keepalive,
				emu_nicehash        : pool.emu_nicehash,
				max_workers         : pool.max_workers,
				retry_count_connect : pool.retry_count_connect,
			});
		}
		
		this.events.emit("config:pools:save", pools);
	}
	
}

module.exports = WebControl;