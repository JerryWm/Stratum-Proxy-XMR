define(["app/Common", "app/CommonView", "app/UnPackArray"], function(Common, CommonView, UnPackArray) {

	function GlobalHashRate($hashRate, socketIo) {		
		var self = this;
		
		this.$hashRate = $hashRate;
		this.$hashRateTable = $hashRate.find("> table");
		this.hashRate = {};
		
		socketIo.on("global_hashrate", function(hashRate) {
			self.hashRate = hashRate[0];
			self.viewUpdate();
		});
		
		this.viewUpdate();
	}
	GlobalHashRate.prototype.viewUpdate = function() {
		this.$hashRateTable.html(CommonView.viewHashRateFullHtmlInTable(this.hashRate));
	}
	
	return GlobalHashRate;

});