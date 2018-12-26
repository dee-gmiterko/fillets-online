
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
    var PACKAGE_NAME = 'web/data/airplane.data';
    var REMOTE_PACKAGE_BASE = 'data/airplane.data';
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
Module['FS_createPath']('/data/images', 'airplane', true, true);
Module['FS_createPath']('/data', 'script', true, true);
Module['FS_createPath']('/data/script', 'airplane', true, true);
Module['FS_createPath']('/data', 'sound', true, true);
Module['FS_createPath']('/data/sound', 'airplane', true, true);
Module['FS_createPath']('/data/sound/airplane', 'cs', true, true);
Module['FS_createPath']('/data/sound/airplane', 'nl', true, true);

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
              Module['removeRunDependency']('datafile_web/data/airplane.data');

    };
    Module['addRunDependency']('datafile_web/data/airplane.data');
  
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
 loadPackage({"files": [{"filename": "/data/images/airplane/letadlo-3-tmp.png", "start": 0, "end": 940, "audio": 0}, {"filename": "/data/images/airplane/letadlo-4-tmp.png", "start": 940, "end": 1860, "audio": 0}, {"filename": "/data/images/airplane/letadlo-5-tmp.png", "start": 1860, "end": 3646, "audio": 0}, {"filename": "/data/images/airplane/letadlo-p.png", "start": 3646, "end": 217214, "audio": 0}, {"filename": "/data/images/airplane/letadlo-w.png", "start": 217214, "end": 680354, "audio": 0}, {"filename": "/data/images/airplane/oko_00.png", "start": 680354, "end": 681070, "audio": 0}, {"filename": "/data/images/airplane/oko_01.png", "start": 681070, "end": 681761, "audio": 0}, {"filename": "/data/images/airplane/oko_02.png", "start": 681761, "end": 682449, "audio": 0}, {"filename": "/data/images/airplane/oko_03.png", "start": 682449, "end": 683118, "audio": 0}, {"filename": "/data/images/airplane/oko_04.png", "start": 683118, "end": 683834, "audio": 0}, {"filename": "/data/images/airplane/sedadlo1.png", "start": 683834, "end": 686369, "audio": 0}, {"filename": "/data/images/airplane/sedadlo2.png", "start": 686369, "end": 688895, "audio": 0}, {"filename": "/data/images/airplane/sedadlo3.png", "start": 688895, "end": 691493, "audio": 0}, {"filename": "/data/images/airplane/sedadlo.png", "start": 691493, "end": 694023, "audio": 0}, {"filename": "/data/script/airplane/code.lua", "start": 694023, "end": 702959, "audio": 0}, {"filename": "/data/script/airplane/dialogs_bg.lua", "start": 702959, "end": 704653, "audio": 0}, {"filename": "/data/script/airplane/dialogs_cs.lua", "start": 704653, "end": 706012, "audio": 0}, {"filename": "/data/script/airplane/dialogs_de_CH.lua", "start": 706012, "end": 706339, "audio": 0}, {"filename": "/data/script/airplane/dialogs_de.lua", "start": 706339, "end": 707770, "audio": 0}, {"filename": "/data/script/airplane/dialogs_en.lua", "start": 707770, "end": 708591, "audio": 0}, {"filename": "/data/script/airplane/dialogs_eo.lua", "start": 708591, "end": 710047, "audio": 0}, {"filename": "/data/script/airplane/dialogs_es.lua", "start": 710047, "end": 711481, "audio": 0}, {"filename": "/data/script/airplane/dialogs_fr.lua", "start": 711481, "end": 712910, "audio": 0}, {"filename": "/data/script/airplane/dialogs_it.lua", "start": 712910, "end": 714354, "audio": 0}, {"filename": "/data/script/airplane/dialogs.lua", "start": 714354, "end": 714392, "audio": 0}, {"filename": "/data/script/airplane/dialogs_nl.lua", "start": 714392, "end": 715834, "audio": 0}, {"filename": "/data/script/airplane/dialogs_pl.lua", "start": 715834, "end": 717222, "audio": 0}, {"filename": "/data/script/airplane/dialogs_ru.lua", "start": 717222, "end": 718967, "audio": 0}, {"filename": "/data/script/airplane/dialogs_sl.lua", "start": 718967, "end": 720335, "audio": 0}, {"filename": "/data/script/airplane/dialogs_sv.lua", "start": 720335, "end": 721775, "audio": 0}, {"filename": "/data/script/airplane/init.lua", "start": 721775, "end": 722422, "audio": 0}, {"filename": "/data/script/airplane/models.lua", "start": 722422, "end": 725202, "audio": 0}, {"filename": "/data/sound/airplane/cs/let-m-divna.ogg", "start": 725202, "end": 739238, "audio": 1}, {"filename": "/data/sound/airplane/cs/let-m-oko.ogg", "start": 739238, "end": 774598, "audio": 1}, {"filename": "/data/sound/airplane/cs/let-m-sedadlo.ogg", "start": 774598, "end": 798156, "audio": 1}, {"filename": "/data/sound/airplane/cs/let-v-budrada.ogg", "start": 798156, "end": 821934, "audio": 1}, {"filename": "/data/sound/airplane/cs/let-v-oko.ogg", "start": 821934, "end": 874250, "audio": 1}, {"filename": "/data/sound/airplane/cs/let-v-vrak0.ogg", "start": 874250, "end": 900248, "audio": 1}, {"filename": "/data/sound/airplane/cs/let-v-vrak1.ogg", "start": 900248, "end": 922958, "audio": 1}, {"filename": "/data/sound/airplane/cs/let-v-vrak2.ogg", "start": 922958, "end": 951437, "audio": 1}, {"filename": "/data/sound/airplane/nl/let-m-divna.ogg", "start": 951437, "end": 970049, "audio": 1}, {"filename": "/data/sound/airplane/nl/let-m-oko.ogg", "start": 970049, "end": 1001968, "audio": 1}, {"filename": "/data/sound/airplane/nl/let-m-sedadlo.ogg", "start": 1001968, "end": 1024317, "audio": 1}, {"filename": "/data/sound/airplane/nl/let-v-budrada.ogg", "start": 1024317, "end": 1048114, "audio": 1}, {"filename": "/data/sound/airplane/nl/let-v-oko.ogg", "start": 1048114, "end": 1105098, "audio": 1}, {"filename": "/data/sound/airplane/nl/let-v-vrak0.ogg", "start": 1105098, "end": 1135367, "audio": 1}, {"filename": "/data/sound/airplane/nl/let-v-vrak1.ogg", "start": 1135367, "end": 1165262, "audio": 1}, {"filename": "/data/sound/airplane/nl/let-v-vrak2.ogg", "start": 1165262, "end": 1200056, "audio": 1}], "remote_package_size": 1200056, "package_uuid": "6b1dcae7-78d0-49da-968d-5e3416dc3dfb"});

})();
