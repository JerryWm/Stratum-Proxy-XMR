define(["app/Common", "app/CommonView", "app/UnPackArray"], function(Common, CommonView, UnPackArray) {

	function Jobs($Jobs, socketIo, web) {
		this.$Jobs = $Jobs;
		this.dataTable = this.$Jobs.DataTable();
		this.web = web;
		
		this.jobs = Object.create(null);
		
		var self = this;
		
		socketIo.on("jobs", function(pools) {
			self.listProcess(pools);
		});
		socketIo.on("jobsArchive", function(poolsArchive) {
			self.listProcess(UnPackArray(poolsArchive).list);
		});

		socketIo.on("job_info_mini", function(info) {
			self.updateMini(info);
		});
	}
	Jobs.prototype.updateMini = function(data) {
		var jobWrap = this.jobs[data[0]];
		if ( !jobWrap ) { return; }
		var job = jobWrap.info;
		
		var map = {
			1: "accepted_share_count",
			2: "rejected_share_count",
		};
		
		for(var i in map) {
			if ( data[i] == null || data[i] === undefined ) { continue; }
			
			job[map[i]] = data[i];
		}
		
		this.syncPool(job.id);
	}
	Jobs.prototype.addItem = function(item) {
		if ( this.jobs[item.id] === undefined ) {
			this.jobs[item.id] = {
				dtRowIndex: this.dataTable.row.add([0,0,0,0,0, 0,0,0,0,0,0,0,]),
				info: item
			};
		} else {
			this.jobs[item.id].info = item;
		}
		
		item.__update_time = Common.currTimeMiliSec();
		
		this.syncPool(item.id);
	}
	Jobs.prototype.syncPool = function(id) {
		var jobWrap = this.jobs[id];
		if ( !jobWrap ) { return; }
		
		var job = jobWrap.info;
	
		this.dataTable.row(jobWrap.dtRowIndex).data([
			`<span tabindex="0"   style="cursor: pointer; text-shadow: -3px -2px 5px; text-decoration: none;"  event-click="job_info" job_id="${parseInt(job.id)}">${parseInt(job.id)}</span>`,
				
			this.web.pools.getHtmlPoolInfo(job.pool_id),
			
			Common.escapeHtml(Common.stringNormalizeLen(job.job_id, 16)),
			CommonView.viewCode(Common.escapeHtml(Common.stringNormalizeLen(job.nonce, 8))),

			Common.intOrNA(job.accepted_share_count),
			Common.intOrNA(job.rejected_share_count),
			Common.intOrNA(job.worker_count),
			Common.intOrNA(job.difficulty),
			
			CommonView.viewUpdateTime(job.time_in_work, job.__update_time, job.alive),
			
			Common.miliSecToString(job.time_start),
			
			CommonView.viewDisconnectTime(job.time_end, job.end_message)
		]);
		
		if ( !job.alive ) {
			$(this.dataTable.row(jobWrap.dtRowIndex).node()).addClass("table-secondary").css({'color': '#121212'});
		}
	}
	Jobs.prototype.listProcess = function(list) {
		for(var i = 0; i < list.length; i++) {
			this.addItem(list[i]);
		}
		
		this.dataTable.draw();
	}
	
	Jobs.prototype.getHtmlInfo = function(id, len) {
		if ( id ) {
			var wrap = this.jobs[id];
			if ( wrap ) {
				var job = wrap.info;
				var info = "#" + job.id + " " + job.job_id;
				return CommonView.viewClickPopoverInfo(job.id, "Job info", info, len||16, "job_info", "job_id");				
			}
		}
		return "";
	}

	Jobs.prototype.popoverShowFullInfo = function(id, $elem) {
		var wrapperJob = this.jobs[id];
		if ( !wrapperJob ) { return null; }
		
		var job = wrapperJob.info;
		
		//$elem.attr("title", "Job info");
		$elem.attr("data-content", " ");
		$elem.attr("data-template", `
			<div class="popover" role="tooltip" style="max-width: none;">
				<div class="arrow"></div>
				<h3 class="popover-header"></h3>
				<div class="popover-body"></div>
				<div style="padding: 10px">
					<table class="table table-hover">
						<tr><td>Id</td><td>${Common.escapeHtml(job.id)}</td></tr>
						
						<tr><td>Pool info</td><td>${this.web.pools.getHtmlPoolInfo(job.pool_id, 64)}</td></tr>

						<tr><td>Job id</td><td>${Common.escapeHtml(job.job_id)}</td></tr>
						<tr><td>Job start nonce</td><td>${CommonView.viewCode(Common.escapeHtml(job.nonce))}</td></tr>
						
						<tr><td>Diff</td><td>${Common.intOrNA(job.difficulty)}</td></tr>
						<tr><td>Accepted shares</td><td>${Common.intOrNA(job.accepted_share_count)}</td></tr>
						<tr><td>Rejected shares</td><td>${Common.intOrNA(job.rejected_share_count)}</td></tr>
						
						<tr><td>Time in work</td><td>${CommonView.viewUpdateTime(job.time_in_work, job.__update_time, job.alive)}</td></tr>
						
						<tr><td>Time start</td><td>${Common.miliSecToString(job.time_start)}</td></tr>
						<tr><td>End time</td><td>${CommonView.viewDisconnectTime(job.time_end, job.end_message)}</td></tr>
					</table>
				</div>
			</div>
		`);
				
		$elem.popover('show');
	}
	
	return Jobs;

});