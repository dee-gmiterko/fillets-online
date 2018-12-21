
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
    var PACKAGE_NAME = 'web/data/reef.data';
    var REMOTE_PACKAGE_BASE = 'data/reef.data';
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
Module['FS_createPath']('/data/images', 'reef', true, true);
Module['FS_createPath']('/data', 'script', true, true);
Module['FS_createPath']('/data/script', 'reef', true, true);
Module['FS_createPath']('/data', 'sound', true, true);
Module['FS_createPath']('/data/sound', 'reef', true, true);
Module['FS_createPath']('/data/sound/reef', 'cs', true, true);
Module['FS_createPath']('/data/sound/reef', 'nl', true, true);

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
              Module['removeRunDependency']('datafile_web/data/reef.data');

    };
    Module['addRunDependency']('datafile_web/data/reef.data');
  
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
 loadPackage({"files": [{"filename": "/data/images/reef/1-ocel.png", "start": 0, "end": 2402, "audio": 0}, {"filename": "/data/images/reef/malysnek_00.png", "start": 2402, "end": 3076, "audio": 0}, {"filename": "/data/images/reef/malysnek_01.png", "start": 3076, "end": 3772, "audio": 0}, {"filename": "/data/images/reef/malysnek_02.png", "start": 3772, "end": 4448, "audio": 0}, {"filename": "/data/images/reef/malysnek_03.png", "start": 4448, "end": 5087, "audio": 0}, {"filename": "/data/images/reef/matrace.png", "start": 5087, "end": 7403, "audio": 0}, {"filename": "/data/images/reef/musla.png", "start": 7403, "end": 8633, "audio": 0}, {"filename": "/data/images/reef/plz_00.png", "start": 8633, "end": 10513, "audio": 0}, {"filename": "/data/images/reef/plz_01.png", "start": 10513, "end": 12388, "audio": 0}, {"filename": "/data/images/reef/plz_02.png", "start": 12388, "end": 14218, "audio": 0}, {"filename": "/data/images/reef/plz_03.png", "start": 14218, "end": 16052, "audio": 0}, {"filename": "/data/images/reef/plz_04.png", "start": 16052, "end": 17887, "audio": 0}, {"filename": "/data/images/reef/plz_05.png", "start": 17887, "end": 19726, "audio": 0}, {"filename": "/data/images/reef/plz_06.png", "start": 19726, "end": 21616, "audio": 0}, {"filename": "/data/images/reef/utes-p.png", "start": 21616, "end": 252825, "audio": 0}, {"filename": "/data/images/reef/utes-w.png", "start": 252825, "end": 449927, "audio": 0}, {"filename": "/data/script/reef/code.lua", "start": 449927, "end": 459760, "audio": 0}, {"filename": "/data/script/reef/dialogs_bg.lua", "start": 459760, "end": 462703, "audio": 0}, {"filename": "/data/script/reef/dialogs_cs.lua", "start": 462703, "end": 465161, "audio": 0}, {"filename": "/data/script/reef/dialogs_de_CH.lua", "start": 465161, "end": 465380, "audio": 0}, {"filename": "/data/script/reef/dialogs_de.lua", "start": 465380, "end": 467959, "audio": 0}, {"filename": "/data/script/reef/dialogs_en.lua", "start": 467959, "end": 469436, "audio": 0}, {"filename": "/data/script/reef/dialogs_es.lua", "start": 469436, "end": 471924, "audio": 0}, {"filename": "/data/script/reef/dialogs_fr.lua", "start": 471924, "end": 474512, "audio": 0}, {"filename": "/data/script/reef/dialogs_it.lua", "start": 474512, "end": 477023, "audio": 0}, {"filename": "/data/script/reef/dialogs.lua", "start": 477023, "end": 477061, "audio": 0}, {"filename": "/data/script/reef/dialogs_nl.lua", "start": 477061, "end": 479639, "audio": 0}, {"filename": "/data/script/reef/dialogs_pl.lua", "start": 479639, "end": 482113, "audio": 0}, {"filename": "/data/script/reef/dialogs_ru.lua", "start": 482113, "end": 485135, "audio": 0}, {"filename": "/data/script/reef/dialogs_sl.lua", "start": 485135, "end": 487511, "audio": 0}, {"filename": "/data/script/reef/dialogs_sv.lua", "start": 487511, "end": 489987, "audio": 0}, {"filename": "/data/script/reef/init.lua", "start": 489987, "end": 490630, "audio": 0}, {"filename": "/data/script/reef/models.lua", "start": 490630, "end": 492598, "audio": 0}, {"filename": "/data/sound/reef/cs/uts-m-batyskaf.ogg", "start": 492598, "end": 522585, "audio": 1}, {"filename": "/data/sound/reef/cs/uts-m-chudak.ogg", "start": 522585, "end": 537827, "audio": 1}, {"filename": "/data/sound/reef/cs/uts-m-lastura.ogg", "start": 537827, "end": 558438, "audio": 1}, {"filename": "/data/sound/reef/cs/uts-m-matrace.ogg", "start": 558438, "end": 585113, "audio": 1}, {"filename": "/data/sound/reef/cs/uts-m-nezvedneme.ogg", "start": 585113, "end": 604775, "audio": 1}, {"filename": "/data/sound/reef/cs/uts-m-otresy.ogg", "start": 604775, "end": 633026, "audio": 1}, {"filename": "/data/sound/reef/cs/uts-m-snek.ogg", "start": 633026, "end": 651400, "audio": 1}, {"filename": "/data/sound/reef/cs/uts-m-tvorove.ogg", "start": 651400, "end": 674202, "audio": 1}, {"filename": "/data/sound/reef/cs/uts-m-zelvy.ogg", "start": 674202, "end": 690418, "audio": 1}, {"filename": "/data/sound/reef/cs/uts-m-zivocich.ogg", "start": 690418, "end": 716574, "audio": 1}, {"filename": "/data/sound/reef/cs/uts-v-konecne.ogg", "start": 716574, "end": 730221, "audio": 1}, {"filename": "/data/sound/reef/cs/uts-v-koraly.ogg", "start": 730221, "end": 752495, "audio": 1}, {"filename": "/data/sound/reef/cs/uts-v-mikroskop.ogg", "start": 752495, "end": 778823, "audio": 1}, {"filename": "/data/sound/reef/cs/uts-v-poradi.ogg", "start": 778823, "end": 801567, "audio": 1}, {"filename": "/data/sound/reef/cs/uts-v-projet0.ogg", "start": 801567, "end": 831717, "audio": 1}, {"filename": "/data/sound/reef/cs/uts-v-projet1.ogg", "start": 831717, "end": 847425, "audio": 1}, {"filename": "/data/sound/reef/cs/uts-v-sam.ogg", "start": 847425, "end": 863938, "audio": 1}, {"filename": "/data/sound/reef/nl/uts-m-batyskaf.ogg", "start": 863938, "end": 898689, "audio": 1}, {"filename": "/data/sound/reef/nl/uts-m-chudak.ogg", "start": 898689, "end": 915039, "audio": 1}, {"filename": "/data/sound/reef/nl/uts-m-lastura.ogg", "start": 915039, "end": 939162, "audio": 1}, {"filename": "/data/sound/reef/nl/uts-m-matrace.ogg", "start": 939162, "end": 970278, "audio": 1}, {"filename": "/data/sound/reef/nl/uts-m-nezvedneme.ogg", "start": 970278, "end": 997049, "audio": 1}, {"filename": "/data/sound/reef/nl/uts-m-otresy.ogg", "start": 997049, "end": 1022667, "audio": 1}, {"filename": "/data/sound/reef/nl/uts-m-snek.ogg", "start": 1022667, "end": 1044506, "audio": 1}, {"filename": "/data/sound/reef/nl/uts-m-tvorove.ogg", "start": 1044506, "end": 1071775, "audio": 1}, {"filename": "/data/sound/reef/nl/uts-m-zelvy.ogg", "start": 1071775, "end": 1092706, "audio": 1}, {"filename": "/data/sound/reef/nl/uts-m-zivocich.ogg", "start": 1092706, "end": 1123621, "audio": 1}, {"filename": "/data/sound/reef/nl/uts-v-konecne.ogg", "start": 1123621, "end": 1142149, "audio": 1}, {"filename": "/data/sound/reef/nl/uts-v-koraly.ogg", "start": 1142149, "end": 1166873, "audio": 1}, {"filename": "/data/sound/reef/nl/uts-v-mikroskop.ogg", "start": 1166873, "end": 1196031, "audio": 1}, {"filename": "/data/sound/reef/nl/uts-v-poradi.ogg", "start": 1196031, "end": 1217977, "audio": 1}, {"filename": "/data/sound/reef/nl/uts-v-projet0.ogg", "start": 1217977, "end": 1245356, "audio": 1}, {"filename": "/data/sound/reef/nl/uts-v-projet1.ogg", "start": 1245356, "end": 1261384, "audio": 1}, {"filename": "/data/sound/reef/nl/uts-v-sam.ogg", "start": 1261384, "end": 1280201, "audio": 1}], "remote_package_size": 1280201, "package_uuid": "f3e4fca5-46b4-46ae-a27e-c21352b00887"});

})();
