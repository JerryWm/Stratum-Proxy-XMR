define([], function() {
	
		Vue.component("settings-pool", {
			template: `
				<div style="margin: 5px" class="settings-pool-cnt row" >
					<div>
					
						<div class="btn-toolbar" role="toolbar" aria-label="Toolbar with button groups">
							<div class="btn-group" role="group" >
								<button type="button" class="btn btn-success" v-if="!pool_count" v-on:click="$emit('command', {cmd:'connect', id: id})" >Connect</button>
								<button type="button" class="btn btn-danger" v-if="pool_count" v-on:click="$emit('command', {cmd:'disconnect', id: id})" >Disconnect</button>
								
								<span class="input-group-addon btn" v-on:click="pool_cfg_show = !pool_cfg_show">{{ pool_address }}</span>
								
					
								<button type="button" class="btn btn-danger" v-on:click="$emit('command', {cmd:'remove_pool', id: id})" >X</button>
							</div>
						</div>
						
						<div v-show="pool_cfg_show" class="settings-pool" >
						
							<div class="input-group input-group-sm col-xs-4">
							  <span class="input-group-addon" >Address</span>
							  <input type="text" class="form-control" placeholder="Pool address" aria-describedby="sizing-addon3" v-model.trim="pool_address" >
							</div>
						
							<div class="input-group input-group-sm col-xs-4">
							  <span class="input-group-addon" >Wallet</span>
							  <input type="text" class="form-control" placeholder="Wallet address" aria-describedby="sizing-addon3" v-model.trim="wallet_address" >
							</div>
						
							<div class="input-group input-group-sm col-xs-4">
							  <span class="input-group-addon" >Password</span>
							  <input type="text" class="form-control" placeholder="Pool password" aria-describedby="sizing-addon3" v-model.trim="pool_password" >
							</div>
						
							<div class="settings-pool-sm-options" style="display: inline-flex;"  >
								<div class="input-group input-group-sm " style="" >
									<span class="input-group-addon btn" v-on:click="keepalive_enable=!keepalive_enable" >Keep alive time</span>
									<span class="input-group-addon btn" ><input type="checkbox" class="btn" v-model="keepalive_enable" ></span>
									<input class="form-control" placeholder="sec" type="number"  style="width: 60px; "  
										v-model.trim="keepalive"  
										v-bind:disabled="!keepalive_enable" 
									>
								</div>
							
								<div class="input-group input-group-sm  "  style=""  >
									<span class="input-group-addon btn" v-on:click="emu_nicehash=!emu_nicehash" >Emu nicehash</span>
									<span class="input-group-addon btn" ><input type="checkbox" class="btn" v-model="emu_nicehash" ></span>
								</div>
								
								<div class="input-group input-group-sm  "  style=""  >
									<span class="input-group-addon" >Max workers</span>
									<input class="form-control" placeholder="" type="number"  style="width: 60px" v-model="max_workers" min="1" max="256" >
								</div>
								
								<div class="input-group input-group-sm  "  style=""  >
									<span class="input-group-addon" >Retry count connect</span>
									<input class="form-control" placeholder="" type="number"  style="width: 60px" v-model="retry_count_connect" min="0" >
								</div>
								
								<div class="input-group input-group-sm  "  style=""  >
									<button class="btn" v-on:click="savePool()">Save</button>
								</div>
							</div>
						</div>
					</div>
				</div>	
			`,
			
			props: ["id", "pool_address", "wallet_address", "pool_password", "keepalive", "keepalive_enable", "pool_count", "emu_nicehash", "max_workers", "retry_count_connect"],
			
			data: function() {
				return {
					pool_cfg_show: false
				}
			},
			
			methods: {
				savePool: function(id) {
					this.$emit('command', {cmd:'save_pool', 
						id: this.id,
						pool: {
							pool_address       : this.pool_address,
							wallet_address     : this.wallet_address,
							pool_password      : this.pool_password,
							keepalive          : this.keepalive_enable ? this.keepalive : null,
							emu_nicehash       : this.emu_nicehash,
							max_workers        : this.max_workers,
							retry_count_connect: this.retry_count_connect,
						},
						pool2: this
					});
				}, 
			}
		});
		
});