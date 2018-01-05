# Stratum Proxy for CryptoNight


### Requirements:
Mining programs that connect to this proxy must have nicehash nonce support and enable it
* `--nicehash` or `"nicehash": true` for XMRig 
* `"nicehash_nonce": true,` for xmr-stak


### Features:
* Centralized pool and wallet management at proxy for easy switching/failover 
* Accumulates all workers (miners) power for higher difficulty between the proxy and pool. Only valid shares of eligible difficulty are sent back to the pool
* Individualized auto-difficulty for lower difficulty negotiation to each worker
* SSL/TLS compatible for pool connection and worker connections 
* Web panel:
  * __View of individual Workers__
  * View of Pool connection(s) 
  * View of Jobs (blocks) received by pool including time spent working, hashes, accepted/rejected shares 
  * View of Shares solved by miners including which worker solved it 
  * View of Console from proxy program 
  * Configuration of pool(s)


### Usage:
1. Edit config.json to change ports or difficulty if needed
2. Launch startup.exe 
  ```.\startup.exe```
3. Connect to web portal in a browser (default on port 8000). Default login password (Auth key) is in config.json


### Screenshots (click to enlarge):

* Workers tab
  ![img](https://github.com/JerryWm/JerryWm.github.io/raw/master/_resources/imgs/stratum_proxy/img2.png "Workers tab")
  
* Pools tab
  ![img](https://github.com/JerryWm/JerryWm.github.io/raw/master/_resources/imgs/stratum_proxy/img3.png "Pools tab")

* Jobs tab
  ![img](https://github.com/JerryWm/JerryWm.github.io/raw/master/_resources/imgs/stratum_proxy/img4.png "Jobs tab")

* Shares tab
  ![img](https://github.com/JerryWm/JerryWm.github.io/raw/master/_resources/imgs/stratum_proxy/img5.png "Shares tab")

* Console tab
  ![img](https://github.com/JerryWm/JerryWm.github.io/raw/master/_resources/imgs/stratum_proxy/img6.png)
  
* Settings tab (pool configuration)
  ![img](https://github.com/JerryWm/JerryWm.github.io/raw/master/_resources/imgs/stratum_proxy/img1.png "Settings tab" )

