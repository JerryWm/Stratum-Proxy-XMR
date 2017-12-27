define(["app/Common", "app/CommonView", "app/UnPackArray"], function(Common, CommonView, UnPackArray) {

	function PoolList($poolList, socketIo) {
		this.$poolList = $poolList;
		this.dataTable = this.$poolList.DataTable();

		this.poolList = Object.create(null);
		
		var self = this;
		
		socketIo.on("pools", function(pools) {
			self.listProcess(pools);
		});
		socketIo.on("poolsArchive", function(poolsArchive) {
			self.listProcess(UnPackArray(poolsArchive).list);
		});

		socketIo.on("pool_info_mini", function(poolInfo) {
			self.updateMini(poolInfo);
		});
	}
	PoolList.prototype.updateMini = function(data) {
		var poolWrap = this.poolList[data[0]];
		if ( !poolWrap ) { return; }
		var pool = poolWrap.poolInfo;
		
		var map = {
			1: "difficulty",
			2: "worker_count",
			3: "accepted_job_count" ,
			4: "accepted_share_count",
			5: "rejected_share_count",
			6: "hash_count",
			7: "share_count",
			8: "ping",
			9: "hashrate",
		};
		
		for(var i in map) {
			if ( data[i] == null || data[i] === undefined ) { continue; }
			
			pool[map[i]] = data[i];
		}
		
		this.syncPool(pool.id);
	}
	PoolList.prototype.addItem = function(item) {
		if ( this.poolList[item.id] === undefined ) {
			this.poolList[item.id] = {
				dtRowIndex: this.dataTable.row.add([0,0,0,0,0, 0,0,0,0,0, 0,0,0,]),
				poolInfo: item
			};
		} else {
			this.poolList[item.id].poolInfo = item;
		}
		
		item.__update_time = Common.currTimeMiliSec();
		
		this.syncPool(item.id);
	}
	PoolList.prototype.syncPool = function(id) {
		var poolWrap = this.poolList[id];
		if ( !poolWrap ) { return; }
		
		var pool = poolWrap.poolInfo;

		var disconnectTimeSpan = CommonView.viewDisconnectTime(pool.disconnection_time, pool.disconnection_error);
		
		this.dataTable.row(poolWrap.dtRowIndex).data([
			`<span tabindex="0"   style="cursor: pointer; text-shadow: -3px -2px 5px; text-decoration: none;"  event-click="pool_info" pool_id="${parseInt(pool.id)}">${parseInt(pool.id)}</span>`,
				
			`<span tabindex="0"   style="cursor: pointer; text-shadow: -3px -2px 5px; text-decoration: none;"  event-click="pool_info" pool_id="${parseInt(pool.id)}">${Common.escapeHtml(pool.pool_address)}</span>`,
			
			Common.intOrNA(pool.difficulty),
			Common.intOrNA(pool.worker_count),
			Common.intOrNA(pool.accepted_job_count),
			Common.intOrNA(pool.accepted_share_count),
			Common.intOrNA(pool.rejected_share_count),
			Common.intOrNA(pool.hash_count),
			
			CommonView.viewHashRate(pool.hashrate),
			
			Common.intOrNA(pool.ping),
			
			CommonView.viewUpdateTime(pool.time_in_work, pool.__update_time, pool.alive),
		
			Common.miliSecToString(pool.connection_time),
			disconnectTimeSpan
		]);
		
		if ( !pool.alive ) {
			$(this.dataTable.row(poolWrap.dtRowIndex).node()).addClass("table-secondary").css({'color': '#121212'});
		}
	}
	PoolList.prototype.listProcess = function(list) {
		for(var i = 0; i < list.length; i++) {
			this.addItem(list[i]);
		}
		
		this.dataTable.draw();
	}
	
	PoolList.prototype.getHtmlPoolInfo = function(id, len) {
		len = len || 16;
		var html_pool_info = "";
		var pool_info = "";
		if ( id ) {
			var wrapperPool = this.poolList[id];
			if ( wrapperPool ) {
				var pool = wrapperPool.poolInfo;
				pool_info = "#" + pool.id + " " + pool.pool_address;
				html_pool_info = `
				<span  tabindex="0"  
					pool_id="${pool.id}"
					title="Pool info"
					style="cursor: pointer; text-shadow: -3px -2px 5px; text-decoration: none;" 
					event-click="pool_info"
				>
					${Common.escapeHtml(Common.stringNormalizeLen(pool_info, len))}
				</span>
				`;				
				
			}
		}

		return html_pool_info;
	}
	PoolList.prototype.getWorkerCount = function(id) {
		if ( id ) {
			var wrapperPool = this.poolList[id];
			if ( wrapperPool ) {
				return wrapperPool.poolInfo.worker_count;
			}
		}
		
		return null;
	}
	
	PoolList.prototype.popoverShowFullInfo = function(id, $elem) {
		var wrapperPool = this.poolList[id];
		if ( !wrapperPool ) { return null; }
		
		var pool = wrapperPool.poolInfo;

		var isUpdateTime = pool.alive ? "update_time" : "";
		
		pool._start_time = Common.currTimeMiliSec() - pool.time_in_work;
	
		var disconnectTimeSpan = CommonView.viewDisconnectTime(pool.disconnection_time, pool.disconnection_error);

		$elem.attr("tabindex", "0");
		$elem.attr("title", "Pool info");
		$elem.attr("data-trigger", "focus");
		$elem.attr("data-content", " ");
		$elem.attr("data-template", `
			<div class="popover" role="tooltip" style="max-width: none;">
				<div class="arrow"></div>
				<h3 class="popover-header"></h3>
				<div class="popover-body"></div>
				<div style="padding: 10px">
					<table class="table table-hover">
						<tr><td>Id</td><td>${Common.escapeHtml(pool.id)}</td></tr>
						<tr><td>Address</td><td>${Common.escapeHtml(pool.pool_address)}</td></tr>
						<tr><td>Wallet</td><td>${Common.escapeHtml(pool.wallet_address)}</td></tr>
						<tr><td>Password</td><td>${Common.escapeHtml(pool.pool_password)}</td></tr>
						<tr><td>Diff</td><td>${Common.intOrNA(pool.difficulty)}</td></tr>
						<tr><td>Workers</td><td>${Common.intOrNA(pool.worker_count)}</td></tr>
						
						<tr><td>Jobs</td><td>${Common.intOrNA(pool.accepted_job_count)}</td></tr>
						<tr><td>Accepted shares</td><td>${Common.intOrNA(pool.accepted_share_count)}</td></tr>
						<tr><td>Rejected shares</td><td>${Common.intOrNA(pool.rejected_share_count)}</td></tr>

						<tr><td>Hashes</td><td>${Common.intOrNA(pool.hash_count)}</td></tr>
						
						<tr><td>Hash rate</td><td>${CommonView.viewHashRateFull(pool.hashrate)}</td></tr>
						
						<tr><td>Ping(msec)</td><td>${Common.intOrNA(pool.ping)}</td></tr>
									
						<tr><td>Time in work</td><td>${CommonView.viewUpdateTime(pool.time_in_work, pool.__update_time, pool.alive)}</td></tr>
						
						<tr><td>Connection time</td><td>${Common.miliSecToString(pool.connection_time)}</td></tr>
						<tr><td>Disconnection time</td><td>${disconnectTimeSpan}</td></tr>
					</table>
				</div>
			</div>
		`);
				
		$elem.popover('show');
	}
	
	return PoolList;

});