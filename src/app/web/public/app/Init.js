define(["app/Common", "app/CommonView", "app/UnPackArray"], function(Common, CommonView, UnPackArray) {

	function Init($restartModal, socketIo, web) {
		this.$restartModal = $restartModal;
		this.$restartModal.modal({
			backdrop: "static",
			keyboard: false,
			show    : false,
		});
		
		this.web = web;
		
		var self = this;
				
		this.socketIo = socketIo;
		
		this.init_obj;
		
		socketIo.on("web:app:init", function(obj) {
			if ( self.init_obj ) {
				if ( self.init_obj.process_id !== obj.process_id ) {
					socketIo.close();
					
					self.$restartModal.modal('show');
				}
			} else {
				self.init_obj = obj;
			}
		});
	}
	
	return Init;

});