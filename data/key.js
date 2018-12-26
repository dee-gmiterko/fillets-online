
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
    var PACKAGE_NAME = 'web/data/key.data';
    var REMOTE_PACKAGE_BASE = 'data/key.data';
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
Module['FS_createPath']('/data/images', 'key', true, true);
Module['FS_createPath']('/data', 'script', true, true);
Module['FS_createPath']('/data/script', 'key', true, true);
Module['FS_createPath']('/data', 'sound', true, true);
Module['FS_createPath']('/data/sound', 'key', true, true);
Module['FS_createPath']('/data/sound/key', 'nl', true, true);

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
              Module['removeRunDependency']('datafile_web/data/key.data');

    };
    Module['addRunDependency']('datafile_web/data/key.data');
  
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
 loadPackage({"files": [{"filename": "/data/images/key/3steel.png", "start": 0, "end": 880, "audio": 0}, {"filename": "/data/images/key/animal.png", "start": 880, "end": 4025, "audio": 0}, {"filename": "/data/images/key/background.png", "start": 4025, "end": 114312, "audio": 0}, {"filename": "/data/images/key/barrellay.png", "start": 114312, "end": 117380, "audio": 0}, {"filename": "/data/images/key/barrelstand.png", "start": 117380, "end": 120441, "audio": 0}, {"filename": "/data/images/key/broom.png", "start": 120441, "end": 123770, "audio": 0}, {"filename": "/data/images/key/cactus.png", "start": 123770, "end": 126701, "audio": 0}, {"filename": "/data/images/key/canister.png", "start": 126701, "end": 129595, "audio": 0}, {"filename": "/data/images/key/coral.png", "start": 129595, "end": 134113, "audio": 0}, {"filename": "/data/images/key/foreground.png", "start": 134113, "end": 318279, "audio": 0}, {"filename": "/data/images/key/hammer.png", "start": 318279, "end": 320962, "audio": 0}, {"filename": "/data/images/key/icicle.png", "start": 320962, "end": 323263, "audio": 0}, {"filename": "/data/images/key/key.png", "start": 323263, "end": 328797, "audio": 0}, {"filename": "/data/images/key/ladder.png", "start": 328797, "end": 330706, "audio": 0}, {"filename": "/data/images/key/leftsteel.png", "start": 330706, "end": 333962, "audio": 0}, {"filename": "/data/images/key/locksteel.png", "start": 333962, "end": 335713, "audio": 0}, {"filename": "/data/images/key/middlesteel.png", "start": 335713, "end": 339099, "audio": 0}, {"filename": "/data/images/key/pearl.png", "start": 339099, "end": 339658, "audio": 0}, {"filename": "/data/images/key/rightsteel.png", "start": 339658, "end": 342969, "audio": 0}, {"filename": "/data/images/key/steelangle.png", "start": 342969, "end": 344643, "audio": 0}, {"filename": "/data/images/key/stone.png", "start": 344643, "end": 347063, "audio": 0}, {"filename": "/data/images/key/stones.png", "start": 347063, "end": 347555, "audio": 0}, {"filename": "/data/script/key/code.lua", "start": 347555, "end": 352453, "audio": 0}, {"filename": "/data/script/key/dialogs_bg.lua", "start": 352453, "end": 359092, "audio": 0}, {"filename": "/data/script/key/dialogs_cs.lua", "start": 359092, "end": 364481, "audio": 0}, {"filename": "/data/script/key/dialogs_de.lua", "start": 364481, "end": 370237, "audio": 0}, {"filename": "/data/script/key/dialogs_en.lua", "start": 370237, "end": 373499, "audio": 0}, {"filename": "/data/script/key/dialogs.lua", "start": 373499, "end": 373537, "audio": 0}, {"filename": "/data/script/key/dialogs_nl.lua", "start": 373537, "end": 379091, "audio": 0}, {"filename": "/data/script/key/dialogs_ru.lua", "start": 379091, "end": 385622, "audio": 0}, {"filename": "/data/script/key/dialogs_sv.lua", "start": 385622, "end": 391159, "audio": 0}, {"filename": "/data/script/key/init.lua", "start": 391159, "end": 391802, "audio": 0}, {"filename": "/data/script/key/models.lua", "start": 391802, "end": 397925, "audio": 0}, {"filename": "/data/sound/key/nl/cactus-0big.ogg", "start": 397925, "end": 418672, "audio": 1}, {"filename": "/data/sound/key/nl/cactus-0small.ogg", "start": 418672, "end": 438293, "audio": 1}, {"filename": "/data/sound/key/nl/cactus-1big.ogg", "start": 438293, "end": 456300, "audio": 1}, {"filename": "/data/sound/key/nl/cactus-1small.ogg", "start": 456300, "end": 475083, "audio": 1}, {"filename": "/data/sound/key/nl/cactus-2big.ogg", "start": 475083, "end": 490678, "audio": 1}, {"filename": "/data/sound/key/nl/cactus-2small.ogg", "start": 490678, "end": 505940, "audio": 1}, {"filename": "/data/sound/key/nl/down-0-0.ogg", "start": 505940, "end": 530021, "audio": 1}, {"filename": "/data/sound/key/nl/down-0-1.ogg", "start": 530021, "end": 545413, "audio": 1}, {"filename": "/data/sound/key/nl/down-1-0.ogg", "start": 545413, "end": 561953, "audio": 1}, {"filename": "/data/sound/key/nl/down-1-1.ogg", "start": 561953, "end": 580048, "audio": 1}, {"filename": "/data/sound/key/nl/rd-0-0.ogg", "start": 580048, "end": 603808, "audio": 1}, {"filename": "/data/sound/key/nl/rd-0-1.ogg", "start": 603808, "end": 626983, "audio": 1}, {"filename": "/data/sound/key/nl/rd-1-0.ogg", "start": 626983, "end": 646494, "audio": 1}, {"filename": "/data/sound/key/nl/rd-1-1.ogg", "start": 646494, "end": 674412, "audio": 1}, {"filename": "/data/sound/key/nl/rd-1-2.ogg", "start": 674412, "end": 701460, "audio": 1}, {"filename": "/data/sound/key/nl/rd-1-3.ogg", "start": 701460, "end": 720697, "audio": 1}, {"filename": "/data/sound/key/nl/rd-2-0.ogg", "start": 720697, "end": 751730, "audio": 1}, {"filename": "/data/sound/key/nl/rd-2-1.ogg", "start": 751730, "end": 771814, "audio": 1}, {"filename": "/data/sound/key/nl/rd-3-0.ogg", "start": 771814, "end": 798594, "audio": 1}, {"filename": "/data/sound/key/nl/rd-3-1.ogg", "start": 798594, "end": 820026, "audio": 1}, {"filename": "/data/sound/key/nl/rd-3-2.ogg", "start": 820026, "end": 846220, "audio": 1}, {"filename": "/data/sound/key/nl/rd-3-3.ogg", "start": 846220, "end": 867831, "audio": 1}, {"filename": "/data/sound/key/nl/rd-3-4.ogg", "start": 867831, "end": 884745, "audio": 1}, {"filename": "/data/sound/key/nl/rd-3-5.ogg", "start": 884745, "end": 903383, "audio": 1}, {"filename": "/data/sound/key/nl/rd-4-0.ogg", "start": 903383, "end": 933762, "audio": 1}, {"filename": "/data/sound/key/nl/rd-4-1.ogg", "start": 933762, "end": 952483, "audio": 1}, {"filename": "/data/sound/key/nl/rdopt-0-0.ogg", "start": 952483, "end": 989728, "audio": 1}, {"filename": "/data/sound/key/nl/rdopt-0-1.ogg", "start": 989728, "end": 1004319, "audio": 1}, {"filename": "/data/sound/key/nl/rdopt-1-0.ogg", "start": 1004319, "end": 1027954, "audio": 1}, {"filename": "/data/sound/key/nl/rdopt-1-1.ogg", "start": 1027954, "end": 1044239, "audio": 1}, {"filename": "/data/sound/key/nl/rdopt-1-2.ogg", "start": 1044239, "end": 1065648, "audio": 1}, {"filename": "/data/sound/key/nl/rdopt-1-3.ogg", "start": 1065648, "end": 1084096, "audio": 1}, {"filename": "/data/sound/key/nl/start-0.ogg", "start": 1084096, "end": 1109579, "audio": 1}, {"filename": "/data/sound/key/nl/start-1.ogg", "start": 1109579, "end": 1144201, "audio": 1}, {"filename": "/data/sound/key/nl/start-2.ogg", "start": 1144201, "end": 1169494, "audio": 1}, {"filename": "/data/sound/key/nl/start-3.ogg", "start": 1169494, "end": 1195759, "audio": 1}, {"filename": "/data/sound/key/nl/start-4.ogg", "start": 1195759, "end": 1215584, "audio": 1}, {"filename": "/data/sound/key/nl/up-0-0.ogg", "start": 1215584, "end": 1247384, "audio": 1}, {"filename": "/data/sound/key/nl/up-0-1.ogg", "start": 1247384, "end": 1261452, "audio": 1}, {"filename": "/data/sound/key/nl/up-0-2.ogg", "start": 1261452, "end": 1280063, "audio": 1}, {"filename": "/data/sound/key/nl/up-0-3.ogg", "start": 1280063, "end": 1297355, "audio": 1}, {"filename": "/data/sound/key/nl/up-1-0.ogg", "start": 1297355, "end": 1322327, "audio": 1}, {"filename": "/data/sound/key/nl/up-1-1.ogg", "start": 1322327, "end": 1338436, "audio": 1}], "remote_package_size": 1338436, "package_uuid": "0862e00f-f865-4c6f-9903-4c1467b664dd"});

})();
