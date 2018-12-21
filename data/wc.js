
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
    var PACKAGE_NAME = 'web/data/wc.data';
    var REMOTE_PACKAGE_BASE = 'data/wc.data';
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
Module['FS_createPath']('/data/images', 'wc', true, true);
Module['FS_createPath']('/data', 'script', true, true);
Module['FS_createPath']('/data/script', 'wc', true, true);
Module['FS_createPath']('/data', 'sound', true, true);
Module['FS_createPath']('/data/sound', 'wc', true, true);
Module['FS_createPath']('/data/sound/wc', 'cs', true, true);
Module['FS_createPath']('/data/sound/wc', 'nl', true, true);

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
              Module['removeRunDependency']('datafile_web/data/wc.data');

    };
    Module['addRunDependency']('datafile_web/data/wc.data');
  
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
 loadPackage({"files": [{"filename": "/data/images/wc/3-ocel.png", "start": 0, "end": 909, "audio": 0}, {"filename": "/data/images/wc/4-ocel.png", "start": 909, "end": 1858, "audio": 0}, {"filename": "/data/images/wc/hajzlak.png", "start": 1858, "end": 3584, "audio": 0}, {"filename": "/data/images/wc/hajzl.png", "start": 3584, "end": 13127, "audio": 0}, {"filename": "/data/images/wc/wc-p.png", "start": 13127, "end": 175979, "audio": 0}, {"filename": "/data/images/wc/wc-w.png", "start": 175979, "end": 300962, "audio": 0}, {"filename": "/data/script/wc/code.lua", "start": 300962, "end": 303933, "audio": 0}, {"filename": "/data/script/wc/dialogs_bg.lua", "start": 303933, "end": 306188, "audio": 0}, {"filename": "/data/script/wc/dialogs_cs.lua", "start": 306188, "end": 308047, "audio": 0}, {"filename": "/data/script/wc/dialogs_de_CH.lua", "start": 308047, "end": 308225, "audio": 0}, {"filename": "/data/script/wc/dialogs_de.lua", "start": 308225, "end": 310081, "audio": 0}, {"filename": "/data/script/wc/dialogs_en.lua", "start": 310081, "end": 311153, "audio": 0}, {"filename": "/data/script/wc/dialogs_es.lua", "start": 311153, "end": 313028, "audio": 0}, {"filename": "/data/script/wc/dialogs_fr.lua", "start": 313028, "end": 314907, "audio": 0}, {"filename": "/data/script/wc/dialogs_it.lua", "start": 314907, "end": 316749, "audio": 0}, {"filename": "/data/script/wc/dialogs.lua", "start": 316749, "end": 316787, "audio": 0}, {"filename": "/data/script/wc/dialogs_nl.lua", "start": 316787, "end": 318648, "audio": 0}, {"filename": "/data/script/wc/dialogs_pl.lua", "start": 318648, "end": 320482, "audio": 0}, {"filename": "/data/script/wc/dialogs_ru.lua", "start": 320482, "end": 322718, "audio": 0}, {"filename": "/data/script/wc/dialogs_sl.lua", "start": 322718, "end": 324599, "audio": 0}, {"filename": "/data/script/wc/dialogs_sv.lua", "start": 324599, "end": 326488, "audio": 0}, {"filename": "/data/script/wc/init.lua", "start": 326488, "end": 327129, "audio": 0}, {"filename": "/data/script/wc/models.lua", "start": 327129, "end": 328585, "audio": 0}, {"filename": "/data/sound/wc/cs/wc-m-coze.ogg", "start": 328585, "end": 338483, "audio": 1}, {"filename": "/data/sound/wc/cs/wc-m-hrbitov.ogg", "start": 338483, "end": 366394, "audio": 1}, {"filename": "/data/sound/wc/cs/wc-m-nevis.ogg", "start": 366394, "end": 393031, "audio": 1}, {"filename": "/data/sound/wc/cs/wc-m-prasecinky.ogg", "start": 393031, "end": 439879, "audio": 1}, {"filename": "/data/sound/wc/cs/wc-m-sochar.ogg", "start": 439879, "end": 489305, "audio": 1}, {"filename": "/data/sound/wc/cs/wc-m-vlezt.ogg", "start": 489305, "end": 509981, "audio": 1}, {"filename": "/data/sound/wc/cs/wc-v-coze.ogg", "start": 509981, "end": 520875, "audio": 1}, {"filename": "/data/sound/wc/cs/wc-v-hygiena.ogg", "start": 520875, "end": 552525, "audio": 1}, {"filename": "/data/sound/wc/cs/wc-v-neznas.ogg", "start": 552525, "end": 582426, "audio": 1}, {"filename": "/data/sound/wc/cs/wc-v-oblibene.ogg", "start": 582426, "end": 605167, "audio": 1}, {"filename": "/data/sound/wc/cs/wc-v-zmatek.ogg", "start": 605167, "end": 622545, "audio": 1}, {"filename": "/data/sound/wc/nl/wc-m-coze.ogg", "start": 622545, "end": 635627, "audio": 1}, {"filename": "/data/sound/wc/nl/wc-m-hrbitov.ogg", "start": 635627, "end": 658456, "audio": 1}, {"filename": "/data/sound/wc/nl/wc-m-nevis.ogg", "start": 658456, "end": 683056, "audio": 1}, {"filename": "/data/sound/wc/nl/wc-m-prasecinky.ogg", "start": 683056, "end": 722389, "audio": 1}, {"filename": "/data/sound/wc/nl/wc-m-sochar.ogg", "start": 722389, "end": 760803, "audio": 1}, {"filename": "/data/sound/wc/nl/wc-m-vlezt.ogg", "start": 760803, "end": 778350, "audio": 1}, {"filename": "/data/sound/wc/nl/wc-v-coze.ogg", "start": 778350, "end": 791908, "audio": 1}, {"filename": "/data/sound/wc/nl/wc-v-hygiena.ogg", "start": 791908, "end": 822682, "audio": 1}, {"filename": "/data/sound/wc/nl/wc-v-neznas.ogg", "start": 822682, "end": 853850, "audio": 1}, {"filename": "/data/sound/wc/nl/wc-v-oblibene.ogg", "start": 853850, "end": 877075, "audio": 1}, {"filename": "/data/sound/wc/nl/wc-v-zmatek.ogg", "start": 877075, "end": 896212, "audio": 1}], "remote_package_size": 896212, "package_uuid": "b4053767-91e6-4fac-b61b-dcbdef3c5e3e"});

})();
