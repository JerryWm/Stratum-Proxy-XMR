const Common = require("./../Common");

class Base {
	
	constructor(events) {
		this.sockets = [];
		
		events.on("web:server:connect_web_socket", (socket) => this.sockets.push(socket));
	}
	
	webEmit(name, data, socket) {
		if ( socket ) {
			socket.emit(name, data);
			return;
		}
		
		let freeSockets = [];

		for(let i = 0; i < this.sockets.length; i++) {
			let socket = this.sockets[i];
			if ( socket.connected ) {
				socket.emit(name, data);
			} else {
				freeSockets.push(i);
			}
		}
				
		for(let i of freeSockets) {
			this.sockets.splice(i, 1);
		}
	}
	
	webEmitObjToArray(name, obj, socket) {
		this.webEmit(name, Common.objToArray(obj), socket);
	}
	
}

module.exports = Base;