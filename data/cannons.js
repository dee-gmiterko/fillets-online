
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
    var PACKAGE_NAME = 'web/data/cannons.data';
    var REMOTE_PACKAGE_BASE = 'data/cannons.data';
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
Module['FS_createPath']('/data/images', 'cannons', true, true);
Module['FS_createPath']('/data', 'script', true, true);
Module['FS_createPath']('/data/script', 'cannons', true, true);
Module['FS_createPath']('/data', 'sound', true, true);
Module['FS_createPath']('/data/sound', 'cannons', true, true);
Module['FS_createPath']('/data/sound/cannons', 'cs', true, true);
Module['FS_createPath']('/data/sound/cannons', 'nl', true, true);

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
              Module['removeRunDependency']('datafile_web/data/cannons.data');

    };
    Module['addRunDependency']('datafile_web/data/cannons.data');
  
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
 loadPackage({"files": [{"filename": "/data/images/cannons/dela-p.png", "start": 0, "end": 211596, "audio": 0}, {"filename": "/data/images/cannons/dela-w.png", "start": 211596, "end": 364827, "audio": 0}, {"filename": "/data/images/cannons/delo_00.png", "start": 364827, "end": 370007, "audio": 0}, {"filename": "/data/images/cannons/delo_01.png", "start": 370007, "end": 375205, "audio": 0}, {"filename": "/data/images/cannons/delo_02.png", "start": 375205, "end": 380365, "audio": 0}, {"filename": "/data/images/cannons/delorev_00.png", "start": 380365, "end": 385556, "audio": 0}, {"filename": "/data/images/cannons/delorev_01.png", "start": 385556, "end": 390764, "audio": 0}, {"filename": "/data/images/cannons/delorev_02.png", "start": 390764, "end": 395929, "audio": 0}, {"filename": "/data/images/cannons/koulea.png", "start": 395929, "end": 396562, "audio": 0}, {"filename": "/data/images/cannons/kouleb.png", "start": 396562, "end": 397184, "audio": 0}, {"filename": "/data/images/cannons/koulec.png", "start": 397184, "end": 397851, "audio": 0}, {"filename": "/data/images/cannons/kouled.png", "start": 397851, "end": 398497, "audio": 0}, {"filename": "/data/images/cannons/mec.png", "start": 398497, "end": 403306, "audio": 0}, {"filename": "/data/images/cannons/ocel-1.png", "start": 403306, "end": 405161, "audio": 0}, {"filename": "/data/images/cannons/sekera.png", "start": 405161, "end": 407477, "audio": 0}, {"filename": "/data/images/cannons/sud.png", "start": 407477, "end": 410538, "audio": 0}, {"filename": "/data/script/cannons/code.lua", "start": 410538, "end": 415936, "audio": 0}, {"filename": "/data/script/cannons/dialogs_bg.lua", "start": 415936, "end": 417821, "audio": 0}, {"filename": "/data/script/cannons/dialogs_cs.lua", "start": 417821, "end": 419349, "audio": 0}, {"filename": "/data/script/cannons/dialogs_de_CH.lua", "start": 419349, "end": 419901, "audio": 0}, {"filename": "/data/script/cannons/dialogs_de.lua", "start": 419901, "end": 421498, "audio": 0}, {"filename": "/data/script/cannons/dialogs_en.lua", "start": 421498, "end": 422392, "audio": 0}, {"filename": "/data/script/cannons/dialogs_es.lua", "start": 422392, "end": 423988, "audio": 0}, {"filename": "/data/script/cannons/dialogs_fr.lua", "start": 423988, "end": 425536, "audio": 0}, {"filename": "/data/script/cannons/dialogs_it.lua", "start": 425536, "end": 427110, "audio": 0}, {"filename": "/data/script/cannons/dialogs.lua", "start": 427110, "end": 427148, "audio": 0}, {"filename": "/data/script/cannons/dialogs_nl.lua", "start": 427148, "end": 428734, "audio": 0}, {"filename": "/data/script/cannons/dialogs_pl.lua", "start": 428734, "end": 430285, "audio": 0}, {"filename": "/data/script/cannons/dialogs_ru.lua", "start": 430285, "end": 432144, "audio": 0}, {"filename": "/data/script/cannons/dialogs_sv.lua", "start": 432144, "end": 433681, "audio": 0}, {"filename": "/data/script/cannons/init.lua", "start": 433681, "end": 434327, "audio": 0}, {"filename": "/data/script/cannons/models.lua", "start": 434327, "end": 437593, "audio": 0}, {"filename": "/data/sound/cannons/cs/del-m-ci.ogg", "start": 437593, "end": 480360, "audio": 1}, {"filename": "/data/sound/cannons/cs/del-m-jedn0.ogg", "start": 480360, "end": 495961, "audio": 1}, {"filename": "/data/sound/cannons/cs/del-m-jedn1.ogg", "start": 495961, "end": 511596, "audio": 1}, {"filename": "/data/sound/cannons/cs/del-m-jedn2.ogg", "start": 511596, "end": 527429, "audio": 1}, {"filename": "/data/sound/cannons/cs/del-m-tus.ogg", "start": 527429, "end": 554060, "audio": 1}, {"filename": "/data/sound/cannons/cs/del-m-voda.ogg", "start": 554060, "end": 567951, "audio": 1}, {"filename": "/data/sound/cannons/cs/del-v-dve.ogg", "start": 567951, "end": 626840, "audio": 1}, {"filename": "/data/sound/cannons/cs/del-v-mec.ogg", "start": 626840, "end": 650444, "audio": 1}, {"filename": "/data/sound/cannons/cs/del-v-splet.ogg", "start": 650444, "end": 674241, "audio": 1}, {"filename": "/data/sound/cannons/nl/del-m-ci.ogg", "start": 674241, "end": 716853, "audio": 1}, {"filename": "/data/sound/cannons/nl/del-m-jedn0.ogg", "start": 716853, "end": 737823, "audio": 1}, {"filename": "/data/sound/cannons/nl/del-m-jedn1.ogg", "start": 737823, "end": 759408, "audio": 1}, {"filename": "/data/sound/cannons/nl/del-m-jedn2.ogg", "start": 759408, "end": 776198, "audio": 1}, {"filename": "/data/sound/cannons/nl/del-m-tus.ogg", "start": 776198, "end": 812022, "audio": 1}, {"filename": "/data/sound/cannons/nl/del-m-voda.ogg", "start": 812022, "end": 833213, "audio": 1}, {"filename": "/data/sound/cannons/nl/del-v-dve.ogg", "start": 833213, "end": 888871, "audio": 1}, {"filename": "/data/sound/cannons/nl/del-v-mec.ogg", "start": 888871, "end": 914189, "audio": 1}, {"filename": "/data/sound/cannons/nl/del-v-splet.ogg", "start": 914189, "end": 939507, "audio": 1}], "remote_package_size": 939507, "package_uuid": "7e4e1b69-4b12-4682-9a48-b0eb20988293"});

})();
