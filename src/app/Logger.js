
const fs = require('fs');
const EventEmitter = require('events').EventEmitter;

class Logger extends EventEmitter {
	constructor(printer, prefix) {
		super();
		
		this.printer = printer;
		this.prefix = prefix || "";
		this.noPrint = false;
	}

	dev(text) { this.log(Logger.LOG_COLOR_GRAY + "[DEV] " + text) }

	success(text) { this.log(Logger.LOG_COLOR_GREEN  + "[SUCCESS] " + text) }
	notice(text)  { this.log(Logger.LOG_COLOR_GRAY   + "[NOTICE] "  + text) }
	warning(text) { this.log(Logger.LOG_COLOR_YELLOW + "[WARNING] " + text) }
	error(text)   { this.log(Logger.LOG_COLOR_RED    + "[ERROR] "   + text) }

	log(text) {
		text += Logger.LOG_COLOR_RESET;
		
		if ( this.noPrint ) {
			return;
		}
		
		this.emit("log", text);
		
		text = `[${this.prefix}] ${text}`;
		
		if ( this.printer instanceof Logger ) {
			this.printer.log(text);
		} else {
			this.printer(text);
		}
	}
	
	close() {
		this.noPrint = true;
	}
}
Logger.LOG_COLOR_RESET   = "\033[0m";
Logger.LOG_COLOR_GRAY    = "\033[1;30m";
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


module.exports = Logger;