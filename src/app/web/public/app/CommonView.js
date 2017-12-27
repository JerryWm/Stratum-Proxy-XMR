define(["app/Common", "app/UnPackArray"], function(Common, UnPackArray) {

	function viewDisconnectTime(time, errorMsg, errorTitle) {
		errorMsg = errorMsg || "";
		errorTitle = errorTitle || "Error description";
		
		return time === null ? 
			'<span style="color: #28a745; text-shadow: -3px -2px 5px;">Alive</span>' : 
			`<a 
				href="javascript:void(0);" 
				tabindex="0"  
				style="color: #dc3545; text-shadow: -3px -2px 5px; text-decoration: none;" 
				data-toggle="popover" 
				data-trigger="focus"
				title="${errorTitle}" 
				data-content="${Common.escapeHtml(errorMsg)}"
			>
				${Common.miliSecToString(time)}
			</a>`;
	}
	
	var __viewUpdateTime_init = false;
	function viewUpdateTime(time_in_work, time_update, alive) {
		if ( !__viewUpdateTime_init ) {
			$(function() {
				function loop() {
					$('[update_time]').each(function(i, elem) {
						elem = $(elem);
						var time_start = parseInt(elem.attr('start_time'));
						if ( time_start ) {
							elem.text( Common.deltaMiliSecToString( Common.currTimeMiliSec() - time_start ) );
						}
					});
					
					setTimeout(loop, 1e3);
				}
				
				loop();
			});
			
			__viewUpdateTime_init = true;
		}
		
		
		var time_start = time_update - time_in_work;
			
		return `<span ${alive?"update_time":""} start_time="${time_start}" >
				${Common.deltaMiliSecToString( Common.currTimeMiliSec() - time_start )}
			</span>`;
	}
		
	function viewCode(text) {
		return `<code>${text}</code>`;
	}
		
	function viewClickPopoverInfo(id, title, info, len, eventClickName, idName) {
		return `
				<span  tabindex="0"  
					${idName}="${id}"
					title="${title}"
					style="cursor: pointer; text-shadow: -3px -2px 5px; text-decoration: none;" 
					event-click="${eventClickName}"
				>
					${Common.escapeHtml(Common.stringNormalizeLen(info, len))}
				</span>
				`;			
	}
	
	function viewHashRate(hashrate) {
		return `<div class="hrtb">
				<div>
					<div>${Common.intOrNA(hashrate["current"])}</div>
					<div>${Common.intOrNA(hashrate["5"])}</div>
					<div>${Common.intOrNA(hashrate["10"])}</div>
					<div>${Common.intOrNA(hashrate["15"])}</div>
					<div>${Common.intOrNA(hashrate["30"])}</div>
					<div>${Common.intOrNA(hashrate["60"])}</div>
					<div>${Common.intOrNA(hashrate["all"])}</div>
				</div>
			</div>
		`;
	}
	function viewHashRateFull(hashrate) {
		return `<table class="table">${this.viewHashRateFullHtmlInTable(hashrate)}</table>`;
	}
	function viewHashRateFullHtmlInTable(hashrate) {
		return `
					<thead>
						<tr>
							<td>CR</td>
							<td>5m</td>
							<td>10m</td>
							<td>15m</td>
							<td>30m</td>
							<td>1h</td>
							<td>2h</td>
							<td>3h</td>
							<td>6h</td>
							<td>12h</td>
							<td>24h</td>
							<td>ALL</td>
						</tr>
					</thead>
					<tbody>
						<tr>
							<td>${Common.intOrNA(hashrate["current"])}</td>
							<td>${Common.intOrNA(hashrate["5"])}</td>
							<td>${Common.intOrNA(hashrate["10"])}</td>
							<td>${Common.intOrNA(hashrate["15"])}</td>
							<td>${Common.intOrNA(hashrate["30"])}</td>
							<td>${Common.intOrNA(hashrate["60"])}</td>
							<td>${Common.intOrNA(hashrate[60*2])}</td>
							<td>${Common.intOrNA(hashrate[60*3])}</td>
							<td>${Common.intOrNA(hashrate[60*6])}</td>
							<td>${Common.intOrNA(hashrate[60*12])}</td>
							<td>${Common.intOrNA(hashrate[60*24])}</td>
							<td>${Common.intOrNA(hashrate["all"])}</td>
						</tr>
					</tbody>
		`;
	}
	
	return {
		viewDisconnectTime: viewDisconnectTime,
		viewUpdateTime: viewUpdateTime,
		viewClickPopoverInfo: viewClickPopoverInfo,
		viewCode: viewCode,
		viewHashRate: viewHashRate,
		viewHashRateFull: viewHashRateFull,
		viewHashRateFullHtmlInTable: viewHashRateFullHtmlInTable,
	};

});