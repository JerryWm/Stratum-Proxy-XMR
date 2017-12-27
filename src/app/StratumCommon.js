
class Recv {
	constructor() {
		this.incoming_buf = "";
	}
	
	recv(buf, onRecvObj) {
		this.incoming_buf += buf.toString();

		try {
			this.incoming_buf = this.incoming_buf.replace(/[^\r\n]*[\r\n]/g, (m) => {
				m = m.trim();
				if ( m.length ) {
					onRecvObj(JSON.parse(m));
				}
				return "";
			});
		} catch(e) {
			console.log("..recv: " + 0, e);
			this.incoming_buf = "";
			return false;
		}

		return true;
	}
}

module.exports = {
	Recv: Recv
};