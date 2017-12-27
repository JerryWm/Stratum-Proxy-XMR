define(["app/Common", "app/CommonView", "app/UnPackArray"], function(Common, CommonView, UnPackArray) {

	function Logs($logs, socketIo, web) {
		this.$logs = $logs;
		this.dataTable = this.$logs.DataTable();
		this.web = web;
		
		this.logs = Object.create(null);
		
		var self = this;
		
		socketIo.on("logs", function(pools) {
			self.listProcess(pools);
		});
		socketIo.on("logsArchive", function(poolsArchive) {
			self.listProcess(UnPackArray(poolsArchive).list);
		});
	}
	Logs.prototype.addItem = function(item) {
		if ( this.logs[item.id] === undefined ) {
			this.logs[item.id] = {
				dtRowIndex: this.dataTable.row.add([0,0,0,]),
				info: item
			};
		} else {
			this.logs[item.id].info = item;
		}
		
		this.sync(item.id);
	}
	Logs.prototype.sync = function(id) {
		var wrap = this.logs[id];
		if ( !wrap ) { return; }
		
		var log = wrap.info;
	
		this.dataTable.row(wrap.dtRowIndex).data([
			parseInt(log.id),
			
			Common.miliSecToString(log.time),

			this.lineToHtml(log.text)
		]);		
	}
	Logs.prototype.listProcess = function(list) {
		for(var i = 0; i < list.length; i++) {
			this.addItem(list[i]);
		}
		
		this.dataTable.draw();
	}

	Logs.prototype.lineToHtml = function(text) {
		this.logger = this.logger || new Logger();
		
		return this.logger.textToHtml(text);
	}
	Logs.prototype.lineToText = function(text) {
		return text.replace(/\033.*?m/g, "");
	}
	
	
	function Logger() {		
		var colors = Object.create(null);
			colors[Logger.LOG_COLOR_RESET   ] = '<span style="color: #ffffff" >';
			colors[Logger.LOG_COLOR_SR      ] = '<span style="color: #868e96" >';
			colors[Logger.LOG_COLOR_RED     ] = '<span style="color: #dc3545" >';
			colors[Logger.LOG_COLOR_GREEN   ] = '<span style="color: #28a745" >';
			colors[Logger.LOG_COLOR_YELLOW  ] = '<span style="color: #ffc107" >';
			colors[Logger.LOG_COLOR_BLUE    ] = '<span style="color: #007bff" >';
			colors[Logger.LOG_COLOR_WHITE   ] = '<span style="color: #ffffff" >';
			colors[Logger.LOG_COLOR_DEVMODE ] = '<span style="color: #868e96" >';
			colors[Logger.LOG_COLOR_MAGENTA ] = '<span style="color: #d608ea" >';
			colors[Logger.LOG_COLOR_CYAN    ] = '<span style="color: #17a2b8" >';

			colors[Logger.LOG_COLOR_MAGENTA_LIGHT] = '<span style="color: #d608ea; text-shadow: -3px -2px 5px;" >';
			colors[Logger.LOG_COLOR_GREEN_LIGHT  ] = '<span style="color: #28a745; text-shadow: -3px -2px 5px;" >';
		this.colors = colors;
	}
	Logger.prototype.textToHtml = function(text) {
		var self = this;
	
		var count = 0;
		text = text.replace(/\033.*?m/g, (m) => {
			var cl = self.colors[m];
			if ( cl ) {
				count++;
				return cl;
			}
			
			return "";
		});
		
		while(count--) {
			text += '</span>';
		}
		
		return text;
	}
	Logger.LOG_COLOR_RESET   = "\033[0m";
	Logger.LOG_COLOR_SR	     = "\033[1;30m";
	Logger.LOG_COLOR_RED     = "\033[1;31m";
	Logger.LOG_COLOR_GREEN   = "\033[1;32m";
	Logger.LOG_COLOR_YELLOW  = "\033[1;33m";
	Logger.LOG_COLOR_BLUE    = "\033[1;34m";
	Logger.LOG_COLOR_WHITE   = "\033[1;37m";
	Logger.LOG_COLOR_DEVMODE = "\033[1;35m";
	Logger.LOG_COLOR_MAGENTA = "\033[1;35m";
	Logger.LOG_COLOR_CYAN    = "\033[1;36m";
	Logger.LOG_COLOR_MAGENTA_LIGHT = "\033[0;35m";
	Logger.LOG_COLOR_GREEN_LIGHT   = "\033[0;32m";	
	
	return Logs;

});