const CFG_PATH = "config.json";
const CFG_POOLS_PATH = "pools.json";

const Paths = require('./paths');

const fs = require('fs');
const EventEmitter = require('events').EventEmitter;

const Logger = require("./Logger");
const Common = require("./Common");
const WebServer = require("./WebServer");

const StratumConfig = require("./StratumConfig");
const StratumCommon = require("./StratumCommon");
const StratumProxy = require("./StratumProxy");

const WebStatPools          = require("./WebStat/Pools");
const WebStatWorkers        = require("./WebStat/Workers");
const WebStatJobs           = require("./WebStat/Jobs");
const WebStatShares         = require("./WebStat/Shares");
const WebStatLogs           = require("./WebStat/Logs");
const WebStatGlobalHashRate = require("./WebStat/GlobalHashRate");
const WebNoty               = require("./WebStat/Noty");
const WebAuth               = require("./WebAuth");
const WebControl            = require("./WebControl");

function getConfig(logger, path) {
	let config = null;
	
	try {
		let file = require('fs').readFileSync(path, 'utf8');
		
		eval('var _cfg = ' + file);

		config = _cfg;
	} catch(e) {
		config = null;
		logger.error("Config \"" + path + "\" not found, or config file invalid json");
	}
	
	return config;
}



function main(logger) {
	
	let cfg = getConfig(logger, CFG_PATH);
	
	if ( !cfg ) {
		setTimeout(() => main(logger), 5e3);
		return;
	}

	let events = new EventEmitter();
	events.setMaxListeners(20);
	
	let http_addr_info = Common.addressEx(cfg.http_address);
	
	if ( cfg.web_server && cfg.web_server.enable ) {
		let http_addr_info = Common.addressEx(cfg.web_server.bind_address);
		
		if ( http_addr_info ) {
			logger.success("Web server is powered on");

			///	############## web server
			let webServerCreate = () => new WebServer(cfg.web_server.bind_address, [Paths.APP_WEB_PUBLIC_DIR], events, logger);
			events.on("web:server:close", ()=> setTimeout(webServerCreate, 5e3));
			webServerCreate();

			new WebStatPools(events);
			new WebStatWorkers(events);
			new WebStatJobs(events);
			new WebStatShares(events);
			new WebStatLogs(events, logger);
			new WebStatGlobalHashRate(events);

			new WebNoty(events);
			
			new WebAuth(cfg.web_server.auth_key, events);
			
			if ( cfg.web_server.open_browser ) {
				require('child_process').exec("explorer http://" + (( http_addr_info[0] === "0.0.0.0" ) ? "127.0.0.1" : http_addr_info[0]) + ":" + http_addr_info[1]);
			}
		}
	} else {
		logger.warning("Web server is powered off");
	}
	
	new StratumProxy(cfg, null, events, logger);
	
	///	############## control
	let pools = [];
	try { pools = JSON.parse(fs.readFileSync(CFG_POOLS_PATH, "utf8")); } catch(e) {logger.error("Invalid config pools \""+CFG_POOLS_PATH+"\"");}
	new WebControl(events, pools);
		
	events.on("config:pools:save", (pools) => {
		let json = JSON.stringify(pools, null, '	');
		fs.writeFileSync(CFG_POOLS_PATH, json);
	});		
}



main(
	new Logger((log) => {
		let d = new Date();
		console.log(`[${d.toLocaleDateString()} ${d.toLocaleTimeString()}] ${log}`);
	}, "APP")
);

/***********************************/



setInterval(() => {
	//GB_Stat.addLog("My log = " + Math.random())
}, 1e3)

