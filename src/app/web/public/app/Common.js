define(function() {

	function escapeHtml(html) {
		var span;
		if ( !document || 
				!document.createElement ||
					!(span = document.createElement('span')) ||
						!("innerText" in span) ||
							!("innerHTML" in span) ) {
							
			return "{{DOCUMENT ERROR}}";
		}

		escapeHtml = function(html) {
			span.innerText = html;
			return span.innerHTML;
		}
		
		return escapeHtml(html);
	}

	function intOrNA(n) {
		if ( n === null || n === undefined ) {
			return "n/a";
		}
		
		return Math.round(n);
	}

	function currTimeMiliSec() {
		return +(new Date());
	}
	function currTimeSec() {
		return currTimeMiliSec() * 1e-3;
	}
	
	
	function stringNormalizeLen(s, maxLen) {
		s = String(s);
		
		if ( s.length <= maxLen ) {
			return s;
		}
		
		return s.slice(0, (maxLen>>1)) + "..." + s.slice(-(maxLen>>1));
	}
	function deltaSecToString(sec) {
		sec = Math.round(sec);
		
		var s = "";
		
		var _h = Math.floor(sec/3600); sec %= 3600;
		var _m = Math.floor(sec/60);   sec %= 60;
		var _s = sec;
	
		if ( _h !== 0 ) s += _h + "h ";
		if ( _m !== 0 ) s += _m + "m ";
		                s += _s + "s ";
		
		return s;
	}
	function deltaMiliSecToString(sec) {
		return deltaSecToString(sec*1e-3);
	}
	
	function miliSecToString(msec) {
		var d = new Date(msec);
		return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`;
	}
	function hrp(hr) {
		return (hr === null || hr === undefined) ?
			"n/a" : parseFloat(hr).toFixed(2);
	}	
	
	
	return {
		escapeHtml: escapeHtml,
		intOrNA: intOrNA,
		currTimeMiliSec: currTimeMiliSec,
		currTimeSec: currTimeSec,
		stringNormalizeLen: stringNormalizeLen,
		deltaSecToString: deltaSecToString,
		deltaMiliSecToString: deltaMiliSecToString,
		miliSecToString: miliSecToString,
		hrp: hrp,
	};

});