define(["app/Common", "app/CommonView", "app/UnPackArray"], function(Common, CommonView, UnPackArray) {

	function Auth($authModal, socketIo, web) {
		this.$authModal = $authModal;
		this.$authModalInput = this.$authModal.find(".auth-input-auth-key");
		this.$authModal.modal({
			backdrop: "static",
			keyboard: false,
			show    : false,
		});
		
		this.web = web;
		
		var self = this;
		
		self.state = 0;
		
		this.socketIo = socketIo;
		
		socketIo.on("connect", function() {
			self.state = 0;
			socketIo.emit("web:login", self.localStorageAuthKey());
		});
		
		socketIo.on("web:answer_auth_key", function(valid) {
			if ( valid ) {
				self.$authModal.modal("hide");
			} else {
				if ( self.state ) {
					self.$authModal.find(".auth-badge-invalid").show();
				}
				self.state++;
				
				self.$authModalInput.val(self.localStorageAuthKey());
				self.$authModal.modal("show");
			}
		});
		
		self.$authModal.find(".auth-btn-save").on("click", function() {
			var auth_key = self.$authModalInput.val();
			self.localStorageAuthKey(auth_key);
			socketIo.emit("web:login", auth_key);
		});
	}
	Auth.prototype.localStorageAuthKey = function(value) {
		if ( value === undefined ) {
			var ret = this.localStorage("auth:login");
			if ( ret === undefined || ret === null ) {
				ret = "";
			}
			return ret;
		} else {
			this.localStorage("auth:login", value);
		}
	}
	Auth.prototype.localStorage = function(key, value) {
		if ( window && window.localStorage ) {
			if ( value !== undefined ) {
				window.localStorage[key] = value;
			} else {
				return window.localStorage[key];
			}
		}
	}
	
	return Auth;

});