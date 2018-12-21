
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
    var PACKAGE_NAME = 'web/data/cabin2.data';
    var REMOTE_PACKAGE_BASE = 'data/cabin2.data';
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
Module['FS_createPath']('/data/images', 'cabin2', true, true);
Module['FS_createPath']('/data', 'script', true, true);
Module['FS_createPath']('/data/script', 'cabin2', true, true);
Module['FS_createPath']('/data', 'sound', true, true);
Module['FS_createPath']('/data/sound', 'cabin2', true, true);
Module['FS_createPath']('/data/sound/cabin2', 'cs', true, true);
Module['FS_createPath']('/data/sound/cabin2', 'en', true, true);
Module['FS_createPath']('/data/sound/cabin2', 'nl', true, true);

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
              Module['removeRunDependency']('datafile_web/data/cabin2.data');

    };
    Module['addRunDependency']('datafile_web/data/cabin2.data');
  
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
 loadPackage({"files": [{"filename": "/data/images/cabin2/chobotnice_00.png", "start": 0, "end": 4974, "audio": 0}, {"filename": "/data/images/cabin2/chobotnice_01.png", "start": 4974, "end": 9880, "audio": 0}, {"filename": "/data/images/cabin2/chobotnice_02.png", "start": 9880, "end": 14809, "audio": 0}, {"filename": "/data/images/cabin2/chobotnice_03.png", "start": 14809, "end": 19620, "audio": 0}, {"filename": "/data/images/cabin2/chobotnice_04.png", "start": 19620, "end": 24349, "audio": 0}, {"filename": "/data/images/cabin2/chobotnice_05.png", "start": 24349, "end": 29111, "audio": 0}, {"filename": "/data/images/cabin2/chobotnice_06.png", "start": 29111, "end": 33917, "audio": 0}, {"filename": "/data/images/cabin2/chobotnice_07.png", "start": 33917, "end": 38660, "audio": 0}, {"filename": "/data/images/cabin2/chobotnice_08.png", "start": 38660, "end": 43468, "audio": 0}, {"filename": "/data/images/cabin2/kajuta2p.png", "start": 43468, "end": 164254, "audio": 0}, {"filename": "/data/images/cabin2/kajuta2w.png", "start": 164254, "end": 344530, "audio": 0}, {"filename": "/data/images/cabin2/lampa.png", "start": 344530, "end": 347876, "audio": 0}, {"filename": "/data/images/cabin2/lebzna.png", "start": 347876, "end": 349673, "audio": 0}, {"filename": "/data/images/cabin2/papoucha_00.png", "start": 349673, "end": 351626, "audio": 0}, {"filename": "/data/images/cabin2/papoucha_01.png", "start": 351626, "end": 353600, "audio": 0}, {"filename": "/data/images/cabin2/pap-zivy_00.png", "start": 353600, "end": 355915, "audio": 0}, {"filename": "/data/images/cabin2/pap-zivy_01.png", "start": 355915, "end": 358188, "audio": 0}, {"filename": "/data/images/cabin2/pap-zivy_02.png", "start": 358188, "end": 360462, "audio": 0}, {"filename": "/data/images/cabin2/pap-zivy_03.png", "start": 360462, "end": 362780, "audio": 0}, {"filename": "/data/images/cabin2/pap-zivy_04.png", "start": 362780, "end": 365103, "audio": 0}, {"filename": "/data/images/cabin2/pap-zivy_05.png", "start": 365103, "end": 367374, "audio": 0}, {"filename": "/data/images/cabin2/pap-zivy_06.png", "start": 367374, "end": 369782, "audio": 0}, {"filename": "/data/images/cabin2/pap-zivy_07.png", "start": 369782, "end": 372255, "audio": 0}, {"filename": "/data/images/cabin2/pap-zivy_08.png", "start": 372255, "end": 374700, "audio": 0}, {"filename": "/data/images/cabin2/pap-zivy_09.png", "start": 374700, "end": 376585, "audio": 0}, {"filename": "/data/images/cabin2/trubka1.png", "start": 376585, "end": 377281, "audio": 0}, {"filename": "/data/images/cabin2/trubka2.png", "start": 377281, "end": 378158, "audio": 0}, {"filename": "/data/images/cabin2/truhla.png", "start": 378158, "end": 380616, "audio": 0}, {"filename": "/data/script/cabin2/code.lua", "start": 380616, "end": 394495, "audio": 0}, {"filename": "/data/script/cabin2/dialogs_bg.lua", "start": 394495, "end": 399397, "audio": 0}, {"filename": "/data/script/cabin2/dialogs_cs.lua", "start": 399397, "end": 403291, "audio": 0}, {"filename": "/data/script/cabin2/dialogs_de_CH.lua", "start": 403291, "end": 403500, "audio": 0}, {"filename": "/data/script/cabin2/dialogs_de.lua", "start": 403500, "end": 407529, "audio": 0}, {"filename": "/data/script/cabin2/dialogs_en.lua", "start": 407529, "end": 410025, "audio": 0}, {"filename": "/data/script/cabin2/dialogs_es.lua", "start": 410025, "end": 414098, "audio": 0}, {"filename": "/data/script/cabin2/dialogs_fr.lua", "start": 414098, "end": 418193, "audio": 0}, {"filename": "/data/script/cabin2/dialogs_it.lua", "start": 418193, "end": 422126, "audio": 0}, {"filename": "/data/script/cabin2/dialogs.lua", "start": 422126, "end": 422164, "audio": 0}, {"filename": "/data/script/cabin2/dialogs_nl.lua", "start": 422164, "end": 426183, "audio": 0}, {"filename": "/data/script/cabin2/dialogs_pl.lua", "start": 426183, "end": 430128, "audio": 0}, {"filename": "/data/script/cabin2/dialogs_ru.lua", "start": 430128, "end": 435248, "audio": 0}, {"filename": "/data/script/cabin2/dialogs_sv.lua", "start": 435248, "end": 439204, "audio": 0}, {"filename": "/data/script/cabin2/init.lua", "start": 439204, "end": 439849, "audio": 0}, {"filename": "/data/script/cabin2/models.lua", "start": 439849, "end": 441960, "audio": 0}, {"filename": "/data/sound/cabin2/cs/k1-pap-3xkruty.ogg", "start": 441960, "end": 470031, "audio": 1}, {"filename": "/data/sound/cabin2/cs/k1-pap-kruci.ogg", "start": 470031, "end": 480317, "audio": 1}, {"filename": "/data/sound/cabin2/cs/k1-pap-kruty.ogg", "start": 480317, "end": 496754, "audio": 1}, {"filename": "/data/sound/cabin2/cs/k1-pap-problem.ogg", "start": 496754, "end": 516001, "audio": 1}, {"filename": "/data/sound/cabin2/cs/k1-pap-sakris.ogg", "start": 516001, "end": 527473, "audio": 1}, {"filename": "/data/sound/cabin2/cs/k1-pap-sucharek.ogg", "start": 527473, "end": 541341, "audio": 1}, {"filename": "/data/sound/cabin2/cs/k1-pap-trhnisi.ogg", "start": 541341, "end": 551068, "audio": 1}, {"filename": "/data/sound/cabin2/cs/ka2-m-chapadlo.ogg", "start": 551068, "end": 579799, "audio": 1}, {"filename": "/data/sound/cabin2/cs/ka2-m-diky.ogg", "start": 579799, "end": 593152, "audio": 1}, {"filename": "/data/sound/cabin2/cs/ka2-m-hej.ogg", "start": 593152, "end": 617606, "audio": 1}, {"filename": "/data/sound/cabin2/cs/ka2-m-kdepak.ogg", "start": 617606, "end": 647766, "audio": 1}, {"filename": "/data/sound/cabin2/cs/ka2-m-kostra.ogg", "start": 647766, "end": 666146, "audio": 1}, {"filename": "/data/sound/cabin2/cs/ka2-m-patrne.ogg", "start": 666146, "end": 716800, "audio": 1}, {"filename": "/data/sound/cabin2/cs/ka2-m-posledni.ogg", "start": 716800, "end": 757263, "audio": 1}, {"filename": "/data/sound/cabin2/cs/ka2-m-svitit.ogg", "start": 757263, "end": 770545, "audio": 1}, {"filename": "/data/sound/cabin2/cs/ka2-m-tezko.ogg", "start": 770545, "end": 784774, "audio": 1}, {"filename": "/data/sound/cabin2/cs/ka2-v-fik.ogg", "start": 784774, "end": 801468, "audio": 1}, {"filename": "/data/sound/cabin2/cs/ka2-v-hrbet.ogg", "start": 801468, "end": 815781, "audio": 1}, {"filename": "/data/sound/cabin2/cs/ka2-v-kostry.ogg", "start": 815781, "end": 841204, "audio": 1}, {"filename": "/data/sound/cabin2/cs/ka2-v-mapa0.ogg", "start": 841204, "end": 858301, "audio": 1}, {"filename": "/data/sound/cabin2/cs/ka2-v-mapa1.ogg", "start": 858301, "end": 887057, "audio": 1}, {"filename": "/data/sound/cabin2/cs/ka2-v-mapa2.ogg", "start": 887057, "end": 917779, "audio": 1}, {"filename": "/data/sound/cabin2/cs/ka2-v-myslet.ogg", "start": 917779, "end": 961336, "audio": 1}, {"filename": "/data/sound/cabin2/cs/ka2-v-napad.ogg", "start": 961336, "end": 977825, "audio": 1}, {"filename": "/data/sound/cabin2/cs/ka2-v-nekde.ogg", "start": 977825, "end": 994209, "audio": 1}, {"filename": "/data/sound/cabin2/cs/ka2-v-papousek.ogg", "start": 994209, "end": 1010095, "audio": 1}, {"filename": "/data/sound/cabin2/en/k1-chob-1.ogg", "start": 1010095, "end": 1022427, "audio": 1}, {"filename": "/data/sound/cabin2/en/k1-chob-2.ogg", "start": 1022427, "end": 1032467, "audio": 1}, {"filename": "/data/sound/cabin2/en/k1-chob-3.ogg", "start": 1032467, "end": 1046361, "audio": 1}, {"filename": "/data/sound/cabin2/en/k1-chob-p.ogg", "start": 1046361, "end": 1055923, "audio": 1}, {"filename": "/data/sound/cabin2/en/k1-x-vrz.ogg", "start": 1055923, "end": 1061802, "audio": 1}, {"filename": "/data/sound/cabin2/nl/ka2-m-chapadlo.ogg", "start": 1061802, "end": 1091349, "audio": 1}, {"filename": "/data/sound/cabin2/nl/ka2-m-diky.ogg", "start": 1091349, "end": 1109823, "audio": 1}, {"filename": "/data/sound/cabin2/nl/ka2-m-hej.ogg", "start": 1109823, "end": 1138380, "audio": 1}, {"filename": "/data/sound/cabin2/nl/ka2-m-kdepak.ogg", "start": 1138380, "end": 1167788, "audio": 1}, {"filename": "/data/sound/cabin2/nl/ka2-m-kostra.ogg", "start": 1167788, "end": 1191035, "audio": 1}, {"filename": "/data/sound/cabin2/nl/ka2-m-patrne.ogg", "start": 1191035, "end": 1242153, "audio": 1}, {"filename": "/data/sound/cabin2/nl/ka2-m-posledni.ogg", "start": 1242153, "end": 1281466, "audio": 1}, {"filename": "/data/sound/cabin2/nl/ka2-m-svitit.ogg", "start": 1281466, "end": 1302789, "audio": 1}, {"filename": "/data/sound/cabin2/nl/ka2-m-tezko.ogg", "start": 1302789, "end": 1322029, "audio": 1}, {"filename": "/data/sound/cabin2/nl/ka2-v-fik.ogg", "start": 1322029, "end": 1340842, "audio": 1}, {"filename": "/data/sound/cabin2/nl/ka2-v-hrbet.ogg", "start": 1340842, "end": 1358681, "audio": 1}, {"filename": "/data/sound/cabin2/nl/ka2-v-kostry.ogg", "start": 1358681, "end": 1381426, "audio": 1}, {"filename": "/data/sound/cabin2/nl/ka2-v-mapa0.ogg", "start": 1381426, "end": 1403019, "audio": 1}, {"filename": "/data/sound/cabin2/nl/ka2-v-mapa1.ogg", "start": 1403019, "end": 1442930, "audio": 1}, {"filename": "/data/sound/cabin2/nl/ka2-v-mapa2.ogg", "start": 1442930, "end": 1478917, "audio": 1}, {"filename": "/data/sound/cabin2/nl/ka2-v-myslet.ogg", "start": 1478917, "end": 1523032, "audio": 1}, {"filename": "/data/sound/cabin2/nl/ka2-v-napad.ogg", "start": 1523032, "end": 1545994, "audio": 1}, {"filename": "/data/sound/cabin2/nl/ka2-v-nekde.ogg", "start": 1545994, "end": 1568810, "audio": 1}, {"filename": "/data/sound/cabin2/nl/ka2-v-papousek.ogg", "start": 1568810, "end": 1589432, "audio": 1}], "remote_package_size": 1589432, "package_uuid": "6379c48c-e885-4be0-bbb1-e49f33c78488"});

})();
