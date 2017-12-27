
const Common = require("./Common");
const WebStatBase = require("./WebStat/WebStatBase");

class WebAuth extends WebStatBase {
	constructor(auth_key, events) {
		super(events);
		
		this.events = events;
		this.auth_key = auth_key;

		if ( this.auth_key === null || this.auth_key === undefined ) {
			this.auth_key = "";
		} else {
			this.auth_key = String(this.auth_key);
		}
		
		this.process_id = Common.randHex(32);
		
		this.events.on("web:server:connect_web_socket_no_login", (socket) => {
			
			socket.emit("web:app:init", {
				process_id: this.process_id
			});			
			
			socket.on("web:login", (auth_key) => {
				
				if ( !this.auth_key.length || this.auth_key === auth_key ) {
					socket.emit("web:answer_auth_key", true);
					
					this.events.emit("web:server:connect_web_socket", socket);
					socket.emit("web:noty", {type: "success", text: "Authorization successful"});
				} else {
					socket.emit("web:answer_auth_key", false);
					socket.emit("web:noty", {type: "error", text: "Invalid auth key"});
				}
				
			});
		});
	}
}

module.exports = WebAuth;