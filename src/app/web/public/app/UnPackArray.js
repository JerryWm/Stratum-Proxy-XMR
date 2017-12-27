(function() {
	
function UnPackArray(str) {

	var MSG_START_MARKER = "\x00\x00";
	var MSG_DELTA_MARKER = "\x00\x01";
	var MSG_END_MARKER   = "\x00\x02";	
	
	var listObj = [];
	var objList = Object.create(null);

	var startIndex = 0;
	var deltaIndex = 0;
	var endIndex = 0;
	
	var name = "";
	var json = "";
	var obj;

	while(1) {
		startIndex = str.indexOf(MSG_START_MARKER, endIndex);
		if ( startIndex < 0 ) { break; }
		startIndex += MSG_START_MARKER.length;
		
		deltaIndex = str.indexOf(MSG_DELTA_MARKER, startIndex);
		if ( deltaIndex < 0 ) { break; }
		
		name = str.substr(startIndex, deltaIndex - startIndex);
		deltaIndex += MSG_DELTA_MARKER.length;

		endIndex = str.indexOf(MSG_END_MARKER, deltaIndex);
		if ( endIndex < 0 ) { break; }
		
		json = str.substr(deltaIndex, endIndex - deltaIndex);

		var isJson = false;
		try {
			obj = JSON.parse(json);
			isJson = true;
		} catch(e) {}
		
		if ( isJson ) {
			listObj.push(obj);
			objList[name] = objList[name] || [];
			objList[name].push(obj);
		}
	}
	
	return {
		list: listObj,
		obj: objList,
	};
}

if ( typeof define === "function" ) {
	define([], function() {
		return UnPackArray;
	});
} else {
	if ( window ) {
		window.UnPackArray = UnPackArray;
	}
}

if ( typeof module !== "undefined" ) {
	module.exports = PackArray;
}

})();