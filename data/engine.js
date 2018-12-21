
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
    var PACKAGE_NAME = 'web/data/engine.data';
    var REMOTE_PACKAGE_BASE = 'data/engine.data';
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
Module['FS_createPath']('/data/images', 'engine', true, true);
Module['FS_createPath']('/data', 'script', true, true);
Module['FS_createPath']('/data/script', 'engine', true, true);
Module['FS_createPath']('/data', 'sound', true, true);
Module['FS_createPath']('/data/sound', 'engine', true, true);
Module['FS_createPath']('/data/sound/engine', 'cs', true, true);
Module['FS_createPath']('/data/sound/engine', 'en', true, true);
Module['FS_createPath']('/data/sound/engine', 'nl', true, true);

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
              Module['removeRunDependency']('datafile_web/data/engine.data');

    };
    Module['addRunDependency']('datafile_web/data/engine.data');
  
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
 loadPackage({"files": [{"filename": "/data/images/engine/6-ocel.png", "start": 0, "end": 867, "audio": 0}, {"filename": "/data/images/engine/8-ocel.png", "start": 867, "end": 1563, "audio": 0}, {"filename": "/data/images/engine/9-ocel.png", "start": 1563, "end": 2166, "audio": 0}, {"filename": "/data/images/engine/hasak.png", "start": 2166, "end": 9257, "audio": 0}, {"filename": "/data/images/engine/key_00.png", "start": 9257, "end": 12998, "audio": 0}, {"filename": "/data/images/engine/key_01.png", "start": 12998, "end": 14387, "audio": 0}, {"filename": "/data/images/engine/key_02.png", "start": 14387, "end": 18002, "audio": 0}, {"filename": "/data/images/engine/matka_a.png", "start": 18002, "end": 18639, "audio": 0}, {"filename": "/data/images/engine/motor-okoli.png", "start": 18639, "end": 60199, "audio": 0}, {"filename": "/data/images/engine/motor.png", "start": 60199, "end": 81255, "audio": 0}, {"filename": "/data/images/engine/motor-pozadi.png", "start": 81255, "end": 172611, "audio": 0}, {"filename": "/data/images/engine/sroub.png", "start": 172611, "end": 173622, "audio": 0}, {"filename": "/data/script/engine/code.lua", "start": 173622, "end": 182443, "audio": 0}, {"filename": "/data/script/engine/dialogs_bg.lua", "start": 182443, "end": 186771, "audio": 0}, {"filename": "/data/script/engine/dialogs_cs.lua", "start": 186771, "end": 190452, "audio": 0}, {"filename": "/data/script/engine/dialogs_de_CH.lua", "start": 190452, "end": 190788, "audio": 0}, {"filename": "/data/script/engine/dialogs_de.lua", "start": 190788, "end": 194584, "audio": 0}, {"filename": "/data/script/engine/dialogs_en.lua", "start": 194584, "end": 196814, "audio": 0}, {"filename": "/data/script/engine/dialogs_es.lua", "start": 196814, "end": 200525, "audio": 0}, {"filename": "/data/script/engine/dialogs_fr.lua", "start": 200525, "end": 204339, "audio": 0}, {"filename": "/data/script/engine/dialogs_it.lua", "start": 204339, "end": 208039, "audio": 0}, {"filename": "/data/script/engine/dialogs.lua", "start": 208039, "end": 208077, "audio": 0}, {"filename": "/data/script/engine/dialogs_nl.lua", "start": 208077, "end": 211828, "audio": 0}, {"filename": "/data/script/engine/dialogs_pl.lua", "start": 211828, "end": 215493, "audio": 0}, {"filename": "/data/script/engine/dialogs_ru.lua", "start": 215493, "end": 220043, "audio": 0}, {"filename": "/data/script/engine/dialogs_sv.lua", "start": 220043, "end": 223712, "audio": 0}, {"filename": "/data/script/engine/init.lua", "start": 223712, "end": 224357, "audio": 0}, {"filename": "/data/script/engine/models.lua", "start": 224357, "end": 227382, "audio": 0}, {"filename": "/data/sound/engine/cs/mot-m-akce0.ogg", "start": 227382, "end": 256932, "audio": 1}, {"filename": "/data/sound/engine/cs/mot-m-akce1.ogg", "start": 256932, "end": 282855, "audio": 1}, {"filename": "/data/sound/engine/cs/mot-m-akce2.ogg", "start": 282855, "end": 310751, "audio": 1}, {"filename": "/data/sound/engine/cs/mot-m-info.ogg", "start": 310751, "end": 344360, "audio": 1}, {"filename": "/data/sound/engine/cs/mot-m-konecne0.ogg", "start": 344360, "end": 356508, "audio": 1}, {"filename": "/data/sound/engine/cs/mot-m-konecne1.ogg", "start": 356508, "end": 367497, "audio": 1}, {"filename": "/data/sound/engine/cs/mot-m-mayday.ogg", "start": 367497, "end": 388498, "audio": 1}, {"filename": "/data/sound/engine/cs/mot-m-nemuzu0.ogg", "start": 388498, "end": 407464, "audio": 1}, {"filename": "/data/sound/engine/cs/mot-m-nemuzu1.ogg", "start": 407464, "end": 426171, "audio": 1}, {"filename": "/data/sound/engine/cs/mot-m-tak.ogg", "start": 426171, "end": 464057, "audio": 1}, {"filename": "/data/sound/engine/cs/mot-m-ublizit.ogg", "start": 464057, "end": 482638, "audio": 1}, {"filename": "/data/sound/engine/cs/mot-m-zvuky0.ogg", "start": 482638, "end": 512297, "audio": 1}, {"filename": "/data/sound/engine/cs/mot-m-zvuky1.ogg", "start": 512297, "end": 545752, "audio": 1}, {"filename": "/data/sound/engine/cs/mot-v-funkce0.ogg", "start": 545752, "end": 568340, "audio": 1}, {"filename": "/data/sound/engine/cs/mot-v-funkce1.ogg", "start": 568340, "end": 590882, "audio": 1}, {"filename": "/data/sound/engine/cs/mot-v-funkce2.ogg", "start": 590882, "end": 614219, "audio": 1}, {"filename": "/data/sound/engine/cs/mot-v-klic.ogg", "start": 614219, "end": 629899, "audio": 1}, {"filename": "/data/sound/engine/cs/mot-v-konecne0.ogg", "start": 629899, "end": 640841, "audio": 1}, {"filename": "/data/sound/engine/cs/mot-v-konecne1.ogg", "start": 640841, "end": 654977, "audio": 1}, {"filename": "/data/sound/engine/cs/mot-v-konvencni.ogg", "start": 654977, "end": 681769, "audio": 1}, {"filename": "/data/sound/engine/cs/mot-v-nemuzu0.ogg", "start": 681769, "end": 707611, "audio": 1}, {"filename": "/data/sound/engine/cs/mot-v-nemuzu1.ogg", "start": 707611, "end": 734201, "audio": 1}, {"filename": "/data/sound/engine/cs/mot-v-zavery.ogg", "start": 734201, "end": 764820, "audio": 1}, {"filename": "/data/sound/engine/cs/mot-v-znovu0.ogg", "start": 764820, "end": 786775, "audio": 1}, {"filename": "/data/sound/engine/cs/mot-v-zvuky0.ogg", "start": 786775, "end": 811452, "audio": 1}, {"filename": "/data/sound/engine/cs/mot-v-zvuky1.ogg", "start": 811452, "end": 846347, "audio": 1}, {"filename": "/data/sound/engine/en/mot-x-motor.ogg", "start": 846347, "end": 860801, "audio": 1}, {"filename": "/data/sound/engine/nl/mot-m-akce0.ogg", "start": 860801, "end": 886204, "audio": 1}, {"filename": "/data/sound/engine/nl/mot-m-akce1.ogg", "start": 886204, "end": 915582, "audio": 1}, {"filename": "/data/sound/engine/nl/mot-m-akce2.ogg", "start": 915582, "end": 941616, "audio": 1}, {"filename": "/data/sound/engine/nl/mot-m-info.ogg", "start": 941616, "end": 968252, "audio": 1}, {"filename": "/data/sound/engine/nl/mot-m-konecne0.ogg", "start": 968252, "end": 984698, "audio": 1}, {"filename": "/data/sound/engine/nl/mot-m-konecne1.ogg", "start": 984698, "end": 1000045, "audio": 1}, {"filename": "/data/sound/engine/nl/mot-m-mayday.ogg", "start": 1000045, "end": 1019150, "audio": 1}, {"filename": "/data/sound/engine/nl/mot-m-nemuzu0.ogg", "start": 1019150, "end": 1035971, "audio": 1}, {"filename": "/data/sound/engine/nl/mot-m-nemuzu1.ogg", "start": 1035971, "end": 1053583, "audio": 1}, {"filename": "/data/sound/engine/nl/mot-m-tak.ogg", "start": 1053583, "end": 1086695, "audio": 1}, {"filename": "/data/sound/engine/nl/mot-m-ublizit.ogg", "start": 1086695, "end": 1107219, "audio": 1}, {"filename": "/data/sound/engine/nl/mot-m-zvuky0.ogg", "start": 1107219, "end": 1129629, "audio": 1}, {"filename": "/data/sound/engine/nl/mot-m-zvuky1.ogg", "start": 1129629, "end": 1150638, "audio": 1}, {"filename": "/data/sound/engine/nl/mot-v-funkce0.ogg", "start": 1150638, "end": 1171785, "audio": 1}, {"filename": "/data/sound/engine/nl/mot-v-funkce1.ogg", "start": 1171785, "end": 1198185, "audio": 1}, {"filename": "/data/sound/engine/nl/mot-v-funkce2.ogg", "start": 1198185, "end": 1226144, "audio": 1}, {"filename": "/data/sound/engine/nl/mot-v-klic.ogg", "start": 1226144, "end": 1246466, "audio": 1}, {"filename": "/data/sound/engine/nl/mot-v-konecne0.ogg", "start": 1246466, "end": 1260896, "audio": 1}, {"filename": "/data/sound/engine/nl/mot-v-konecne1.ogg", "start": 1260896, "end": 1276193, "audio": 1}, {"filename": "/data/sound/engine/nl/mot-v-konvencni.ogg", "start": 1276193, "end": 1309259, "audio": 1}, {"filename": "/data/sound/engine/nl/mot-v-nemuzu0.ogg", "start": 1309259, "end": 1332118, "audio": 1}, {"filename": "/data/sound/engine/nl/mot-v-nemuzu1.ogg", "start": 1332118, "end": 1354924, "audio": 1}, {"filename": "/data/sound/engine/nl/mot-v-zavery.ogg", "start": 1354924, "end": 1383744, "audio": 1}, {"filename": "/data/sound/engine/nl/mot-v-znovu0.ogg", "start": 1383744, "end": 1406013, "audio": 1}, {"filename": "/data/sound/engine/nl/mot-v-zvuky0.ogg", "start": 1406013, "end": 1428944, "audio": 1}, {"filename": "/data/sound/engine/nl/mot-v-zvuky1.ogg", "start": 1428944, "end": 1453593, "audio": 1}], "remote_package_size": 1453593, "package_uuid": "01d15dd3-9d3d-449e-9bb2-0276b43e4ed6"});

})();
