
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
    var PACKAGE_NAME = 'web/data/rotate.data';
    var REMOTE_PACKAGE_BASE = 'data/rotate.data';
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
Module['FS_createPath']('/data/images', 'rotate', true, true);
Module['FS_createPath']('/data', 'script', true, true);
Module['FS_createPath']('/data/script', 'rotate', true, true);
Module['FS_createPath']('/data', 'sound', true, true);
Module['FS_createPath']('/data/sound', 'rotate', true, true);
Module['FS_createPath']('/data/sound/rotate', 'en', true, true);

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
              Module['removeRunDependency']('datafile_web/data/rotate.data');

    };
    Module['addRunDependency']('datafile_web/data/rotate.data');
  
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
 loadPackage({"files": [{"filename": "/data/images/rotate/ocel1.png", "start": 0, "end": 2281, "audio": 0}, {"filename": "/data/images/rotate/ocel2.png", "start": 2281, "end": 2946, "audio": 0}, {"filename": "/data/images/rotate/ocel3.png", "start": 2946, "end": 3876, "audio": 0}, {"filename": "/data/images/rotate/popredi.png", "start": 3876, "end": 79016, "audio": 0}, {"filename": "/data/images/rotate/pozadi.png", "start": 79016, "end": 126319, "audio": 0}, {"filename": "/data/images/rotate/svetlo_00.png", "start": 126319, "end": 126617, "audio": 0}, {"filename": "/data/images/rotate/svetlo_01.png", "start": 126617, "end": 126919, "audio": 0}, {"filename": "/data/images/rotate/svetlo_02.png", "start": 126919, "end": 127220, "audio": 0}, {"filename": "/data/images/rotate/svetlo_03.png", "start": 127220, "end": 127521, "audio": 0}, {"filename": "/data/images/rotate/svetlo_04.png", "start": 127521, "end": 127822, "audio": 0}, {"filename": "/data/images/rotate/svetlo_05.png", "start": 127822, "end": 128123, "audio": 0}, {"filename": "/data/images/rotate/svetlo_06.png", "start": 128123, "end": 128421, "audio": 0}, {"filename": "/data/images/rotate/tma.png", "start": 128421, "end": 128601, "audio": 0}, {"filename": "/data/images/rotate/tyc_00.png", "start": 128601, "end": 129379, "audio": 0}, {"filename": "/data/images/rotate/tyc_01.png", "start": 129379, "end": 130239, "audio": 0}, {"filename": "/data/images/rotate/tyc_02.png", "start": 130239, "end": 131116, "audio": 0}, {"filename": "/data/images/rotate/tyc_03.png", "start": 131116, "end": 131997, "audio": 0}, {"filename": "/data/images/rotate/tyc_04.png", "start": 131997, "end": 132865, "audio": 0}, {"filename": "/data/images/rotate/tyc_05.png", "start": 132865, "end": 133734, "audio": 0}, {"filename": "/data/images/rotate/tyc_06.png", "start": 133734, "end": 134601, "audio": 0}, {"filename": "/data/images/rotate/tyc_07.png", "start": 134601, "end": 135460, "audio": 0}, {"filename": "/data/images/rotate/tyc_08.png", "start": 135460, "end": 136326, "audio": 0}, {"filename": "/data/images/rotate/tyc_09.png", "start": 136326, "end": 137201, "audio": 0}, {"filename": "/data/images/rotate/tyc_10.png", "start": 137201, "end": 138067, "audio": 0}, {"filename": "/data/images/rotate/tyc_11.png", "start": 138067, "end": 138947, "audio": 0}, {"filename": "/data/images/rotate/tyc_12.png", "start": 138947, "end": 139827, "audio": 0}, {"filename": "/data/images/rotate/tyc_13.png", "start": 139827, "end": 140705, "audio": 0}, {"filename": "/data/images/rotate/tyc_14.png", "start": 140705, "end": 144604, "audio": 0}, {"filename": "/data/images/rotate/valec_00.png", "start": 144604, "end": 145077, "audio": 0}, {"filename": "/data/images/rotate/valec_01.png", "start": 145077, "end": 145565, "audio": 0}, {"filename": "/data/images/rotate/valec_02.png", "start": 145565, "end": 146077, "audio": 0}, {"filename": "/data/images/rotate/valec_03.png", "start": 146077, "end": 146608, "audio": 0}, {"filename": "/data/images/rotate/valec_04.png", "start": 146608, "end": 147148, "audio": 0}, {"filename": "/data/images/rotate/valec_05.png", "start": 147148, "end": 147697, "audio": 0}, {"filename": "/data/images/rotate/valec_06.png", "start": 147697, "end": 148234, "audio": 0}, {"filename": "/data/images/rotate/valec_07.png", "start": 148234, "end": 148768, "audio": 0}, {"filename": "/data/images/rotate/valec_08.png", "start": 148768, "end": 149365, "audio": 0}, {"filename": "/data/images/rotate/valec_09.png", "start": 149365, "end": 149855, "audio": 0}, {"filename": "/data/images/rotate/valec_10.png", "start": 149855, "end": 150399, "audio": 0}, {"filename": "/data/images/rotate/valec_11.png", "start": 150399, "end": 150853, "audio": 0}, {"filename": "/data/images/rotate/valec_12.png", "start": 150853, "end": 151358, "audio": 0}, {"filename": "/data/images/rotate/valec_13.png", "start": 151358, "end": 151911, "audio": 0}, {"filename": "/data/images/rotate/valec_14.png", "start": 151911, "end": 152484, "audio": 0}, {"filename": "/data/images/rotate/valec_15.png", "start": 152484, "end": 153131, "audio": 0}, {"filename": "/data/images/rotate/valec_16.png", "start": 153131, "end": 153728, "audio": 0}, {"filename": "/data/images/rotate/valec_17.png", "start": 153728, "end": 154271, "audio": 0}, {"filename": "/data/images/rotate/valec_18.png", "start": 154271, "end": 154790, "audio": 0}, {"filename": "/data/images/rotate/valec_19.png", "start": 154790, "end": 155339, "audio": 0}, {"filename": "/data/images/rotate/valec_20.png", "start": 155339, "end": 155969, "audio": 0}, {"filename": "/data/images/rotate/valec_21.png", "start": 155969, "end": 156468, "audio": 0}, {"filename": "/data/images/rotate/valec_22.png", "start": 156468, "end": 156999, "audio": 0}, {"filename": "/data/images/rotate/valec_23.png", "start": 156999, "end": 157539, "audio": 0}, {"filename": "/data/images/rotate/valec_24.png", "start": 157539, "end": 158143, "audio": 0}, {"filename": "/data/images/rotate/valec_25.png", "start": 158143, "end": 158742, "audio": 0}, {"filename": "/data/images/rotate/valec_26.png", "start": 158742, "end": 159349, "audio": 0}, {"filename": "/data/images/rotate/valec_27.png", "start": 159349, "end": 159863, "audio": 0}, {"filename": "/data/images/rotate/valec_28.png", "start": 159863, "end": 160386, "audio": 0}, {"filename": "/data/images/rotate/valec_29.png", "start": 160386, "end": 160909, "audio": 0}, {"filename": "/data/images/rotate/valec_30.png", "start": 160909, "end": 161431, "audio": 0}, {"filename": "/data/script/rotate/code.lua", "start": 161431, "end": 170649, "audio": 0}, {"filename": "/data/script/rotate/dialogs_bg.lua", "start": 170649, "end": 170649, "audio": 0}, {"filename": "/data/script/rotate/dialogs_cs.lua", "start": 170649, "end": 170649, "audio": 0}, {"filename": "/data/script/rotate/dialogs_de.lua", "start": 170649, "end": 170649, "audio": 0}, {"filename": "/data/script/rotate/dialogs_en.lua", "start": 170649, "end": 170679, "audio": 0}, {"filename": "/data/script/rotate/dialogs_es.lua", "start": 170679, "end": 170679, "audio": 0}, {"filename": "/data/script/rotate/dialogs_fr.lua", "start": 170679, "end": 170679, "audio": 0}, {"filename": "/data/script/rotate/dialogs_it.lua", "start": 170679, "end": 170679, "audio": 0}, {"filename": "/data/script/rotate/dialogs.lua", "start": 170679, "end": 170717, "audio": 0}, {"filename": "/data/script/rotate/dialogs_nl.lua", "start": 170717, "end": 170717, "audio": 0}, {"filename": "/data/script/rotate/dialogs_pl.lua", "start": 170717, "end": 170717, "audio": 0}, {"filename": "/data/script/rotate/dialogs_ru.lua", "start": 170717, "end": 170717, "audio": 0}, {"filename": "/data/script/rotate/dialogs_sl.lua", "start": 170717, "end": 170717, "audio": 0}, {"filename": "/data/script/rotate/dialogs_sv.lua", "start": 170717, "end": 170717, "audio": 0}, {"filename": "/data/script/rotate/init.lua", "start": 170717, "end": 171362, "audio": 0}, {"filename": "/data/script/rotate/models.lua", "start": 171362, "end": 173446, "audio": 0}, {"filename": "/data/sound/rotate/en/tyc-pauau.ogg", "start": 173446, "end": 188588, "audio": 1}], "remote_package_size": 188588, "package_uuid": "cf9bcdee-1290-459c-9053-f47741abee97"});

})();
