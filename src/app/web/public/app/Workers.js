define(["app/Common", "app/CommonView", "app/UnPackArray"], function(Common, CommonView, UnPackArray) {

	function Workers($workers, socketIo, web) {
		this.$workers = $workers;
		this.dataTable = this.$workers.DataTable();
		this.web = web;
		
		this.workers = Object.create(null);
		
		var self = this;
		
		socketIo.on("workers", function(workers) {
			self.listProcess(workers);
		});
		socketIo.on("workersArchive", function(workersArchive) {
			self.listProcess(UnPackArray(workersArchive).list);
		});

		socketIo.on("worker_info_mini", function(workerInfo) {
			self.updateMini(workerInfo);
		});
	}
	Workers.prototype.updateMini = function(data) {
		var workerWrap = this.workers[data[0]];
		if ( !workerWrap ) { return; }
		var worker = workerWrap.info;
		
		var map = {
			1: "difficulty",
			2: "accepted_job_count" ,
			3: "accepted_share_count",
			4: "rejected_share_count",
			5: "hash_count",
			6: "share_count",
			7: "hashrate",
			8: "pool_id",
		};
		
		for(var i in map) {
			if ( data[i] == null || data[i] === undefined ) { continue; }
			
			worker[map[i]] = data[i];
		}
		
		this.syncWorker(worker.id);
	}
	Workers.prototype.addItem = function(item) {
		if ( this.workers[item.id] === undefined ) {
			this.workers[item.id] = {
				dtRowIndex: this.dataTable.row.add([0,0,0,0,0, 0,0,0,0,0, 0,0,0,0,0, 0,]),
				info: item
			};
		} else {
			this.workers[item.id].info = item;
		}
		
		item.__update_time = Common.currTimeMiliSec();
		this.syncWorker(item.id);
	}
	Workers.prototype.getHtmlPoolInfo = function(worker) {
		var html_pool_info = "";
		var pool_info = "";
		if ( worker.pool_id ) {
			var wrapperPool = this.web.pools.poolList[worker.pool_id];
			if ( wrapperPool ) {
				var pool = wrapperPool.poolInfo;
				pool_info = "#" + pool.id + " " + pool.pool_address;
				html_pool_info = `
				<span  tabindex="0"  pool_id="${pool.id}"
					title="Worker info"
					style="cursor: pointer; text-shadow: -3px -2px 5px; text-decoration: none;" 
					event-click="pool_info"
				>
					${Common.escapeHtml(Common.stringNormalizeLen(pool_info, 16))}
				</span>
				`;				
				
			}
		}

		return html_pool_info;
	}
	Workers.prototype.syncWorker = function(id) {
		var workerWrap = this.workers[id];
		if ( !workerWrap ) { return; }
		
		var worker = workerWrap.info;
		
		var disconnectTimeSpan = CommonView.viewDisconnectTime(worker.disconnection_time, worker.disconnection_error);
/**worker.hashrate["current"] = 10000;
worker.hashrate["5"] = 10000;
worker.hashrate["10"] = 10000;
worker.hashrate["15"] = 10000;
worker.hashrate["30"] = 10000;
worker.hashrate["60"] = 10000;
worker.hashrate["all"] = 10000;
*/
		this.dataTable.row(workerWrap.dtRowIndex).data([
			`<span    style="cursor: pointer; text-shadow: -3px -2px 5px; text-decoration: none;"  event-click="worker_info" worker_id="${parseInt(worker.id)}">${parseInt(worker.id)}</span>`,
						
			this.getHtmlPoolInfo(worker),
			Common.escapeHtml(worker.address),
			Common.escapeHtml(Common.stringNormalizeLen(worker.agent, 16)),
			Common.escapeHtml(Common.stringNormalizeLen(worker.wallet_address, 16)),
			Common.escapeHtml(Common.stringNormalizeLen(worker.pool_password, 16)),
			
			Common.intOrNA(worker.difficulty),
			Common.intOrNA(worker.accepted_job_count),
			Common.intOrNA(worker.accepted_share_count),
			Common.intOrNA(worker.rejected_share_count),
			
			Common.intOrNA(worker.share_count),
			Common.intOrNA(worker.hash_count),
			
			CommonView.viewHashRate(worker.hashrate),

			CommonView.viewUpdateTime(worker.time_in_work, worker.__update_time, worker.alive),
	
			Common.miliSecToString(worker.connection_time),
			disconnectTimeSpan
		]);
		
		if ( !worker.alive ) {
			$(this.dataTable.row(workerWrap.dtRowIndex).node()).addClass("table-secondary").css({'color': '#121212'});
		}
	}
	Workers.prototype.listProcess = function(list) {
		for(var i = 0; i < list.length; i++) {
			this.addItem(list[i]);
		}
		
		this.dataTable.draw();
	}
	Workers.prototype.popoverShowFullInfo = function(id, $elem) {
		var wrapperWorker = this.workers[id];
		if ( !wrapperWorker ) { return null; }
		
		var worker = wrapperWorker.info;
	
		var disconnectTimeSpan = CommonView.viewDisconnectTime(worker.disconnection_time, worker.disconnection_error);

		$elem.attr("title", "Worker info");
		$elem.attr("data-content", " ");
		$elem.attr("data-template", `
			<div class="popover" role="tooltip" style="max-width: none;">
				<div class="arrow"></div>
				<h3 class="popover-header"></h3>
				<div class="popover-body"></div>
				<div style="padding: 10px">
					<table class="table table-hover">
						<tr><td>Id</td><td>${Common.escapeHtml(worker.id)}</td></tr>
						<tr><td>Address</td><td>${Common.escapeHtml(worker.address)}</td></tr>
						
						<tr><td>Agent</td><td>${Common.escapeHtml(worker.agent)}</td></tr>
						<tr><td>Wallet</td><td>${Common.escapeHtml(worker.wallet_address)}</td></tr>
						<tr><td>Password</td><td>${Common.escapeHtml(worker.pool_password)}</td></tr>
						
						<tr><td>Pool info</td><td>${this.web.pools.getHtmlPoolInfo(worker.pool_id, 64)}</td></tr>
						<tr><td>Diff</td><td>${Common.intOrNA(worker.difficulty)}</td></tr>
						
						<tr><td>Jobs</td><td>${Common.intOrNA(worker.accepted_job_count)}</td></tr>
						<tr><td>Accepted shares</td><td>${Common.intOrNA(worker.accepted_share_count)}</td></tr>
						<tr><td>Rejected shares</td><td>${Common.intOrNA(worker.rejected_share_count)}</td></tr>

						<tr><td>Hashes</td><td>${Common.intOrNA(worker.hash_count)}</td></tr>
						
						<tr><td>Hash rate</td><td>${CommonView.viewHashRateFull(worker.hashrate)}</td></tr>
						
						<tr><td>Ping(msec)</td><td>${Common.intOrNA(worker.ping)}</td></tr>
									
						<tr><td>Time in work</td><td>${CommonView.viewUpdateTime(worker.time_in_work, worker.__update_time, worker.alive)}</td></tr>
						
						<tr><td>Connection time</td><td>${Common.miliSecToString(worker.connection_time)}</td></tr>
						<tr><td>Disconnection time</td><td>${disconnectTimeSpan}</td></tr>
					</table>
				</div>
			</div>
		`);
				
		$elem.popover('show');
	}
	
	Workers.prototype.getHtmlInfo = function(id, len) {
		if ( id ) {
			var wrap = this.workers[id];
			if ( wrap ) {
				var worker = wrap.info;
				return CommonView.viewClickPopoverInfo(worker.id, "Worker info", "#" + worker.id + " " + worker.address, len||16, "worker_info", "worker_id");
			}
		}
		
		return "";
	}
	
	return Workers;

});