define(["app/Common", "app/CommonView", "app/UnPackArray"], function(Common, CommonView, UnPackArray) {

	function Shares($shares, socketIo, web) {
		this.$shares = $shares;
		this.dataTable = this.$shares.DataTable();
		this.web = web;
		
		this.shares = Object.create(null);
		
		var self = this;
		
		socketIo.on("shares", function(pools) {
			self.listProcess(pools);
		});
		socketIo.on("sharesArchive", function(poolsArchive) {
			self.listProcess(UnPackArray(poolsArchive).list);
		});
	}
	Shares.prototype.addItem = function(item) {
		if ( this.shares[item.id] === undefined ) {
			this.shares[item.id] = {
				dtRowIndex: this.dataTable.row.add([0,0,0,0,0, 0,0,0,0,0,0,0,]),
				info: item
			};
		} else {
			this.shares[item.id].info = item;
		}
		
		item.time_update = Common.currTimeMiliSec();
		
		this.sync(item.id);
	}
	Shares.prototype.sync = function(id) {
		var wrap = this.shares[id];
		if ( !wrap ) { return; }
		
		var share = wrap.info;
		
		var status = "";
		switch(share.status) {
			case "accepted":
				status = '<span style="color: #28a745; text-shadow: -3px -2px 5px;">Accepted</span>';
				break;
			case "rejected":
				var errorTitle = "Error";
				status = `
				<a 
					href="javascript:void(0);" 
					tabindex="0"  
					style="color: #dc3545; text-shadow: -3px -2px 5px; text-decoration: none;" 
					data-toggle="popover" 
					data-trigger="focus"
					title="${errorTitle}" 
					data-content="${Common.escapeHtml(share.status_msg)}"
				>
					Rejected
				</a>`;
				break;
		}

	
		this.dataTable.row(wrap.dtRowIndex).data([
			`<span tabindex="0"   style="cursor: pointer; text-shadow: -3px -2px 5px; text-decoration: none;"  event-click="job_info" job_id="${parseInt(share.id)}">${parseInt(share.id)}</span>`,
				
			this.web.pools.getHtmlPoolInfo(share.pool_id),
			
			this.web.workers.getHtmlInfo(share.worker_id),
			
			this.web.jobs.getHtmlInfo(share.job_id, 16),
						
			//Common.escapeHtml(Common.stringNormalizeLen(share.share.job_id, 16)),
			CommonView.viewCode(Common.escapeHtml(Common.stringNormalizeLen(share.share.nonce, 8))),
			CommonView.viewCode(Common.escapeHtml(Common.stringNormalizeLen(share.share.hash, 32*2))),

			Common.intOrNA(share.difficulty),
			
			status,
			
			CommonView.viewUpdateTime(share.time_in_work, share.time_update, share.alive),
			
			Common.miliSecToString(share.time_start),
			
			CommonView.viewDisconnectTime(share.time_end, share.end_message)
		]);
		
		if ( !share.alive ) {
			$(this.dataTable.row(wrap.dtRowIndex).node()).addClass("table-secondary").css({'color': '#121212'});
		}
	}
	Shares.prototype.listProcess = function(list) {
		for(var i = 0; i < list.length; i++) {
			this.addItem(list[i]);
		}
		
		this.dataTable.draw();
	}
	
	Shares.prototype.popoverShowFullInfo = function(id, $elem) {
		var wrapperJob = this.shares[id];
		if ( !wrapperJob ) { return null; }
		
		var share = wrapperJob.info;
		
		$elem.attr("title", "Job info");
		$elem.attr("data-content", " ");
		$elem.attr("data-template", `
			<div class="popover" role="tooltip" style="max-width: none;">
				<div class="arrow"></div>
				<h3 class="popover-header"></h3>
				<div class="popover-body"></div>
				<div style="padding: 10px">
					<table class="table table-hover">
						<tr><td>Id</td><td>${Common.escapeHtml(share.id)}</td></tr>
						
						<tr><td>Pool info</td><td>${this.web.pools.getHtmlPoolInfo(share.pool_id, 64)}</td></tr>

						<tr><td>Job id</td><td>${this.web.jobs.getHtmlInfo(share.job_id, 16)}</td></tr>
						<tr><td>Job start nonce</td><td>${Common.escapeHtml(share.nonce)}</td></tr>
						
						<tr><td>Diff</td><td>${Common.intOrNA(share.difficulty)}</td></tr>
						<tr><td>Accepted shares</td><td>${Common.intOrNA(share.accepted_share_count)}</td></tr>
						<tr><td>Rejected shares</td><td>${Common.intOrNA(share.rejected_share_count)}</td></tr>
						
						<tr><td>Time in work</td><td>${CommonView.viewUpdateTime(share.time_in_work, share.time_update, share.alive)}</td></tr>
						
						<tr><td>Time start</td><td>${Common.miliSecToString(share.time_start)}</td></tr>
						<tr><td>End time</td><td>${CommonView.viewDisconnectTime(share.time_end, share.end_message)}</td></tr>
					</table>
				</div>
			</div>
		`);
				
		$elem.popover('show');
	}
	
	return Shares;

});