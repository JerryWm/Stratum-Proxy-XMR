(function() {

 	function Message() {
		this.msgs = [];
	}
	Message.prototype.regMsg = function(msgName) {
		this.msgs.push(msgName);
	}
	Message.prototype.parseMsgs = function(str, msgName) {
		let PREFIX = "\x00"+msgName+"\x00";
		
		let startIndex = 0;
		let endIndex = 0;
		
		let msgs = [];
		
		while(1) {
			startIndex = str.indexOf(PREFIX, endIndex);
			if ( startIndex < 0 ) {
				break;
			}
			
			startIndex += PREFIX.length;
			endIndex = str.indexOf("\x00", startIndex);
			if ( endIndex < 0 ) {
				break;
			}
			
			let jsonString = str.substr(startIndex, endIndex - startIndex);
			let json;
			let isJson = false;
			try {
				json = JSON.parse(jsonString);
				isJson = true;
			} catch(e) {}
			
			if ( isJson ) {
				msgs.push(json);
			}
		}
		
		return msgs;
	}
	Message.prototype.parse = function(str) {
		let ret = Object.create(null);
		
		for(let i = 0; i < this.msgs.length; i++) {
			let msgName = this.msgs[i];
			ret[msgName] = this.parseMsgs(str, msgName);
		}
		
		return ret;
	}
	Message.prototype.writeMsg = function(msgName, msgData) {
		return "\x00" + msgName + "\x00" + JSON.stringify(msgData) + "\x00";
	}
	Message.prototype.writeMsgs = function(msgName, msgDataList) {
		let str = "";
		
		for(let i = 0; i < msgDataList.length; i++) {
			str += this.writeMsg(msgName, msgDataList[i]);
		}
		
		return str;
	}

	try {
		if ( window ) {
			window.Message = Message;
		}
	} catch(e) {}

	try {
		if ( module ) {
			module.exports = Message;
		}
	} catch(e) {}
	
})();