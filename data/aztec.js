
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
    var PACKAGE_NAME = 'web/data/aztec.data';
    var REMOTE_PACKAGE_BASE = 'data/aztec.data';
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
Module['FS_createPath']('/data/images', 'aztec', true, true);
Module['FS_createPath']('/data', 'script', true, true);
Module['FS_createPath']('/data/script', 'aztec', true, true);
Module['FS_createPath']('/data', 'sound', true, true);
Module['FS_createPath']('/data/sound', 'aztec', true, true);
Module['FS_createPath']('/data/sound/aztec', 'cs', true, true);
Module['FS_createPath']('/data/sound/aztec', 'en', true, true);
Module['FS_createPath']('/data/sound/aztec', 'nl', true, true);

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
              Module['removeRunDependency']('datafile_web/data/aztec.data');

    };
    Module['addRunDependency']('datafile_web/data/aztec.data');
  
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
 loadPackage({"files": [{"filename": "/data/images/aztec/amfora_cervena.png", "start": 0, "end": 1032, "audio": 0}, {"filename": "/data/images/aztec/amfora.png", "start": 1032, "end": 2095, "audio": 0}, {"filename": "/data/images/aztec/amfora_zelena.png", "start": 2095, "end": 3021, "audio": 0}, {"filename": "/data/images/aztec/bottles-35-tmp.png", "start": 3021, "end": 3624, "audio": 0}, {"filename": "/data/images/aztec/bottles-3-tmp.png", "start": 3624, "end": 5071, "audio": 0}, {"filename": "/data/images/aztec/bottles-p.png", "start": 5071, "end": 541263, "audio": 0}, {"filename": "/data/images/aztec/bottles-wall.png", "start": 541263, "end": 906101, "audio": 0}, {"filename": "/data/images/aztec/drak_m_00.png", "start": 906101, "end": 909673, "audio": 0}, {"filename": "/data/images/aztec/drak_m_01.png", "start": 909673, "end": 913250, "audio": 0}, {"filename": "/data/images/aztec/drak.png", "start": 913250, "end": 937031, "audio": 0}, {"filename": "/data/images/aztec/hlavicka.png", "start": 937031, "end": 937749, "audio": 0}, {"filename": "/data/images/aztec/konik_00.png", "start": 937749, "end": 938730, "audio": 0}, {"filename": "/data/images/aztec/konik_01.png", "start": 938730, "end": 939683, "audio": 0}, {"filename": "/data/images/aztec/konik_02.png", "start": 939683, "end": 940654, "audio": 0}, {"filename": "/data/images/aztec/konik_03.png", "start": 940654, "end": 941656, "audio": 0}, {"filename": "/data/images/aztec/skull_00.png", "start": 941656, "end": 946382, "audio": 0}, {"filename": "/data/images/aztec/skull_01.png", "start": 946382, "end": 951114, "audio": 0}, {"filename": "/data/images/aztec/skull_02.png", "start": 951114, "end": 955842, "audio": 0}, {"filename": "/data/images/aztec/skull_03.png", "start": 955842, "end": 960551, "audio": 0}, {"filename": "/data/images/aztec/sloupek.png", "start": 960551, "end": 964023, "audio": 0}, {"filename": "/data/images/aztec/totem_00.png", "start": 964023, "end": 978518, "audio": 0}, {"filename": "/data/images/aztec/totem_01.png", "start": 978518, "end": 993031, "audio": 0}, {"filename": "/data/images/aztec/totem_02.png", "start": 993031, "end": 1007598, "audio": 0}, {"filename": "/data/images/aztec/totem_03.png", "start": 1007598, "end": 1022100, "audio": 0}, {"filename": "/data/images/aztec/totem_04.png", "start": 1022100, "end": 1036696, "audio": 0}, {"filename": "/data/images/aztec/totem_05.png", "start": 1036696, "end": 1051145, "audio": 0}, {"filename": "/data/images/aztec/vaza_cervena.png", "start": 1051145, "end": 1052001, "audio": 0}, {"filename": "/data/images/aztec/vaza.png", "start": 1052001, "end": 1053013, "audio": 0}, {"filename": "/data/images/aztec/vazavh.png", "start": 1053013, "end": 1054200, "audio": 0}, {"filename": "/data/images/aztec/vazav.png", "start": 1054200, "end": 1055495, "audio": 0}, {"filename": "/data/script/aztec/code.lua", "start": 1055495, "end": 1062567, "audio": 0}, {"filename": "/data/script/aztec/dialogs_bg.lua", "start": 1062567, "end": 1064997, "audio": 0}, {"filename": "/data/script/aztec/dialogs_cs.lua", "start": 1064997, "end": 1066941, "audio": 0}, {"filename": "/data/script/aztec/dialogs_de.lua", "start": 1066941, "end": 1069004, "audio": 0}, {"filename": "/data/script/aztec/dialogs_en.lua", "start": 1069004, "end": 1070310, "audio": 0}, {"filename": "/data/script/aztec/dialogs_eo.lua", "start": 1070310, "end": 1072299, "audio": 0}, {"filename": "/data/script/aztec/dialogs_es.lua", "start": 1072299, "end": 1074340, "audio": 0}, {"filename": "/data/script/aztec/dialogs_fr.lua", "start": 1074340, "end": 1076398, "audio": 0}, {"filename": "/data/script/aztec/dialogs_it.lua", "start": 1076398, "end": 1078429, "audio": 0}, {"filename": "/data/script/aztec/dialogs.lua", "start": 1078429, "end": 1078467, "audio": 0}, {"filename": "/data/script/aztec/dialogs_nl.lua", "start": 1078467, "end": 1080501, "audio": 0}, {"filename": "/data/script/aztec/dialogs_pl.lua", "start": 1080501, "end": 1082453, "audio": 0}, {"filename": "/data/script/aztec/dialogs_ru.lua", "start": 1082453, "end": 1084802, "audio": 0}, {"filename": "/data/script/aztec/dialogs_sv.lua", "start": 1084802, "end": 1086830, "audio": 0}, {"filename": "/data/script/aztec/init.lua", "start": 1086830, "end": 1087474, "audio": 0}, {"filename": "/data/script/aztec/models.lua", "start": 1087474, "end": 1094042, "audio": 0}, {"filename": "/data/sound/aztec/cs/bot-m-ble.ogg", "start": 1094042, "end": 1121969, "audio": 1}, {"filename": "/data/sound/aztec/cs/bot-m-padaji.ogg", "start": 1121969, "end": 1141268, "audio": 1}, {"filename": "/data/sound/aztec/cs/bot-m-vidim.ogg", "start": 1141268, "end": 1158877, "audio": 1}, {"filename": "/data/sound/aztec/cs/bot-m-vidis.ogg", "start": 1158877, "end": 1172865, "audio": 1}, {"filename": "/data/sound/aztec/cs/bot-m-vypada.ogg", "start": 1172865, "end": 1184264, "audio": 1}, {"filename": "/data/sound/aztec/cs/bot-m-zajem.ogg", "start": 1184264, "end": 1205132, "audio": 1}, {"filename": "/data/sound/aztec/cs/bot-m-zivy.ogg", "start": 1205132, "end": 1222989, "audio": 1}, {"filename": "/data/sound/aztec/cs/bot-v-lebka.ogg", "start": 1222989, "end": 1244894, "audio": 1}, {"filename": "/data/sound/aztec/cs/bot-v-podivat.ogg", "start": 1244894, "end": 1263890, "audio": 1}, {"filename": "/data/sound/aztec/cs/bot-v-totem.ogg", "start": 1263890, "end": 1280622, "audio": 1}, {"filename": "/data/sound/aztec/cs/bot-v-uveznen0.ogg", "start": 1280622, "end": 1297887, "audio": 1}, {"filename": "/data/sound/aztec/cs/bot-v-uveznen1.ogg", "start": 1297887, "end": 1314557, "audio": 1}, {"filename": "/data/sound/aztec/cs/bot-v-vsak0.ogg", "start": 1314557, "end": 1330383, "audio": 1}, {"filename": "/data/sound/aztec/cs/bot-v-vsak1.ogg", "start": 1330383, "end": 1344805, "audio": 1}, {"filename": "/data/sound/aztec/cs/bot-v-vsim.ogg", "start": 1344805, "end": 1379261, "audio": 1}, {"filename": "/data/sound/aztec/en/bot-x-gr0.ogg", "start": 1379261, "end": 1403044, "audio": 1}, {"filename": "/data/sound/aztec/en/bot-x-gr1.ogg", "start": 1403044, "end": 1422392, "audio": 1}, {"filename": "/data/sound/aztec/en/bot-x-smich.ogg", "start": 1422392, "end": 1450219, "audio": 1}, {"filename": "/data/sound/aztec/nl/bot-m-ble.ogg", "start": 1450219, "end": 1474742, "audio": 1}, {"filename": "/data/sound/aztec/nl/bot-m-padaji.ogg", "start": 1474742, "end": 1499768, "audio": 1}, {"filename": "/data/sound/aztec/nl/bot-m-vidim.ogg", "start": 1499768, "end": 1522146, "audio": 1}, {"filename": "/data/sound/aztec/nl/bot-m-vidis.ogg", "start": 1522146, "end": 1540013, "audio": 1}, {"filename": "/data/sound/aztec/nl/bot-m-vypada.ogg", "start": 1540013, "end": 1557558, "audio": 1}, {"filename": "/data/sound/aztec/nl/bot-m-zajem.ogg", "start": 1557558, "end": 1581015, "audio": 1}, {"filename": "/data/sound/aztec/nl/bot-m-zivy.ogg", "start": 1581015, "end": 1603125, "audio": 1}, {"filename": "/data/sound/aztec/nl/bot-v-lebka.ogg", "start": 1603125, "end": 1624789, "audio": 1}, {"filename": "/data/sound/aztec/nl/bot-v-podivat.ogg", "start": 1624789, "end": 1648513, "audio": 1}, {"filename": "/data/sound/aztec/nl/bot-v-totem.ogg", "start": 1648513, "end": 1667345, "audio": 1}, {"filename": "/data/sound/aztec/nl/bot-v-uveznen0.ogg", "start": 1667345, "end": 1693848, "audio": 1}, {"filename": "/data/sound/aztec/nl/bot-v-uveznen1.ogg", "start": 1693848, "end": 1715110, "audio": 1}, {"filename": "/data/sound/aztec/nl/bot-v-vsak0.ogg", "start": 1715110, "end": 1734962, "audio": 1}, {"filename": "/data/sound/aztec/nl/bot-v-vsak1.ogg", "start": 1734962, "end": 1754933, "audio": 1}, {"filename": "/data/sound/aztec/nl/bot-v-vsim.ogg", "start": 1754933, "end": 1792560, "audio": 1}], "remote_package_size": 1792560, "package_uuid": "ca2a3e20-68e4-4262-80f1-3e50b65337ff"});

})();
