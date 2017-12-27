
const Common = require("../Common");
const PackArray = require("../PackArray");
const WebStatBase = require("./WebStatBase");

class Shares extends WebStatBase {
	constructor(events) {
		super(events);

		this.sharesArchive = new PackArray(1024*1024);

		events.on("web:server:connect_web_socket", (socket) => {
			this.webEmit("sharesArchive", this.sharesArchive.getData(), socket);
		});

		events.on("stratum:client:accepted_share", (origPool, origShare, msg) => {
			this.processShare(origPool, origShare, true, msg);
		});
		events.on("stratum:client:rejected_share", (origPool, origShare, msg) => {
			this.processShare(origPool, origShare, false, msg);
		});
	}

	processShare(origPool, origShare, isAccepted, msg) {
		let share = {
			id        : origShare.share_id,
			pool_id   : origShare.pool_id,
			worker_id : origShare.worker_id,
			job_id    : origShare.id,
			
			share     : {
				job_id    : origShare.job_id,
				nonce     : origShare.nonce,
				hash      : origShare.result,
			},
			
			difficulty: origShare.difficulty,
			
			status    : isAccepted ? "accepted" : "rejected",
			status_msg: msg,
			
			time_in_work: origShare.time_in_work,
			time_start: origShare.time_start,
			time_end  : origShare.time_end,
		};
		
		this.sharesArchive.write("share", share);
		
		this.webEmit("shares", [share]);
	}
}

module.exports = Shares;
