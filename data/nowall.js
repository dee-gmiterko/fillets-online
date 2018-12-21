
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
    var PACKAGE_NAME = 'web/data/nowall.data';
    var REMOTE_PACKAGE_BASE = 'data/nowall.data';
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
Module['FS_createPath']('/data/images', 'nowall', true, true);
Module['FS_createPath']('/data', 'script', true, true);
Module['FS_createPath']('/data/script', 'nowall', true, true);
Module['FS_createPath']('/data', 'sound', true, true);
Module['FS_createPath']('/data/sound', 'nowall', true, true);
Module['FS_createPath']('/data/sound/nowall', 'cs', true, true);
Module['FS_createPath']('/data/sound/nowall', 'nl', true, true);

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
              Module['removeRunDependency']('datafile_web/data/nowall.data');

    };
    Module['addRunDependency']('datafile_web/data/nowall.data');
  
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
 loadPackage({"files": [{"filename": "/data/images/nowall/drak_m_00.png", "start": 0, "end": 3308, "audio": 0}, {"filename": "/data/images/nowall/hvezdy2.png", "start": 3308, "end": 342814, "audio": 0}, {"filename": "/data/images/nowall/krab_00.png", "start": 342814, "end": 343897, "audio": 0}, {"filename": "/data/images/nowall/matrace.png", "start": 343897, "end": 346213, "audio": 0}, {"filename": "/data/images/nowall/mocel.png", "start": 346213, "end": 346946, "audio": 0}, {"filename": "/data/images/nowall/netopejr_00.png", "start": 346946, "end": 349091, "audio": 0}, {"filename": "/data/images/nowall/perla_00.png", "start": 349091, "end": 349650, "audio": 0}, {"filename": "/data/images/nowall/plz_00.png", "start": 349650, "end": 351535, "audio": 0}, {"filename": "/data/images/nowall/pozadi.png", "start": 351535, "end": 351871, "audio": 0}, {"filename": "/data/images/nowall/vocel.png", "start": 351871, "end": 414611, "audio": 0}, {"filename": "/data/images/nowall/zlato3.png", "start": 414611, "end": 417593, "audio": 0}, {"filename": "/data/script/nowall/code.lua", "start": 417593, "end": 419482, "audio": 0}, {"filename": "/data/script/nowall/dialogs_bg.lua", "start": 419482, "end": 421644, "audio": 0}, {"filename": "/data/script/nowall/dialogs_cs.lua", "start": 421644, "end": 423547, "audio": 0}, {"filename": "/data/script/nowall/dialogs_de.lua", "start": 423547, "end": 425489, "audio": 0}, {"filename": "/data/script/nowall/dialogs_en.lua", "start": 425489, "end": 426655, "audio": 0}, {"filename": "/data/script/nowall/dialogs.lua", "start": 426655, "end": 426693, "audio": 0}, {"filename": "/data/script/nowall/dialogs_nl.lua", "start": 426693, "end": 428648, "audio": 0}, {"filename": "/data/script/nowall/dialogs_ru.lua", "start": 428648, "end": 431009, "audio": 0}, {"filename": "/data/script/nowall/dialogs_sv.lua", "start": 431009, "end": 432949, "audio": 0}, {"filename": "/data/script/nowall/init.lua", "start": 432949, "end": 433594, "audio": 0}, {"filename": "/data/script/nowall/models.lua", "start": 433594, "end": 435871, "audio": 0}, {"filename": "/data/sound/nowall/cs/m-otazka0.ogg", "start": 435871, "end": 461766, "audio": 1}, {"filename": "/data/sound/nowall/cs/m-otazka1.ogg", "start": 461766, "end": 502165, "audio": 1}, {"filename": "/data/sound/nowall/cs/m-otazka2.ogg", "start": 502165, "end": 538496, "audio": 1}, {"filename": "/data/sound/nowall/cs/m-otazka3.ogg", "start": 538496, "end": 571733, "audio": 1}, {"filename": "/data/sound/nowall/cs/m-otazka4.ogg", "start": 571733, "end": 609679, "audio": 1}, {"filename": "/data/sound/nowall/cs/m-predmet.ogg", "start": 609679, "end": 637947, "audio": 1}, {"filename": "/data/sound/nowall/cs/m-uvedomit.ogg", "start": 637947, "end": 687891, "audio": 1}, {"filename": "/data/sound/nowall/cs/m-zeme.ogg", "start": 687891, "end": 712680, "audio": 1}, {"filename": "/data/sound/nowall/cs/m-zvlastni.ogg", "start": 712680, "end": 748692, "audio": 1}, {"filename": "/data/sound/nowall/cs/v-krehci.ogg", "start": 748692, "end": 788936, "audio": 1}, {"filename": "/data/sound/nowall/cs/v-nad.ogg", "start": 788936, "end": 819769, "audio": 1}, {"filename": "/data/sound/nowall/cs/v-odpoved0.ogg", "start": 819769, "end": 897040, "audio": 1}, {"filename": "/data/sound/nowall/cs/v-odpoved1.ogg", "start": 897040, "end": 922245, "audio": 1}, {"filename": "/data/sound/nowall/cs/v-odpoved2.ogg", "start": 922245, "end": 975452, "audio": 1}, {"filename": "/data/sound/nowall/cs/v-odpoved3.ogg", "start": 975452, "end": 1027023, "audio": 1}, {"filename": "/data/sound/nowall/cs/v-zadne.ogg", "start": 1027023, "end": 1072132, "audio": 1}, {"filename": "/data/sound/nowall/nl/m-otazka0.ogg", "start": 1072132, "end": 1092898, "audio": 1}, {"filename": "/data/sound/nowall/nl/m-otazka1.ogg", "start": 1092898, "end": 1114519, "audio": 1}, {"filename": "/data/sound/nowall/nl/m-otazka2.ogg", "start": 1114519, "end": 1133105, "audio": 1}, {"filename": "/data/sound/nowall/nl/m-otazka3.ogg", "start": 1133105, "end": 1152015, "audio": 1}, {"filename": "/data/sound/nowall/nl/m-otazka4.ogg", "start": 1152015, "end": 1170745, "audio": 1}, {"filename": "/data/sound/nowall/nl/m-predmet.ogg", "start": 1170745, "end": 1188655, "audio": 1}, {"filename": "/data/sound/nowall/nl/m-uvedomit.ogg", "start": 1188655, "end": 1214950, "audio": 1}, {"filename": "/data/sound/nowall/nl/m-zeme.ogg", "start": 1214950, "end": 1234844, "audio": 1}, {"filename": "/data/sound/nowall/nl/m-zvlastni.ogg", "start": 1234844, "end": 1251493, "audio": 1}, {"filename": "/data/sound/nowall/nl/v-krehci.ogg", "start": 1251493, "end": 1274285, "audio": 1}, {"filename": "/data/sound/nowall/nl/v-nad.ogg", "start": 1274285, "end": 1292159, "audio": 1}, {"filename": "/data/sound/nowall/nl/v-odpoved0.ogg", "start": 1292159, "end": 1313011, "audio": 1}, {"filename": "/data/sound/nowall/nl/v-odpoved1.ogg", "start": 1313011, "end": 1330972, "audio": 1}, {"filename": "/data/sound/nowall/nl/v-odpoved2.ogg", "start": 1330972, "end": 1350204, "audio": 1}, {"filename": "/data/sound/nowall/nl/v-odpoved3.ogg", "start": 1350204, "end": 1375354, "audio": 1}, {"filename": "/data/sound/nowall/nl/v-zadne.ogg", "start": 1375354, "end": 1397097, "audio": 1}], "remote_package_size": 1397097, "package_uuid": "b8772c80-bb25-4606-af32-5d431f26e5a2"});

})();
