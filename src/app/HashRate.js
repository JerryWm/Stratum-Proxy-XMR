
const Logger = require("./Logger");
const Common = require("./Common");

class TimeEvents {
	constructor() {
		this.data = [];
	}
	on(sec, cb, time) {
		if ( time === undefined ) {time = Common.currTimeSec();}
		
		this.data.push({
			interval: sec,
			lastTime: time,
			cb: cb,
		});
	}
	emit(time) {
		if ( time === undefined ) {time = Common.currTimeSec();}
		
		for(let v of this.data) {
			if ( v.lastTime + v.interval <= time ) {
				v.lastTime = time;
				v.cb();
			}
		}
	}
}

class HashRateLast {
	constructor(count) {
		count = count || 10;
		
		this.index = 0;
		this.array = new Float64Array(count*2);
		this.count = count;
		
		this.addResultJob(0);
	}
	
	addResultJob(hashes) {
		let index = (this.index % this.count) * 2;
		
		this.array[ index + 0 ] = hashes;
		this.array[ index + 1 ] = Common.currTimeSec();
		
		this.index++;
	}
	
	getHashRate() {
		if ( this.index >= 2 ) {
			let minIndex = 0;
			let maxIndex = this.index - 1;
			
			if ( maxIndex >= this.count ) {
				minIndex = maxIndex + 1;
			}
			
			minIndex = (minIndex % this.count)*2;
			maxIndex = (maxIndex % this.count)*2;
			
			return (this.array[maxIndex + 0] - this.array[minIndex + 0]) / (Common.currTimeSec() - this.array[minIndex + 1]);
		}
		
		return null;
	}
}

class HashRate {
	constructor() {
		this.time = Common.currTimeSec();
		this.start_time = this.time;
		
		this.prevMinInfo = {hashes: 0, time: this.time};
		this.minInfo     = {hashes: 0, time: this.time};
		
		this.min5Count = (60/5) * 24;
		this.min5Cursor = 0;
		this.min5InfoData = new Float64Array(this.min5Count * 2);

		this.timeEvents = new TimeEvents();
		
		this.timeEvents.on(60, this.min1.bind(this));
		this.timeEvents.on(60*5, this.min5.bind(this));
		//this.timeEvents.on(10, this.min5.bind(this));
		
		this.hashes = 0;
		
		this.min5Add(0, this.time);
	}
	
	min1() {
		if ( this.time - this.minInfo.time > 60 ) {
			this.prevMinInfo.hashes = this.minInfo.hashes;
			this.prevMinInfo.time   = this.minInfo.time;

			this.minInfo.hashes = this.hashes;
			this.minInfo.time   = this.time;
		}
	}
	min5GetIndex(cursor) {
		return (cursor % this.min5Count) * 2;
	}
	min5Add(hashes, time) {
		let index = (this.min5Cursor % this.min5Count) * 2;
		
		this.min5InfoData[index + 0] = hashes;
		this.min5InfoData[index + 1] = time;
		
		this.min5Cursor++;
	}
	min5() {
		this.min5Add(this.hashes, this.time);
	}
	
	addResultJob(hashes) {
		this.hashes = hashes;
		this.time = Common.currTimeSec();
		
		this.timeEvents.emit(this.time);
	}
	
	getHashRate(min) {
		if ( !min ) {
			let ret = (this.hashes - this.prevMinInfo.hashes) / (this.time - this.prevMinInfo.time);
			if ( isNaN(ret) || ret === Number.NEGATIVE_INFINITY || ret === Number.POSITIVE_INFINITY ) {
				return null;
			}
			
			return ret;
		}
		
		let ret = {};
		for(let v of min) { ret[v] = null; }
		
		if ( min.indexOf("all") >= 0 ) {
			ret["all"] = this.hashes ? ( this.hashes / (Common.currTimeSec() - this.start_time) ) : null;
			min.splice(min.indexOf("all"), 1);
		}
		
		let maxIndex = null;
		for(let i = this.min5Cursor - 1; i >= 0; i--) {
			let index = this.min5GetIndex(i);

			if ( index === maxIndex ) {
				return ret;
			}
			
			if ( maxIndex === null ) {
				maxIndex = index;
			}
			
			let m5Hashes = this.min5InfoData[index+0];
			let m5Time = this.min5InfoData[index+1];

			if ( this.time - m5Time >= (min[0]*60) ) {
				ret[min[0]] = (this.hashes - m5Hashes) / (this.time - m5Time);
				min.splice(0, 1);
				if ( !min.length ) {
					return ret;
				}
			}
		}
		
		
		
		return ret;
	}
	
}


module.exports = {
	TimeEvents  : TimeEvents,
	HashRateLast: HashRateLast,
	HashRate    : HashRate,
};
