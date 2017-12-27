define(["app/Common", "app/CommonView", "app/UnPackArray"], function(Common, CommonView, UnPackArray) {

	function Settings(socketIo) {
		var self = this;

		this.pools = [];
		
		this.socketIo = socketIo;

		
		this.vmSettingsPools = new Vue({
			el: "#app-settings",
			data: {
				pools: [],
			},
			methods: {
				updatePool: function(pool) {
					if ( this.pools[pool.id] ) {
						this.pools[pool.id] = pool;
					}
					
					self.socketIo.emit("control:settings:pools:change", this.pools);
				},
				
				onCommandPool: function(cmdInfo) {
					switch(cmdInfo.cmd) {
						case "connect":
							self.socketIo.emit("control:command:pool:connect", cmdInfo.id);
							break;
							
						case "disconnect":
							self.socketIo.emit("control:command:pool:disconnect", cmdInfo.id);
							break;
							
						case "remove_pool":
							if ( this.pools[cmdInfo.id] ) {
								this.pools.splice(cmdInfo.id, 1);
							}
							
							self.socketIo.emit("control:settings:pools:change", this.pools);
							break;
							
						case "add_pool":
							this.pools.push({
								pool_address: "stratum+tcp://127.0.0.1:2222",
								wallet_address: "my-wallet",
								pool_password: "x",
								emu_nicehash: false,
								keepalive: null,
								max_workers: 100,
							});
							
							self.socketIo.emit("control:settings:pools:change", this.pools);
							break;
							
						case "save_pool":
							if ( this.pools[cmdInfo.id] ) {
								this.pools[cmdInfo.id] = cmdInfo.pool;
								self.socketIo.emit("control:settings:pools:change", this.pools);
							}
							break;
					}
				}
			}
		});		
	
		socketIo.on("control:settings:pools", function(pools) {
			self.pools = pools;

			self.vmSettingsPools.pools  = [];
			
			for(var i in pools) {
				var pool = pools[i];
				
				if ( pool.pool_count === undefined ) {
					pool.pool_count = 0;
				}
				
				self.vmSettingsPools.pools.push(pool);
				
				({
					pool_address       : pool.pool_address || "",
					wallet_address     : pool.wallet_address || "",
					pool_password      : pool.pool_password,
					max_workers        : pool.max_workers,
					keepalive          : pool.keepalive,
					emu_nicehash       : pool.emu_nicehash,
					retry_count_connect: pool.retry_count_connect,
					
					pool_count         : pool.pool_count || 0,
				});
			}
		});
	
		socketIo.on("control:command:pool:disconnect", function() {
			for(var i in self.vmSettingsPools.pools) {
				self.vmSettingsPools.pools[i].pool_count = 0;
			}
		});
		
		socketIo.on("control:command:pool:connect", function(poolIndex) {
			if ( self.vmSettingsPools.pools[poolIndex] ) {
				self.vmSettingsPools.pools[poolIndex].pool_count = 1;
			}
		});
		
		window.wm=self.vmSettingsPools;
	}

	
	return Settings;

});