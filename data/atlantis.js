
var Module = typeof Module !== 'undefined' ? Module : {};

if (!Module.expectedDataFileDownloads) {
  Module.expectedDataFileDownloads = 0;
  Module.finishedDataFileDownloads = 0;
}
Module.expectedDataFileDownloads++;
(function() {
 var loadPackage = function(metadata) {

    var PACKAGE_PATH;
    if (typeof window === 'object') {
      PACKAGE_PATH = window['encodeURIComponent'](window.location.pathname.toString().substring(0, window.location.pathname.toString().lastIndexOf('/')) + '/');
    } else if (typeof location !== 'undefined') {
      // worker
      PACKAGE_PATH = encodeURIComponent(location.pathname.toString().substring(0, location.pathname.toString().lastIndexOf('/')) + '/');
    } else {
      throw 'using preloaded data can only be done on a web page or in a web worker';
    }
    var PACKAGE_NAME = 'web/data/atlantis.data';
    var REMOTE_PACKAGE_BASE = 'data/atlantis.data';
    if (typeof Module['locateFilePackage'] === 'function' && !Module['locateFile']) {
      Module['locateFile'] = Module['locateFilePackage'];
      err('warning: you defined Module.locateFilePackage, that has been renamed to Module.locateFile (using your locateFilePackage for now)');
    }
    var REMOTE_PACKAGE_NAME = Module['locateFile'] ? Module['locateFile'](REMOTE_PACKAGE_BASE, '') : REMOTE_PACKAGE_BASE;
  
    var REMOTE_PACKAGE_SIZE = metadata.remote_package_size;
    var PACKAGE_UUID = metadata.package_uuid;
  
    function fetchRemotePackage(packageName, packageSize, callback, errback) {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', packageName, true);
      xhr.responseType = 'arraybuffer';
      xhr.onprogress = function(event) {
        var url = packageName;
        var size = packageSize;
        if (event.total) size = event.total;
        if (event.loaded) {
          if (!xhr.addedTotal) {
            xhr.addedTotal = true;
            if (!Module.dataFileDownloads) Module.dataFileDownloads = {};
            Module.dataFileDownloads[url] = {
              loaded: event.loaded,
              total: size
            };
          } else {
            Module.dataFileDownloads[url].loaded = event.loaded;
          }
          var total = 0;
          var loaded = 0;
          var num = 0;
          for (var download in Module.dataFileDownloads) {
          var data = Module.dataFileDownloads[download];
            total += data.total;
            loaded += data.loaded;
            num++;
          }
          total = Math.ceil(total * Module.expectedDataFileDownloads/num);
          if (Module['setStatus']) Module['setStatus']('Downloading data... (' + loaded + '/' + total + ')');
        } else if (!Module.dataFileDownloads) {
          if (Module['setStatus']) Module['setStatus']('Downloading data...');
        }
      };
      xhr.onerror = function(event) {
        throw new Error("NetworkError for: " + packageName);
      }
      xhr.onload = function(event) {
        if (xhr.status == 200 || xhr.status == 304 || xhr.status == 206 || (xhr.status == 0 && xhr.response)) { // file URLs can return 0
          var packageData = xhr.response;
          callback(packageData);
        } else {
          throw new Error(xhr.statusText + " : " + xhr.responseURL);
        }
      };
      xhr.send(null);
    };

    function handleError(error) {
      console.error('package error:', error);
    };
  
  function runWithFS() {

    function assert(check, msg) {
      if (!check) throw msg + new Error().stack;
    }
Module['FS_createPath']('/', 'data', true, true);
Module['FS_createPath']('/data', 'images', true, true);
Module['FS_createPath']('/data/images', 'atlantis', true, true);
Module['FS_createPath']('/data', 'script', true, true);
Module['FS_createPath']('/data/script', 'atlantis', true, true);
Module['FS_createPath']('/data', 'sound', true, true);
Module['FS_createPath']('/data/sound', 'atlantis', true, true);
Module['FS_createPath']('/data/sound/atlantis', 'cs', true, true);
Module['FS_createPath']('/data/sound/atlantis', 'nl', true, true);

    function DataRequest(start, end, audio) {
      this.start = start;
      this.end = end;
      this.audio = audio;
    }
    DataRequest.prototype = {
      requests: {},
      open: function(mode, name) {
        this.name = name;
        this.requests[name] = this;
        Module['addRunDependency']('fp ' + this.name);
      },
      send: function() {},
      onload: function() {
        var byteArray = this.byteArray.subarray(this.start, this.end);
        this.finish(byteArray);
      },
      finish: function(byteArray) {
        var that = this;

        Module['FS_createPreloadedFile'](this.name, null, byteArray, true, true, function() {
          Module['removeRunDependency']('fp ' + that.name);
        }, function() {
          if (that.audio) {
            Module['removeRunDependency']('fp ' + that.name); // workaround for chromium bug 124926 (still no audio with this, but at least we don't hang)
          } else {
            err('Preloading file ' + that.name + ' failed');
          }
        }, false, true); // canOwn this data in the filesystem, it is a slide into the heap that will never change

        this.requests[this.name] = null;
      }
    };

        var files = metadata.files;
        for (var i = 0; i < files.length; ++i) {
          new DataRequest(files[i].start, files[i].end, files[i].audio).open('GET', files[i].filename);
        }

  
      var indexedDB = window.indexedDB || window.mozIndexedDB || window.webkitIndexedDB || window.msIndexedDB;
      var IDB_RO = "readonly";
      var IDB_RW = "readwrite";
      var DB_NAME = "EM_PRELOAD_CACHE";
      var DB_VERSION = 1;
      var METADATA_STORE_NAME = 'METADATA';
      var PACKAGE_STORE_NAME = 'PACKAGES';
      function openDatabase(callback, errback) {
        try {
          var openRequest = indexedDB.open(DB_NAME, DB_VERSION);
        } catch (e) {
          return errback(e);
        }
        openRequest.onupgradeneeded = function(event) {
          var db = event.target.result;

          if(db.objectStoreNames.contains(PACKAGE_STORE_NAME)) {
            db.deleteObjectStore(PACKAGE_STORE_NAME);
          }
          var packages = db.createObjectStore(PACKAGE_STORE_NAME);

          if(db.objectStoreNames.contains(METADATA_STORE_NAME)) {
            db.deleteObjectStore(METADATA_STORE_NAME);
          }
          var metadata = db.createObjectStore(METADATA_STORE_NAME);
        };
        openRequest.onsuccess = function(event) {
          var db = event.target.result;
          callback(db);
        };
        openRequest.onerror = function(error) {
          errback(error);
        };
      };

      // This is needed as chromium has a limit on per-entry files in IndexedDB
      // https://cs.chromium.org/chromium/src/content/renderer/indexed_db/webidbdatabase_impl.cc?type=cs&sq=package:chromium&g=0&l=177
      // https://cs.chromium.org/chromium/src/out/Debug/gen/third_party/blink/public/mojom/indexeddb/indexeddb.mojom.h?type=cs&sq=package:chromium&g=0&l=60
      // We set the chunk size to 64MB to stay well-below the limit
      var CHUNK_SIZE = 64 * 1024 * 1024;

      function cacheRemotePackage(
        db,
        packageName,
        packageData,
        packageMeta,
        callback,
        errback
      ) {
        var transactionPackages = db.transaction([PACKAGE_STORE_NAME], IDB_RW);
        var packages = transactionPackages.objectStore(PACKAGE_STORE_NAME);
        var chunkSliceStart = 0;
        var nextChunkSliceStart = 0;
        var chunkCount = Math.ceil(packageData.byteLength / CHUNK_SIZE);
        var finishedChunks = 0;
        for (var chunkId = 0; chunkId < chunkCount; chunkId++) {
          nextChunkSliceStart += CHUNK_SIZE;
          var putPackageRequest = packages.put(
            packageData.slice(chunkSliceStart, nextChunkSliceStart),
            'package/' + packageName + '/' + chunkId
          );
          chunkSliceStart = nextChunkSliceStart;
          putPackageRequest.onsuccess = function(event) {
            finishedChunks++;
            if (finishedChunks == chunkCount) {
              var transaction_metadata = db.transaction(
                [METADATA_STORE_NAME],
                IDB_RW
              );
              var metadata = transaction_metadata.objectStore(METADATA_STORE_NAME);
              var putMetadataRequest = metadata.put(
                {
                  uuid: packageMeta.uuid,
                  chunkCount: chunkCount
                },
                'metadata/' + packageName
              );
              putMetadataRequest.onsuccess = function(event) {
                callback(packageData);
              };
              putMetadataRequest.onerror = function(error) {
                errback(error);
              };
            }
          };
          putPackageRequest.onerror = function(error) {
            errback(error);
          };
        }
      }

      /* Check if there's a cached package, and if so whether it's the latest available */
      function checkCachedPackage(db, packageName, callback, errback) {
        var transaction = db.transaction([METADATA_STORE_NAME], IDB_RO);
        var metadata = transaction.objectStore(METADATA_STORE_NAME);
        var getRequest = metadata.get('metadata/' + packageName);
        getRequest.onsuccess = function(event) {
          var result = event.target.result;
          if (!result) {
            return callback(false, null);
          } else {
            return callback(PACKAGE_UUID === result.uuid, result);
          }
        };
        getRequest.onerror = function(error) {
          errback(error);
        };
      }

      function fetchCachedPackage(db, packageName, metadata, callback, errback) {
        var transaction = db.transaction([PACKAGE_STORE_NAME], IDB_RO);
        var packages = transaction.objectStore(PACKAGE_STORE_NAME);

        var chunksDone = 0;
        var totalSize = 0;
        var chunks = new Array(metadata.chunkCount);

        for (var chunkId = 0; chunkId < metadata.chunkCount; chunkId++) {
          var getRequest = packages.get('package/' + packageName + '/' + chunkId);
          getRequest.onsuccess = function(event) {
            // If there's only 1 chunk, there's nothing to concatenate it with so we can just return it now
            if (metadata.chunkCount == 1) {
              callback(event.target.result);
            } else {
              chunksDone++;
              totalSize += event.target.result.byteLength;
              chunks.push(event.target.result);
              if (chunksDone == metadata.chunkCount) {
                if (chunksDone == 1) {
                  callback(event.target.result);
                } else {
                  var tempTyped = new Uint8Array(totalSize);
                  var byteOffset = 0;
                  for (var chunkId in chunks) {
                    var buffer = chunks[chunkId];
                    tempTyped.set(new Uint8Array(buffer), byteOffset);
                    byteOffset += buffer.byteLength;
                    buffer = undefined;
                  }
                  chunks = undefined;
                  callback(tempTyped.buffer);
                  tempTyped = undefined;
                }
              }
            }
          };
          getRequest.onerror = function(error) {
            errback(error);
          };
        }
      }
    
    function processPackageData(arrayBuffer) {
      Module.finishedDataFileDownloads++;
      assert(arrayBuffer, 'Loading data file failed.');
      assert(arrayBuffer instanceof ArrayBuffer, 'bad input to processPackageData');
      var byteArray = new Uint8Array(arrayBuffer);
      var curr;
      
        // Reuse the bytearray from the XHR as the source for file reads.
        DataRequest.prototype.byteArray = byteArray;
  
          var files = metadata.files;
          for (var i = 0; i < files.length; ++i) {
            DataRequest.prototype.requests[files[i].filename].onload();
          }
              Module['removeRunDependency']('datafile_web/data/atlantis.data');

    };
    Module['addRunDependency']('datafile_web/data/atlantis.data');
  
    if (!Module.preloadResults) Module.preloadResults = {};
  
      function preloadFallback(error) {
        console.error(error);
        console.error('falling back to default preload behavior');
        fetchRemotePackage(REMOTE_PACKAGE_NAME, REMOTE_PACKAGE_SIZE, processPackageData, handleError);
      };

      openDatabase(
        function(db) {
          checkCachedPackage(db, PACKAGE_PATH + PACKAGE_NAME,
            function(useCached, metadata) {
              Module.preloadResults[PACKAGE_NAME] = {fromCache: useCached};
              if (useCached) {
                console.info('loading ' + PACKAGE_NAME + ' from cache');
                fetchCachedPackage(db, PACKAGE_PATH + PACKAGE_NAME, metadata, processPackageData, preloadFallback);
              } else {
                console.info('loading ' + PACKAGE_NAME + ' from remote');
                fetchRemotePackage(REMOTE_PACKAGE_NAME, REMOTE_PACKAGE_SIZE,
                  function(packageData) {
                    cacheRemotePackage(db, PACKAGE_PATH + PACKAGE_NAME, packageData, {uuid:PACKAGE_UUID}, processPackageData,
                      function(error) {
                        console.error(error);
                        processPackageData(packageData);
                      });
                  }
                , preloadFallback);
              }
            }
          , preloadFallback);
        }
      , preloadFallback);

      if (Module['setStatus']) Module['setStatus']('Downloading...');
    
  }
  if (Module['calledRun']) {
    runWithFS();
  } else {
    if (!Module['preRun']) Module['preRun'] = [];
    Module["preRun"].push(runWithFS); // FS is not initialized yet, wait for it
  }

 }
 loadPackage({"files": [{"filename": "/data/images/atlantis/12-ocel.png", "start": 0, "end": 498, "audio": 0}, {"filename": "/data/images/atlantis/15-ocel.png", "start": 498, "end": 1194, "audio": 0}, {"filename": "/data/images/atlantis/19-ocel.png", "start": 1194, "end": 1692, "audio": 0}, {"filename": "/data/images/atlantis/2-ocel.png", "start": 1692, "end": 3159, "audio": 0}, {"filename": "/data/images/atlantis/5-ocel.png", "start": 3159, "end": 4534, "audio": 0}, {"filename": "/data/images/atlantis/6-ocel.png", "start": 4534, "end": 6871, "audio": 0}, {"filename": "/data/images/atlantis/atikac.png", "start": 6871, "end": 8635, "audio": 0}, {"filename": "/data/images/atlantis/hlava_m-_00.png", "start": 8635, "end": 9351, "audio": 0}, {"filename": "/data/images/atlantis/hlava_m-_01.png", "start": 9351, "end": 10076, "audio": 0}, {"filename": "/data/images/atlantis/hlava_m-_02.png", "start": 10076, "end": 10812, "audio": 0}, {"filename": "/data/images/atlantis/krab_00.png", "start": 10812, "end": 11895, "audio": 0}, {"filename": "/data/images/atlantis/krab_01.png", "start": 11895, "end": 12973, "audio": 0}, {"filename": "/data/images/atlantis/krab_02.png", "start": 12973, "end": 14037, "audio": 0}, {"filename": "/data/images/atlantis/krab_03.png", "start": 14037, "end": 15109, "audio": 0}, {"filename": "/data/images/atlantis/krab_04.png", "start": 15109, "end": 16187, "audio": 0}, {"filename": "/data/images/atlantis/krab_05.png", "start": 16187, "end": 17268, "audio": 0}, {"filename": "/data/images/atlantis/krab_06.png", "start": 17268, "end": 18399, "audio": 0}, {"filename": "/data/images/atlantis/krab_07.png", "start": 18399, "end": 19516, "audio": 0}, {"filename": "/data/images/atlantis/krab_08.png", "start": 19516, "end": 20583, "audio": 0}, {"filename": "/data/images/atlantis/krab_09.png", "start": 20583, "end": 21693, "audio": 0}, {"filename": "/data/images/atlantis/maly_snek_00.png", "start": 21693, "end": 22367, "audio": 0}, {"filename": "/data/images/atlantis/maly_snek_01.png", "start": 22367, "end": 23064, "audio": 0}, {"filename": "/data/images/atlantis/maly_snek_02.png", "start": 23064, "end": 23781, "audio": 0}, {"filename": "/data/images/atlantis/maly_snek_03.png", "start": 23781, "end": 24441, "audio": 0}, {"filename": "/data/images/atlantis/poster.png", "start": 24441, "end": 146906, "audio": 0}, {"filename": "/data/images/atlantis/sloupek_b.png", "start": 146906, "end": 147986, "audio": 0}, {"filename": "/data/images/atlantis/spunt.png", "start": 147986, "end": 159360, "audio": 0}, {"filename": "/data/images/atlantis/spunt-p.png", "start": 159360, "end": 659458, "audio": 0}, {"filename": "/data/images/atlantis/spunt-zed.png", "start": 659458, "end": 1086616, "audio": 0}, {"filename": "/data/script/atlantis/code.lua", "start": 1086616, "end": 1099093, "audio": 0}, {"filename": "/data/script/atlantis/demo_dialogs_bg.lua", "start": 1099093, "end": 1100176, "audio": 0}, {"filename": "/data/script/atlantis/demo_dialogs_cs.lua", "start": 1100176, "end": 1100619, "audio": 0}, {"filename": "/data/script/atlantis/demo_dialogs_de_CH.lua", "start": 1100619, "end": 1101483, "audio": 0}, {"filename": "/data/script/atlantis/demo_dialogs_de.lua", "start": 1101483, "end": 1102347, "audio": 0}, {"filename": "/data/script/atlantis/demo_dialogs_en.lua", "start": 1102347, "end": 1102775, "audio": 0}, {"filename": "/data/script/atlantis/demo_dialogs_es.lua", "start": 1102775, "end": 1103613, "audio": 0}, {"filename": "/data/script/atlantis/demo_dialogs_fr.lua", "start": 1103613, "end": 1104490, "audio": 0}, {"filename": "/data/script/atlantis/demo_dialogs_it.lua", "start": 1104490, "end": 1105304, "audio": 0}, {"filename": "/data/script/atlantis/demo_dialogs_nl.lua", "start": 1105304, "end": 1106158, "audio": 0}, {"filename": "/data/script/atlantis/demo_dialogs_pl.lua", "start": 1106158, "end": 1106982, "audio": 0}, {"filename": "/data/script/atlantis/demo_dialogs_ru.lua", "start": 1106982, "end": 1108066, "audio": 0}, {"filename": "/data/script/atlantis/demo_dialogs_sv.lua", "start": 1108066, "end": 1108888, "audio": 0}, {"filename": "/data/script/atlantis/demo_poster.lua", "start": 1108888, "end": 1109206, "audio": 0}, {"filename": "/data/script/atlantis/dialogs_bg.lua", "start": 1109206, "end": 1115408, "audio": 0}, {"filename": "/data/script/atlantis/dialogs_cs.lua", "start": 1115408, "end": 1120416, "audio": 0}, {"filename": "/data/script/atlantis/dialogs_de_CH.lua", "start": 1120416, "end": 1120673, "audio": 0}, {"filename": "/data/script/atlantis/dialogs_de.lua", "start": 1120673, "end": 1125896, "audio": 0}, {"filename": "/data/script/atlantis/dialogs_en.lua", "start": 1125896, "end": 1128862, "audio": 0}, {"filename": "/data/script/atlantis/dialogs_es.lua", "start": 1128862, "end": 1134099, "audio": 0}, {"filename": "/data/script/atlantis/dialogs_fr.lua", "start": 1134099, "end": 1139435, "audio": 0}, {"filename": "/data/script/atlantis/dialogs_it.lua", "start": 1139435, "end": 1144474, "audio": 0}, {"filename": "/data/script/atlantis/dialogs.lua", "start": 1144474, "end": 1144512, "audio": 0}, {"filename": "/data/script/atlantis/dialogs_nl.lua", "start": 1144512, "end": 1149813, "audio": 0}, {"filename": "/data/script/atlantis/dialogs_pl.lua", "start": 1149813, "end": 1154922, "audio": 0}, {"filename": "/data/script/atlantis/dialogs_ru.lua", "start": 1154922, "end": 1161177, "audio": 0}, {"filename": "/data/script/atlantis/dialogs_sv.lua", "start": 1161177, "end": 1166317, "audio": 0}, {"filename": "/data/script/atlantis/init.lua", "start": 1166317, "end": 1166964, "audio": 0}, {"filename": "/data/script/atlantis/models.lua", "start": 1166964, "end": 1171373, "audio": 0}, {"filename": "/data/sound/atlantis/cs/sp-m-costim.ogg", "start": 1171373, "end": 1186336, "audio": 1}, {"filename": "/data/sound/atlantis/cs/sp-m-kalet.ogg", "start": 1186336, "end": 1228600, "audio": 1}, {"filename": "/data/sound/atlantis/cs/sp-m-nechat.ogg", "start": 1228600, "end": 1247051, "audio": 1}, {"filename": "/data/sound/atlantis/cs/sp-m-neopatrnost.ogg", "start": 1247051, "end": 1261233, "audio": 1}, {"filename": "/data/sound/atlantis/cs/sp-m-no1.ogg", "start": 1261233, "end": 1274680, "audio": 1}, {"filename": "/data/sound/atlantis/cs/sp-m-potize.ogg", "start": 1274680, "end": 1344358, "audio": 1}, {"filename": "/data/sound/atlantis/cs/sp-m-spunt.ogg", "start": 1344358, "end": 1372723, "audio": 1}, {"filename": "/data/sound/atlantis/cs/sp-m-taky.ogg", "start": 1372723, "end": 1384849, "audio": 1}, {"filename": "/data/sound/atlantis/cs/sp-m-vratit0.ogg", "start": 1384849, "end": 1414399, "audio": 1}, {"filename": "/data/sound/atlantis/cs/sp-m-vratit1.ogg", "start": 1414399, "end": 1487873, "audio": 1}, {"filename": "/data/sound/atlantis/cs/sp-m-vydrz.ogg", "start": 1487873, "end": 1508587, "audio": 1}, {"filename": "/data/sound/atlantis/cs/sp-m-vymluva0.ogg", "start": 1508587, "end": 1531615, "audio": 1}, {"filename": "/data/sound/atlantis/cs/sp-m-vymluva1.ogg", "start": 1531615, "end": 1559430, "audio": 1}, {"filename": "/data/sound/atlantis/cs/sp-m-vymluva2.ogg", "start": 1559430, "end": 1581409, "audio": 1}, {"filename": "/data/sound/atlantis/cs/sp-m-vymluva3.ogg", "start": 1581409, "end": 1602467, "audio": 1}, {"filename": "/data/sound/atlantis/cs/sp-m-vymluva4.ogg", "start": 1602467, "end": 1624022, "audio": 1}, {"filename": "/data/sound/atlantis/cs/sp-m-vytazeny.ogg", "start": 1624022, "end": 1638904, "audio": 1}, {"filename": "/data/sound/atlantis/cs/sp-v-centrala.ogg", "start": 1638904, "end": 1654518, "audio": 1}, {"filename": "/data/sound/atlantis/cs/sp-v-co.ogg", "start": 1654518, "end": 1668082, "audio": 1}, {"filename": "/data/sound/atlantis/cs/sp-v-dotoho.ogg", "start": 1668082, "end": 1679650, "audio": 1}, {"filename": "/data/sound/atlantis/cs/sp-v-jedno.ogg", "start": 1679650, "end": 1702500, "audio": 1}, {"filename": "/data/sound/atlantis/cs/sp-v-kdoby.ogg", "start": 1702500, "end": 1714782, "audio": 1}, {"filename": "/data/sound/atlantis/cs/sp-v-nesmysl.ogg", "start": 1714782, "end": 1729783, "audio": 1}, {"filename": "/data/sound/atlantis/cs/sp-v-no0.ogg", "start": 1729783, "end": 1742577, "audio": 1}, {"filename": "/data/sound/atlantis/cs/sp-v-pocit.ogg", "start": 1742577, "end": 1757209, "audio": 1}, {"filename": "/data/sound/atlantis/cs/sp-v-trapne.ogg", "start": 1757209, "end": 1771540, "audio": 1}, {"filename": "/data/sound/atlantis/cs/sp-v-ven.ogg", "start": 1771540, "end": 1799061, "audio": 1}, {"filename": "/data/sound/atlantis/cs/sp-v-vratit0.ogg", "start": 1799061, "end": 1816706, "audio": 1}, {"filename": "/data/sound/atlantis/cs/sp-v-vratit1.ogg", "start": 1816706, "end": 1889888, "audio": 1}, {"filename": "/data/sound/atlantis/cs/sp-v-vzit.ogg", "start": 1889888, "end": 1917293, "audio": 1}, {"filename": "/data/sound/atlantis/cs/sp-v-zahynuli.ogg", "start": 1917293, "end": 1961169, "audio": 1}, {"filename": "/data/sound/atlantis/nl/sp-m-costim.ogg", "start": 1961169, "end": 1978227, "audio": 1}, {"filename": "/data/sound/atlantis/nl/sp-m-kalet.ogg", "start": 1978227, "end": 2012886, "audio": 1}, {"filename": "/data/sound/atlantis/nl/sp-m-nechat.ogg", "start": 2012886, "end": 2032738, "audio": 1}, {"filename": "/data/sound/atlantis/nl/sp-m-neopatrnost.ogg", "start": 2032738, "end": 2048928, "audio": 1}, {"filename": "/data/sound/atlantis/nl/sp-m-no1.ogg", "start": 2048928, "end": 2065033, "audio": 1}, {"filename": "/data/sound/atlantis/nl/sp-m-potize.ogg", "start": 2065033, "end": 2134804, "audio": 1}, {"filename": "/data/sound/atlantis/nl/sp-m-spunt.ogg", "start": 2134804, "end": 2167504, "audio": 1}, {"filename": "/data/sound/atlantis/nl/sp-m-taky.ogg", "start": 2167504, "end": 2182613, "audio": 1}, {"filename": "/data/sound/atlantis/nl/sp-m-vratit0.ogg", "start": 2182613, "end": 2214951, "audio": 1}, {"filename": "/data/sound/atlantis/nl/sp-m-vratit1.ogg", "start": 2214951, "end": 2284477, "audio": 1}, {"filename": "/data/sound/atlantis/nl/sp-m-vydrz.ogg", "start": 2284477, "end": 2301604, "audio": 1}, {"filename": "/data/sound/atlantis/nl/sp-m-vymluva0.ogg", "start": 2301604, "end": 2325875, "audio": 1}, {"filename": "/data/sound/atlantis/nl/sp-m-vymluva1.ogg", "start": 2325875, "end": 2361954, "audio": 1}, {"filename": "/data/sound/atlantis/nl/sp-m-vymluva2.ogg", "start": 2361954, "end": 2388424, "audio": 1}, {"filename": "/data/sound/atlantis/nl/sp-m-vymluva3.ogg", "start": 2388424, "end": 2415916, "audio": 1}, {"filename": "/data/sound/atlantis/nl/sp-m-vymluva4.ogg", "start": 2415916, "end": 2443309, "audio": 1}, {"filename": "/data/sound/atlantis/nl/sp-m-vytazeny.ogg", "start": 2443309, "end": 2460506, "audio": 1}, {"filename": "/data/sound/atlantis/nl/sp-v-centrala.ogg", "start": 2460506, "end": 2485356, "audio": 1}, {"filename": "/data/sound/atlantis/nl/sp-v-co.ogg", "start": 2485356, "end": 2502248, "audio": 1}, {"filename": "/data/sound/atlantis/nl/sp-v-dotoho.ogg", "start": 2502248, "end": 2520576, "audio": 1}, {"filename": "/data/sound/atlantis/nl/sp-v-jedno.ogg", "start": 2520576, "end": 2547772, "audio": 1}, {"filename": "/data/sound/atlantis/nl/sp-v-kdoby.ogg", "start": 2547772, "end": 2567367, "audio": 1}, {"filename": "/data/sound/atlantis/nl/sp-v-nesmysl.ogg", "start": 2567367, "end": 2586310, "audio": 1}, {"filename": "/data/sound/atlantis/nl/sp-v-no0.ogg", "start": 2586310, "end": 2604234, "audio": 1}, {"filename": "/data/sound/atlantis/nl/sp-v-pocit.ogg", "start": 2604234, "end": 2626798, "audio": 1}, {"filename": "/data/sound/atlantis/nl/sp-v-trapne.ogg", "start": 2626798, "end": 2645467, "audio": 1}, {"filename": "/data/sound/atlantis/nl/sp-v-ven.ogg", "start": 2645467, "end": 2672957, "audio": 1}, {"filename": "/data/sound/atlantis/nl/sp-v-vratit0.ogg", "start": 2672957, "end": 2693189, "audio": 1}, {"filename": "/data/sound/atlantis/nl/sp-v-vratit1.ogg", "start": 2693189, "end": 2760473, "audio": 1}, {"filename": "/data/sound/atlantis/nl/sp-v-vzit.ogg", "start": 2760473, "end": 2790799, "audio": 1}, {"filename": "/data/sound/atlantis/nl/sp-v-zahynuli.ogg", "start": 2790799, "end": 2831225, "audio": 1}], "remote_package_size": 2831225, "package_uuid": "f5d63a0d-0ce7-4191-97c3-75b16b321b10"});

})();
