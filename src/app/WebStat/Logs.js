
const Common = require("../Common");
const PackArray = require("../PackArray");
const WebStatBase = require("./WebStatBase");

class Logs extends WebStatBase {
	constructor(events, logger) {
		super(events);
		
		this.logsArchive = new PackArray(1024*1024);

		events.on("web:server:connect_web_socket", (socket) => {
			this.webEmit("logsArchive", this.logsArchive.getData(), socket);
		});

		logger.on("log", (text) => {
			let log = {
				id  : Common.getId("logs:log"),
				time: Common.currTimeMiliSec(),
				text: text,
			};
			
			this.webEmit("logs", [log]);
			
			this.logsArchive.write("log", log);
		});
		
		//for(let i = 0; i < 1024*50; i++) { logger.notice("Ex my text rp") }
	}

}

module.exports = Logs;