
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
    var PACKAGE_NAME = 'web/data/corals.data';
    var REMOTE_PACKAGE_BASE = 'data/corals.data';
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
Module['FS_createPath']('/data/images', 'corals', true, true);
Module['FS_createPath']('/data', 'script', true, true);
Module['FS_createPath']('/data/script', 'corals', true, true);
Module['FS_createPath']('/data', 'sound', true, true);
Module['FS_createPath']('/data/sound', 'corals', true, true);
Module['FS_createPath']('/data/sound/corals', 'cs', true, true);
Module['FS_createPath']('/data/sound/corals', 'nl', true, true);

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
              Module['removeRunDependency']('datafile_web/data/corals.data');

    };
    Module['addRunDependency']('datafile_web/data/corals.data');
  
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
 loadPackage({"files": [{"filename": "/data/images/corals/3-ocel.png", "start": 0, "end": 1479, "audio": 0}, {"filename": "/data/images/corals/koral1.png", "start": 1479, "end": 6573, "audio": 0}, {"filename": "/data/images/corals/koral2.png", "start": 6573, "end": 9638, "audio": 0}, {"filename": "/data/images/corals/koral3.png", "start": 9638, "end": 16769, "audio": 0}, {"filename": "/data/images/corals/krab_00.png", "start": 16769, "end": 17847, "audio": 0}, {"filename": "/data/images/corals/krab_01.png", "start": 17847, "end": 18930, "audio": 0}, {"filename": "/data/images/corals/krab_02.png", "start": 18930, "end": 19994, "audio": 0}, {"filename": "/data/images/corals/krab_03.png", "start": 19994, "end": 21075, "audio": 0}, {"filename": "/data/images/corals/krab_04.png", "start": 21075, "end": 22147, "audio": 0}, {"filename": "/data/images/corals/krab_05.png", "start": 22147, "end": 23225, "audio": 0}, {"filename": "/data/images/corals/krab_06.png", "start": 23225, "end": 24292, "audio": 0}, {"filename": "/data/images/corals/krab_07.png", "start": 24292, "end": 25423, "audio": 0}, {"filename": "/data/images/corals/krab_08.png", "start": 25423, "end": 26533, "audio": 0}, {"filename": "/data/images/corals/krab_09.png", "start": 26533, "end": 27650, "audio": 0}, {"filename": "/data/images/corals/recycled-p.png", "start": 27650, "end": 91655, "audio": 0}, {"filename": "/data/images/corals/recycled-w.png", "start": 91655, "end": 253438, "audio": 0}, {"filename": "/data/script/corals/code.lua", "start": 253438, "end": 262810, "audio": 0}, {"filename": "/data/script/corals/dialogs_bg.lua", "start": 262810, "end": 265470, "audio": 0}, {"filename": "/data/script/corals/dialogs_cs.lua", "start": 265470, "end": 267748, "audio": 0}, {"filename": "/data/script/corals/dialogs_de.lua", "start": 267748, "end": 270071, "audio": 0}, {"filename": "/data/script/corals/dialogs_en.lua", "start": 270071, "end": 271465, "audio": 0}, {"filename": "/data/script/corals/dialogs_es.lua", "start": 271465, "end": 273796, "audio": 0}, {"filename": "/data/script/corals/dialogs_fr.lua", "start": 273796, "end": 276105, "audio": 0}, {"filename": "/data/script/corals/dialogs_it.lua", "start": 276105, "end": 278410, "audio": 0}, {"filename": "/data/script/corals/dialogs.lua", "start": 278410, "end": 278448, "audio": 0}, {"filename": "/data/script/corals/dialogs_nl.lua", "start": 278448, "end": 280823, "audio": 0}, {"filename": "/data/script/corals/dialogs_pl.lua", "start": 280823, "end": 283123, "audio": 0}, {"filename": "/data/script/corals/dialogs_ru.lua", "start": 283123, "end": 285908, "audio": 0}, {"filename": "/data/script/corals/dialogs_sv.lua", "start": 285908, "end": 288204, "audio": 0}, {"filename": "/data/script/corals/init.lua", "start": 288204, "end": 288849, "audio": 0}, {"filename": "/data/script/corals/models.lua", "start": 288849, "end": 290633, "audio": 0}, {"filename": "/data/sound/corals/cs/re-k-au.ogg", "start": 290633, "end": 301247, "audio": 1}, {"filename": "/data/sound/corals/cs/re-k-budi.ogg", "start": 301247, "end": 312015, "audio": 1}, {"filename": "/data/sound/corals/cs/re-k-nesahej.ogg", "start": 312015, "end": 325912, "audio": 1}, {"filename": "/data/sound/corals/cs/re-k-otravujete.ogg", "start": 325912, "end": 340778, "audio": 1}, {"filename": "/data/sound/corals/cs/re-k-spim.ogg", "start": 340778, "end": 358558, "audio": 1}, {"filename": "/data/sound/corals/cs/re-m-ahoj.ogg", "start": 358558, "end": 370237, "audio": 1}, {"filename": "/data/sound/corals/cs/re-m-libi0.ogg", "start": 370237, "end": 387015, "audio": 1}, {"filename": "/data/sound/corals/cs/re-m-libi1.ogg", "start": 387015, "end": 400271, "audio": 1}, {"filename": "/data/sound/corals/cs/re-m-libi2.ogg", "start": 400271, "end": 424361, "audio": 1}, {"filename": "/data/sound/corals/cs/re-m-rozveselit.ogg", "start": 424361, "end": 442854, "audio": 1}, {"filename": "/data/sound/corals/cs/re-m-uzitecny0.ogg", "start": 442854, "end": 461343, "audio": 1}, {"filename": "/data/sound/corals/cs/re-m-uzitecny1.ogg", "start": 461343, "end": 480122, "audio": 1}, {"filename": "/data/sound/corals/cs/re-v-koraly0.ogg", "start": 480122, "end": 502843, "audio": 1}, {"filename": "/data/sound/corals/cs/re-v-koraly1.ogg", "start": 502843, "end": 517934, "audio": 1}, {"filename": "/data/sound/corals/cs/re-v-nech.ogg", "start": 517934, "end": 530706, "audio": 1}, {"filename": "/data/sound/corals/cs/re-v-nervozni.ogg", "start": 530706, "end": 545919, "audio": 1}, {"filename": "/data/sound/corals/cs/re-v-nevsimej.ogg", "start": 545919, "end": 557154, "audio": 1}, {"filename": "/data/sound/corals/cs/re-v-obejit.ogg", "start": 557154, "end": 578713, "audio": 1}, {"filename": "/data/sound/corals/cs/re-v-ocel.ogg", "start": 578713, "end": 596403, "audio": 1}, {"filename": "/data/sound/corals/cs/re-v-pokoj.ogg", "start": 596403, "end": 607362, "audio": 1}, {"filename": "/data/sound/corals/nl/re-m-ahoj.ogg", "start": 607362, "end": 624328, "audio": 1}, {"filename": "/data/sound/corals/nl/re-m-libi0.ogg", "start": 624328, "end": 645786, "audio": 1}, {"filename": "/data/sound/corals/nl/re-m-libi1.ogg", "start": 645786, "end": 666626, "audio": 1}, {"filename": "/data/sound/corals/nl/re-m-libi2.ogg", "start": 666626, "end": 694472, "audio": 1}, {"filename": "/data/sound/corals/nl/re-m-rozveselit.ogg", "start": 694472, "end": 717448, "audio": 1}, {"filename": "/data/sound/corals/nl/re-m-uzitecny0.ogg", "start": 717448, "end": 739658, "audio": 1}, {"filename": "/data/sound/corals/nl/re-m-uzitecny1.ogg", "start": 739658, "end": 766682, "audio": 1}, {"filename": "/data/sound/corals/nl/re-v-koraly0.ogg", "start": 766682, "end": 793518, "audio": 1}, {"filename": "/data/sound/corals/nl/re-v-koraly1.ogg", "start": 793518, "end": 816715, "audio": 1}, {"filename": "/data/sound/corals/nl/re-v-nech.ogg", "start": 816715, "end": 837124, "audio": 1}, {"filename": "/data/sound/corals/nl/re-v-nervozni.ogg", "start": 837124, "end": 859626, "audio": 1}, {"filename": "/data/sound/corals/nl/re-v-nevsimej.ogg", "start": 859626, "end": 876143, "audio": 1}, {"filename": "/data/sound/corals/nl/re-v-obejit.ogg", "start": 876143, "end": 898910, "audio": 1}, {"filename": "/data/sound/corals/nl/re-v-ocel.ogg", "start": 898910, "end": 922288, "audio": 1}, {"filename": "/data/sound/corals/nl/re-v-pokoj.ogg", "start": 922288, "end": 939959, "audio": 1}], "remote_package_size": 939959, "package_uuid": "d4086134-c1a3-48b7-8dda-58cb5c3b77f4"});

})();
