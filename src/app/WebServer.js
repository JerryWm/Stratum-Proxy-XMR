const http = require('http');
const fs = require('fs');
const url = require('url');
const events = require('events');
const socketIo = require('socket.io');

const Logger = require("./Logger");
const Common = require("./Common");

/**
{
	new HttpServer("0.0.0.0:8000", ["web/public/"], (webSocketIo) => {}, () => {...close}, logger);
	
}
*/

/**
	EventEmitter {
		open
		close
		connect_web_socket
		connect_web_socket_no_login
	}
*/

class WebServer {
	constructor(hostport, webPublicDirs, events, logger) {
		this.events = events;
		this.prefix = "web:server:";

		this.events.emit(this.prefix + "open");

		this.socket = null;
			
		this.logger = new Logger(logger, "WEB-SERVER");
		
		let tmphp = Common.addressEx(hostport);
		if ( !tmphp ) {
			this.logger.error("Invalid hostport \"" + hostport + "\"");
			this.events.emit(this.prefix + "close");
			return;
		}
		
		[this.host, this.port] = tmphp;
		
		this.webPublicDirs = webPublicDirs;
		
		this.socket = require('http').createServer(this.onConnectWebHttp.bind(this));
		
		this.setEvents();
	}
	
	close() {
		if ( this.socket ) {
			this.socket.close();
			this.socket = null;
		}
		this.events.emit(this.prefix + "close");
	}

	setEvents() {
		this.socket.on("error", (e) => {
			this.logger.error('An error has occurred ' + (e.code ? e.code : ""));
			this.close();
		});
		
		this.socket.on("listening", () => {
			this.listening();
		});

		try {
			this.logger.notice("Attempting opened server on "+Logger.LOG_COLOR_MAGENTA_LIGHT+"\""+this.host+':'+this.port+'"');
			this.socket.listen(this.port, this.host);
		} catch(e) {
			this.logger.error('An error has occurred ' + (e.message ? e.message : ""));
			this.close();
		}
	}	

	listening() {
		this.logger.success("Opened server on \""+this.host+':'+this.port+'"' );
		
		socketIo.listen(this.socket).sockets.on('connection', this.onConnectWebSocket.bind(this));
	}

	res404(res) {
		res.writeHead(404, {'Content-type':'text/plan'});
		res.write('Page Was Not Found');
		res.end();
	}

	onConnectWebHttp(req, res) {
		let pathName = url.parse(req.url).pathname;
		
		if ( !( pathName.match(/\.\./) || pathName.match(/[^a-zA-Z0-9_\-\.\/]/) ) ) {
			if ( pathName === "/" ) {
				pathName = "/index.html";
			}
			
			let ext = ( pathName.match(/\.([^\.]+)$/) || [""] )[1];
			let content_type = null;//"text/plan";
			
			switch(ext) {
				case "js":
					content_type = "text/javascript"; 
					break;
				case "htm":
				case "html":
					content_type = "text/html"; 
					break;
				case "css":
					content_type = "text/css";
					break;
			}
			
			if ( content_type ) {
				
				for(let i = 0; i < this.webPublicDirs.length; i++) {
					let absPath = this.webPublicDirs[i] + pathName;
					if ( fs.existsSync(absPath) ) {
						fs.readFile(absPath, (err, data) => {
							if ( err ) {
								this.res404(res);
								return;
							}
					
						   res.writeHead(200, {'Content-type': content_type});
						   res.write(data);
						   res.end();
						});
						
						return;
					}
				}
				
			}
		}

		this.res404(res);
	}
	onConnectWebSocket(socket) {
		//this.events.emit(this.prefix + "connect_web_socket", socket);
		this.events.emit(this.prefix + "connect_web_socket_no_login", socket);
	}
}

module.exports = WebServer;