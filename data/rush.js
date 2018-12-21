
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
    var PACKAGE_NAME = 'web/data/rush.data';
    var REMOTE_PACKAGE_BASE = 'data/rush.data';
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
Module['FS_createPath']('/data/images', 'rush', true, true);
Module['FS_createPath']('/data', 'script', true, true);
Module['FS_createPath']('/data/script', 'rush', true, true);
Module['FS_createPath']('/data', 'sound', true, true);
Module['FS_createPath']('/data/sound', 'rush', true, true);
Module['FS_createPath']('/data/sound/rush', 'cs', true, true);
Module['FS_createPath']('/data/sound/rush', 'nl', true, true);

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
              Module['removeRunDependency']('datafile_web/data/rush.data');

    };
    Module['addRunDependency']('datafile_web/data/rush.data');
  
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
 loadPackage({"files": [{"filename": "/data/images/rush/ceauto_00.png", "start": 0, "end": 1841, "audio": 0}, {"filename": "/data/images/rush/ceauto_01.png", "start": 1841, "end": 3680, "audio": 0}, {"filename": "/data/images/rush/ceauto_02.png", "start": 3680, "end": 5531, "audio": 0}, {"filename": "/data/images/rush/ceauto_03.png", "start": 5531, "end": 8811, "audio": 0}, {"filename": "/data/images/rush/ceauto_03__ru.png", "start": 8811, "end": 11345, "audio": 0}, {"filename": "/data/images/rush/ceauto_04.png", "start": 11345, "end": 14842, "audio": 0}, {"filename": "/data/images/rush/ceauto_04__ru.png", "start": 14842, "end": 17166, "audio": 0}, {"filename": "/data/images/rush/cyauto_00.png", "start": 17166, "end": 19885, "audio": 0}, {"filename": "/data/images/rush/cyauto_01.png", "start": 19885, "end": 22598, "audio": 0}, {"filename": "/data/images/rush/cyauto_02.png", "start": 22598, "end": 25323, "audio": 0}, {"filename": "/data/images/rush/fiauto_00.png", "start": 25323, "end": 27204, "audio": 0}, {"filename": "/data/images/rush/fiauto_01.png", "start": 27204, "end": 29094, "audio": 0}, {"filename": "/data/images/rush/fiauto_02.png", "start": 29094, "end": 30968, "audio": 0}, {"filename": "/data/images/rush/hnauto_00.png", "start": 30968, "end": 33450, "audio": 0}, {"filename": "/data/images/rush/hnauto_01.png", "start": 33450, "end": 35957, "audio": 0}, {"filename": "/data/images/rush/hnauto_02.png", "start": 35957, "end": 38447, "audio": 0}, {"filename": "/data/images/rush/maauto_00.png", "start": 38447, "end": 41162, "audio": 0}, {"filename": "/data/images/rush/maauto_01.png", "start": 41162, "end": 43890, "audio": 0}, {"filename": "/data/images/rush/maauto_02.png", "start": 43890, "end": 46588, "audio": 0}, {"filename": "/data/images/rush/moauto_00.png", "start": 46588, "end": 48377, "audio": 0}, {"filename": "/data/images/rush/moauto_01.png", "start": 48377, "end": 50168, "audio": 0}, {"filename": "/data/images/rush/moauto_02.png", "start": 50168, "end": 51969, "audio": 0}, {"filename": "/data/images/rush/orauto_00.png", "start": 51969, "end": 54028, "audio": 0}, {"filename": "/data/images/rush/orauto_01.png", "start": 54028, "end": 56089, "audio": 0}, {"filename": "/data/images/rush/orauto_02.png", "start": 56089, "end": 58168, "audio": 0}, {"filename": "/data/images/rush/podlozka.png", "start": 58168, "end": 58782, "audio": 0}, {"filename": "/data/images/rush/popredi.png", "start": 58782, "end": 212518, "audio": 0}, {"filename": "/data/images/rush/pozadi.png", "start": 212518, "end": 307089, "audio": 0}, {"filename": "/data/images/rush/ssauto_00.png", "start": 307089, "end": 310715, "audio": 0}, {"filename": "/data/images/rush/ssauto_01.png", "start": 310715, "end": 314355, "audio": 0}, {"filename": "/data/images/rush/ssauto_02.png", "start": 314355, "end": 317991, "audio": 0}, {"filename": "/data/images/rush/tsauto_00.png", "start": 317991, "end": 320930, "audio": 0}, {"filename": "/data/images/rush/tsauto_01.png", "start": 320930, "end": 323935, "audio": 0}, {"filename": "/data/images/rush/tsauto_02.png", "start": 323935, "end": 326884, "audio": 0}, {"filename": "/data/images/rush/zeauto_00.png", "start": 326884, "end": 329784, "audio": 0}, {"filename": "/data/images/rush/zeauto_01.png", "start": 329784, "end": 332705, "audio": 0}, {"filename": "/data/images/rush/zeauto_02.png", "start": 332705, "end": 335389, "audio": 0}, {"filename": "/data/images/rush/zlauto_00.png", "start": 335389, "end": 337470, "audio": 0}, {"filename": "/data/images/rush/zlauto_01.png", "start": 337470, "end": 339563, "audio": 0}, {"filename": "/data/images/rush/zlauto_02.png", "start": 339563, "end": 341649, "audio": 0}, {"filename": "/data/script/rush/code.lua", "start": 341649, "end": 348586, "audio": 0}, {"filename": "/data/script/rush/dialogs_bg.lua", "start": 348586, "end": 350665, "audio": 0}, {"filename": "/data/script/rush/dialogs_cs.lua", "start": 350665, "end": 352413, "audio": 0}, {"filename": "/data/script/rush/dialogs_de_CH.lua", "start": 352413, "end": 354132, "audio": 0}, {"filename": "/data/script/rush/dialogs_de.lua", "start": 354132, "end": 355851, "audio": 0}, {"filename": "/data/script/rush/dialogs_en.lua", "start": 355851, "end": 356827, "audio": 0}, {"filename": "/data/script/rush/dialogs.lua", "start": 356827, "end": 356865, "audio": 0}, {"filename": "/data/script/rush/dialogs_nl.lua", "start": 356865, "end": 358626, "audio": 0}, {"filename": "/data/script/rush/dialogs_ru.lua", "start": 358626, "end": 360666, "audio": 0}, {"filename": "/data/script/rush/dialogs_sv.lua", "start": 360666, "end": 362378, "audio": 0}, {"filename": "/data/script/rush/init.lua", "start": 362378, "end": 363021, "audio": 0}, {"filename": "/data/script/rush/models.lua", "start": 363021, "end": 368658, "audio": 0}, {"filename": "/data/sound/rush/cs/m-hraje.ogg", "start": 368658, "end": 515574, "audio": 1}, {"filename": "/data/sound/rush/cs/m-myslis.ogg", "start": 515574, "end": 538725, "audio": 1}, {"filename": "/data/sound/rush/cs/m-obdivovat.ogg", "start": 538725, "end": 608691, "audio": 1}, {"filename": "/data/sound/rush/cs/m-silou.ogg", "start": 608691, "end": 679654, "audio": 1}, {"filename": "/data/sound/rush/cs/m-vysunout.ogg", "start": 679654, "end": 728009, "audio": 1}, {"filename": "/data/sound/rush/cs/v-chytra.ogg", "start": 728009, "end": 799796, "audio": 1}, {"filename": "/data/sound/rush/cs/v-codelas.ogg", "start": 799796, "end": 847982, "audio": 1}, {"filename": "/data/sound/rush/cs/v-ffneni.ogg", "start": 847982, "end": 950186, "audio": 1}, {"filename": "/data/sound/rush/cs/v-upozornit.ogg", "start": 950186, "end": 1078347, "audio": 1}, {"filename": "/data/sound/rush/cs/v-zopakuje.ogg", "start": 1078347, "end": 1173006, "audio": 1}, {"filename": "/data/sound/rush/nl/m-hraje.ogg", "start": 1173006, "end": 1215130, "audio": 1}, {"filename": "/data/sound/rush/nl/m-myslis.ogg", "start": 1215130, "end": 1228502, "audio": 1}, {"filename": "/data/sound/rush/nl/m-obdivovat.ogg", "start": 1228502, "end": 1269174, "audio": 1}, {"filename": "/data/sound/rush/nl/m-silou.ogg", "start": 1269174, "end": 1286549, "audio": 1}, {"filename": "/data/sound/rush/nl/m-vysunout.ogg", "start": 1286549, "end": 1307581, "audio": 1}, {"filename": "/data/sound/rush/nl/v-chytra.ogg", "start": 1307581, "end": 1330056, "audio": 1}, {"filename": "/data/sound/rush/nl/v-codelas.ogg", "start": 1330056, "end": 1356190, "audio": 1}, {"filename": "/data/sound/rush/nl/v-ffneni.ogg", "start": 1356190, "end": 1386910, "audio": 1}, {"filename": "/data/sound/rush/nl/v-upozornit.ogg", "start": 1386910, "end": 1420398, "audio": 1}, {"filename": "/data/sound/rush/nl/v-zopakuje.ogg", "start": 1420398, "end": 1452348, "audio": 1}], "remote_package_size": 1452348, "package_uuid": "8f948472-84fa-441a-87e4-da19180cb3e7"});

})();
