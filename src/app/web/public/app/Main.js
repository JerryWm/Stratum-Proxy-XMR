define([
	"socketio", 
	"app/Common", 
	"app/Pools", 
	"app/Workers", 
	"app/Jobs", 
	"app/Shares", 
	"app/Logs", 
	"app/GlobalHashRate",
	"app/Settings", 
	"app/VueComponents/SettingsPool",
	"app/Auth",
	"app/Init"
], function(
	socketio, 
	Common, 
	Pools, 
	Workers, 
	Jobs, 
	Shares, 
	Logs, 
	GlobalHashRate,
	Settings, 
	_VueComponentSettingsPool,
	Auth,
	Init
) {

	function Main() {

		this.$workers = $('#worker-list');
		this.$workers.DataTable({
			scrollY       : "calc(100% - 200px)",
			scrollCollapse: true, 
			order         : [[0, 'desc']],
			//orderMulti    : true,
			orderFixed    : [ 15, 'desc' ],
		});
		
		this.$pools = $('#pool-list');
		this.$pools.DataTable({
			scrollY       : "calc(100% - 200px)",
			scrollCollapse: true,
			order         : [[0, 'desc']],
			orderFixed    : [ 12, 'desc' ]
		});	
			
		this.$jobs = $('#job-list');
		this.$jobs.DataTable({
			scrollY       : "calc(100% - 200px)",
			scrollCollapse: true,
			order         : [[0, 'desc']],
			orderFixed    : [ 10, 'desc' ]
		});		
	
		this.$shares = $('#share-list');
		this.$shares.DataTable({
			scrollY       : "calc(100% - 200px)",
			scrollCollapse: true,
			order         : [[0, 'desc']],
		});
		
		this.$logs = $('#log-list');
		this.$logs.DataTable({
			scrollY       : "calc(100% - 200px)",
			scrollCollapse: true,
			order         : [[0, 'desc']],
		});
		
		this.$globalHashRate = $('#global-hash-rate-cnt');
		
		this.$modalLogin = $('#modal-login');
		
		this.$modalInit = $('#modal-restart');
		
		this.socketIo = socketio({transports: ['websocket'], upgrade: false});
		
		this.workers        = new Workers(this.$workers, this.socketIo, this);
		this.pools          = new Pools(this.$pools, this.socketIo, this);
		this.jobs           = new Jobs(this.$jobs, this.socketIo, this);
		this.shares         = new Shares(this.$shares, this.socketIo, this);
		this.logs           = new Logs(this.$logs, this.socketIo, this);
		this.globalHashRate = new GlobalHashRate(this.$globalHashRate, this.socketIo, this);
		this.auth           = new Auth(this.$modalLogin, this.socketIo, this);
		this.init           = new Init(this.$modalInit, this.socketIo, this);

		this.settings = new Settings(this.socketIo);
		
		var self = this;
		
		this.popovers = [];
		
		this.setEventClicl();
		
		this.setNoty();

		$(document).on('click', '[data-toggle="popover"]', function(e) {
			$(e.target).popover('show');
		});
		
		$(document).on('click', function(e) {
			for(var i in self.popovers) {				
				self.popovers[i].popover('hide')
			}
		});
				
		setInterval(() => $(window).trigger('resize'), 1e2);
	}
	Main.prototype.setEventClicl = function() {
		
		var self = this;
		
		var cbMap = {
			pool_info  : {objName: "pools"  , propIdName: "pool_id"  ,},
			worker_info: {objName: "workers", propIdName: "worker_id",},
			job_info   : {objName: "jobs"   , propIdName: "job_id"   ,},
			share_info : {objName: "shares" , propIdName: "share_id" ,},
		};
		
		$(document).on("click", '[event-click]', function(e) {
			var $e = $(e.target);
			var info = cbMap[$e.attr("event-click")];
			if ( info ) {
				self[info.objName].popoverShowFullInfo($e.attr(info.propIdName), $e);
				self.popovers.push($e);
				return false;
			}
		});
		
	}
	
	Main.prototype.setNoty = function() {
		var self = this;
		this.socketIo.on('web:noty', function(notyInfo) {
			var n = new Noty({
				type: notyInfo.type, 
				text: self.logs.lineToText( Common.escapeHtml(notyInfo.text) ),
			});

			n.setTimeout(notyInfo.timeout || 1e3*2);
			n.show();
		});
	}
	
	return Main;

});