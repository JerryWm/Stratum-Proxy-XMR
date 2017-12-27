class PackArray {
	constructor(maxSize) {
		this.maxSize = maxSize || (1024*1024);
		
		this.data = "";
	}
	
	write(name, obj) {
		this.data += PackArray.pack(name, obj);
		
		if ( this.data.length > this.maxSize ) {
			this.data = this.data.substr(this.maxSize>>1);
		}
	}
	
	getData() {
		return this.data;
	}
}
PackArray.pack = (name, obj) => {
	return PackArray.MSG_START_MARKER + name + PackArray.MSG_DELTA_MARKER + JSON.stringify(obj) + PackArray.MSG_END_MARKER;
}
PackArray.MSG_START_MARKER = "\x00\x00";
PackArray.MSG_DELTA_MARKER = "\x00\x01";
PackArray.MSG_END_MARKER   = "\x00\x02";
	
module.exports = PackArray;
