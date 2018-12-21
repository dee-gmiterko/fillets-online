
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
    var PACKAGE_NAME = 'web/data/fishes.data';
    var REMOTE_PACKAGE_BASE = 'data/fishes.data';
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
Module['FS_createPath']('/data/images', 'fishes', true, true);
Module['FS_createPath']('/data/images/fishes', 'big', true, true);
Module['FS_createPath']('/data/images/fishes/big', 'heads', true, true);
Module['FS_createPath']('/data/images/fishes/big/heads', 'left', true, true);
Module['FS_createPath']('/data/images/fishes/big/heads', 'right', true, true);
Module['FS_createPath']('/data/images/fishes/big', 'left', true, true);
Module['FS_createPath']('/data/images/fishes/big', 'right', true, true);
Module['FS_createPath']('/data/images/fishes', 'ex_big', true, true);
Module['FS_createPath']('/data/images/fishes/ex_big', 'heads', true, true);
Module['FS_createPath']('/data/images/fishes/ex_big/heads', 'left', true, true);
Module['FS_createPath']('/data/images/fishes/ex_big/heads', 'right', true, true);
Module['FS_createPath']('/data/images/fishes/ex_big', 'left', true, true);
Module['FS_createPath']('/data/images/fishes/ex_big', 'right', true, true);
Module['FS_createPath']('/data/images/fishes', 'ex_small', true, true);
Module['FS_createPath']('/data/images/fishes/ex_small', 'heads', true, true);
Module['FS_createPath']('/data/images/fishes/ex_small/heads', 'left', true, true);
Module['FS_createPath']('/data/images/fishes/ex_small/heads', 'right', true, true);
Module['FS_createPath']('/data/images/fishes/ex_small', 'left', true, true);
Module['FS_createPath']('/data/images/fishes/ex_small', 'right', true, true);
Module['FS_createPath']('/data/images/fishes', 'small', true, true);
Module['FS_createPath']('/data/images/fishes/small', 'heads', true, true);
Module['FS_createPath']('/data/images/fishes/small/heads', 'left', true, true);
Module['FS_createPath']('/data/images/fishes/small/heads', 'right', true, true);
Module['FS_createPath']('/data/images/fishes/small', 'left', true, true);
Module['FS_createPath']('/data/images/fishes/small', 'right', true, true);

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
              Module['removeRunDependency']('datafile_web/data/fishes.data');

    };
    Module['addRunDependency']('datafile_web/data/fishes.data');
  
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
 loadPackage({"files": [{"filename": "/data/images/fishes/big/heads/left/head_blink.png", "start": 0, "end": 3311, "audio": 0}, {"filename": "/data/images/fishes/big/heads/left/head_dark_00.png", "start": 3311, "end": 3443, "audio": 0}, {"filename": "/data/images/fishes/big/heads/left/head_dark_01.png", "start": 3443, "end": 3523, "audio": 0}, {"filename": "/data/images/fishes/big/heads/left/head_pushing.png", "start": 3523, "end": 6961, "audio": 0}, {"filename": "/data/images/fishes/big/heads/left/head_scowl_00.png", "start": 6961, "end": 10293, "audio": 0}, {"filename": "/data/images/fishes/big/heads/left/head_scowl_01.png", "start": 10293, "end": 13705, "audio": 0}, {"filename": "/data/images/fishes/big/heads/left/head_shock.png", "start": 13705, "end": 17197, "audio": 0}, {"filename": "/data/images/fishes/big/heads/left/head_smile.png", "start": 17197, "end": 20615, "audio": 0}, {"filename": "/data/images/fishes/big/heads/left/head_talking_00.png", "start": 20615, "end": 20712, "audio": 0}, {"filename": "/data/images/fishes/big/heads/left/head_talking_01.png", "start": 20712, "end": 24021, "audio": 0}, {"filename": "/data/images/fishes/big/heads/left/head_talking_02.png", "start": 24021, "end": 27427, "audio": 0}, {"filename": "/data/images/fishes/big/heads/right/head_blink.png", "start": 27427, "end": 30787, "audio": 0}, {"filename": "/data/images/fishes/big/heads/right/head_dark_00.png", "start": 30787, "end": 30916, "audio": 0}, {"filename": "/data/images/fishes/big/heads/right/head_dark_01.png", "start": 30916, "end": 30996, "audio": 0}, {"filename": "/data/images/fishes/big/heads/right/head_pushing.png", "start": 30996, "end": 34423, "audio": 0}, {"filename": "/data/images/fishes/big/heads/right/head_scowl_00.png", "start": 34423, "end": 37759, "audio": 0}, {"filename": "/data/images/fishes/big/heads/right/head_scowl_01.png", "start": 37759, "end": 41175, "audio": 0}, {"filename": "/data/images/fishes/big/heads/right/head_shock.png", "start": 41175, "end": 44672, "audio": 0}, {"filename": "/data/images/fishes/big/heads/right/head_smile.png", "start": 44672, "end": 48103, "audio": 0}, {"filename": "/data/images/fishes/big/heads/right/head_talking_00.png", "start": 48103, "end": 48200, "audio": 0}, {"filename": "/data/images/fishes/big/heads/right/head_talking_01.png", "start": 48200, "end": 51523, "audio": 0}, {"filename": "/data/images/fishes/big/heads/right/head_talking_02.png", "start": 51523, "end": 54913, "audio": 0}, {"filename": "/data/images/fishes/big/left/body_rest_00.png", "start": 54913, "end": 58108, "audio": 0}, {"filename": "/data/images/fishes/big/left/body_rest_01.png", "start": 58108, "end": 61292, "audio": 0}, {"filename": "/data/images/fishes/big/left/body_rest_02.png", "start": 61292, "end": 64524, "audio": 0}, {"filename": "/data/images/fishes/big/left/body_skeleton_00.png", "start": 64524, "end": 66486, "audio": 0}, {"filename": "/data/images/fishes/big/left/body_swam_00.png", "start": 66486, "end": 69508, "audio": 0}, {"filename": "/data/images/fishes/big/left/body_swam_01.png", "start": 69508, "end": 72516, "audio": 0}, {"filename": "/data/images/fishes/big/left/body_swam_02.png", "start": 72516, "end": 75582, "audio": 0}, {"filename": "/data/images/fishes/big/left/body_swam_03.png", "start": 75582, "end": 78791, "audio": 0}, {"filename": "/data/images/fishes/big/left/body_swam_04.png", "start": 78791, "end": 81862, "audio": 0}, {"filename": "/data/images/fishes/big/left/body_swam_05.png", "start": 81862, "end": 84840, "audio": 0}, {"filename": "/data/images/fishes/big/left/body_talk_00.png", "start": 84840, "end": 87672, "audio": 0}, {"filename": "/data/images/fishes/big/left/body_talk_01.png", "start": 87672, "end": 90479, "audio": 0}, {"filename": "/data/images/fishes/big/left/body_talk_02.png", "start": 90479, "end": 93255, "audio": 0}, {"filename": "/data/images/fishes/big/left/body_turn_00.png", "start": 93255, "end": 96099, "audio": 0}, {"filename": "/data/images/fishes/big/left/body_turn_01.png", "start": 96099, "end": 98568, "audio": 0}, {"filename": "/data/images/fishes/big/left/body_turn_02.png", "start": 98568, "end": 100979, "audio": 0}, {"filename": "/data/images/fishes/big/left/body_vertical_00.png", "start": 100979, "end": 104174, "audio": 0}, {"filename": "/data/images/fishes/big/left/body_vertical_01.png", "start": 104174, "end": 107358, "audio": 0}, {"filename": "/data/images/fishes/big/left/body_vertical_02.png", "start": 107358, "end": 110590, "audio": 0}, {"filename": "/data/images/fishes/big/left/body_vertical_03.png", "start": 110590, "end": 113808, "audio": 0}, {"filename": "/data/images/fishes/big/left/body_vertical_04.png", "start": 113808, "end": 117068, "audio": 0}, {"filename": "/data/images/fishes/big/left/body_vertical_05.png", "start": 117068, "end": 120358, "audio": 0}, {"filename": "/data/images/fishes/big/right/body_rest_00.png", "start": 120358, "end": 123592, "audio": 0}, {"filename": "/data/images/fishes/big/right/body_rest_01.png", "start": 123592, "end": 126834, "audio": 0}, {"filename": "/data/images/fishes/big/right/body_rest_02.png", "start": 126834, "end": 130073, "audio": 0}, {"filename": "/data/images/fishes/big/right/body_skeleton_00.png", "start": 130073, "end": 132033, "audio": 0}, {"filename": "/data/images/fishes/big/right/body_swam_00.png", "start": 132033, "end": 135102, "audio": 0}, {"filename": "/data/images/fishes/big/right/body_swam_01.png", "start": 135102, "end": 138099, "audio": 0}, {"filename": "/data/images/fishes/big/right/body_swam_02.png", "start": 138099, "end": 141185, "audio": 0}, {"filename": "/data/images/fishes/big/right/body_swam_03.png", "start": 141185, "end": 144407, "audio": 0}, {"filename": "/data/images/fishes/big/right/body_swam_04.png", "start": 144407, "end": 147441, "audio": 0}, {"filename": "/data/images/fishes/big/right/body_swam_05.png", "start": 147441, "end": 150430, "audio": 0}, {"filename": "/data/images/fishes/big/right/body_talk_00.png", "start": 150430, "end": 153270, "audio": 0}, {"filename": "/data/images/fishes/big/right/body_talk_01.png", "start": 153270, "end": 156086, "audio": 0}, {"filename": "/data/images/fishes/big/right/body_talk_02.png", "start": 156086, "end": 158873, "audio": 0}, {"filename": "/data/images/fishes/big/right/body_turn_00.png", "start": 158873, "end": 161722, "audio": 0}, {"filename": "/data/images/fishes/big/right/body_turn_01.png", "start": 161722, "end": 164185, "audio": 0}, {"filename": "/data/images/fishes/big/right/body_turn_02.png", "start": 164185, "end": 166592, "audio": 0}, {"filename": "/data/images/fishes/big/right/body_vertical_00.png", "start": 166592, "end": 169826, "audio": 0}, {"filename": "/data/images/fishes/big/right/body_vertical_01.png", "start": 169826, "end": 173068, "audio": 0}, {"filename": "/data/images/fishes/big/right/body_vertical_02.png", "start": 173068, "end": 176307, "audio": 0}, {"filename": "/data/images/fishes/big/right/body_vertical_03.png", "start": 176307, "end": 179546, "audio": 0}, {"filename": "/data/images/fishes/big/right/body_vertical_04.png", "start": 179546, "end": 182824, "audio": 0}, {"filename": "/data/images/fishes/big/right/body_vertical_05.png", "start": 182824, "end": 186150, "audio": 0}, {"filename": "/data/images/fishes/ex_big/heads/left/head_blink.png", "start": 186150, "end": 186232, "audio": 0}, {"filename": "/data/images/fishes/ex_big/heads/left/head_dark_00.png", "start": 186232, "end": 186314, "audio": 0}, {"filename": "/data/images/fishes/ex_big/heads/left/head_dark_01.png", "start": 186314, "end": 186396, "audio": 0}, {"filename": "/data/images/fishes/ex_big/heads/left/head_pushing.png", "start": 186396, "end": 186478, "audio": 0}, {"filename": "/data/images/fishes/ex_big/heads/left/head_scowl_00.png", "start": 186478, "end": 186560, "audio": 0}, {"filename": "/data/images/fishes/ex_big/heads/left/head_scowl_01.png", "start": 186560, "end": 186642, "audio": 0}, {"filename": "/data/images/fishes/ex_big/heads/left/head_shock.png", "start": 186642, "end": 186724, "audio": 0}, {"filename": "/data/images/fishes/ex_big/heads/left/head_smile.png", "start": 186724, "end": 186806, "audio": 0}, {"filename": "/data/images/fishes/ex_big/heads/left/head_talking_00.png", "start": 186806, "end": 186888, "audio": 0}, {"filename": "/data/images/fishes/ex_big/heads/left/head_talking_01.png", "start": 186888, "end": 186970, "audio": 0}, {"filename": "/data/images/fishes/ex_big/heads/left/head_talking_02.png", "start": 186970, "end": 187052, "audio": 0}, {"filename": "/data/images/fishes/ex_big/heads/right/head_blink.png", "start": 187052, "end": 187134, "audio": 0}, {"filename": "/data/images/fishes/ex_big/heads/right/head_dark_00.png", "start": 187134, "end": 187216, "audio": 0}, {"filename": "/data/images/fishes/ex_big/heads/right/head_dark_01.png", "start": 187216, "end": 187298, "audio": 0}, {"filename": "/data/images/fishes/ex_big/heads/right/head_pushing.png", "start": 187298, "end": 187380, "audio": 0}, {"filename": "/data/images/fishes/ex_big/heads/right/head_scowl_00.png", "start": 187380, "end": 187462, "audio": 0}, {"filename": "/data/images/fishes/ex_big/heads/right/head_scowl_01.png", "start": 187462, "end": 187544, "audio": 0}, {"filename": "/data/images/fishes/ex_big/heads/right/head_shock.png", "start": 187544, "end": 187626, "audio": 0}, {"filename": "/data/images/fishes/ex_big/heads/right/head_smile.png", "start": 187626, "end": 187708, "audio": 0}, {"filename": "/data/images/fishes/ex_big/heads/right/head_talking_00.png", "start": 187708, "end": 187790, "audio": 0}, {"filename": "/data/images/fishes/ex_big/heads/right/head_talking_01.png", "start": 187790, "end": 187872, "audio": 0}, {"filename": "/data/images/fishes/ex_big/heads/right/head_talking_02.png", "start": 187872, "end": 187954, "audio": 0}, {"filename": "/data/images/fishes/ex_big/left/body_rest_00.png", "start": 187954, "end": 191506, "audio": 0}, {"filename": "/data/images/fishes/ex_big/left/body_skeleton_00.png", "start": 191506, "end": 194979, "audio": 0}, {"filename": "/data/images/fishes/ex_big/left/body_swam_00.png", "start": 194979, "end": 198531, "audio": 0}, {"filename": "/data/images/fishes/ex_big/left/body_talk_00.png", "start": 198531, "end": 202083, "audio": 0}, {"filename": "/data/images/fishes/ex_big/left/body_turn_00.png", "start": 202083, "end": 205635, "audio": 0}, {"filename": "/data/images/fishes/ex_big/left/body_vertical_00.png", "start": 205635, "end": 209187, "audio": 0}, {"filename": "/data/images/fishes/ex_big/right/body_rest_00.png", "start": 209187, "end": 212999, "audio": 0}, {"filename": "/data/images/fishes/ex_big/right/body_skeleton_00.png", "start": 212999, "end": 216484, "audio": 0}, {"filename": "/data/images/fishes/ex_big/right/body_swam_00.png", "start": 216484, "end": 220296, "audio": 0}, {"filename": "/data/images/fishes/ex_big/right/body_talk_00.png", "start": 220296, "end": 224108, "audio": 0}, {"filename": "/data/images/fishes/ex_big/right/body_turn_00.png", "start": 224108, "end": 227920, "audio": 0}, {"filename": "/data/images/fishes/ex_big/right/body_vertical_00.png", "start": 227920, "end": 231732, "audio": 0}, {"filename": "/data/images/fishes/ex_small/heads/left/head_blink.png", "start": 231732, "end": 231814, "audio": 0}, {"filename": "/data/images/fishes/ex_small/heads/left/head_dark_00.png", "start": 231814, "end": 231896, "audio": 0}, {"filename": "/data/images/fishes/ex_small/heads/left/head_dark_01.png", "start": 231896, "end": 231978, "audio": 0}, {"filename": "/data/images/fishes/ex_small/heads/left/head_pushing.png", "start": 231978, "end": 232060, "audio": 0}, {"filename": "/data/images/fishes/ex_small/heads/left/head_scowl_00.png", "start": 232060, "end": 232142, "audio": 0}, {"filename": "/data/images/fishes/ex_small/heads/left/head_scowl_01.png", "start": 232142, "end": 232224, "audio": 0}, {"filename": "/data/images/fishes/ex_small/heads/left/head_shock.png", "start": 232224, "end": 232306, "audio": 0}, {"filename": "/data/images/fishes/ex_small/heads/left/head_smile.png", "start": 232306, "end": 232388, "audio": 0}, {"filename": "/data/images/fishes/ex_small/heads/left/head_talking_00.png", "start": 232388, "end": 232470, "audio": 0}, {"filename": "/data/images/fishes/ex_small/heads/left/head_talking_01.png", "start": 232470, "end": 232552, "audio": 0}, {"filename": "/data/images/fishes/ex_small/heads/left/head_talking_02.png", "start": 232552, "end": 232634, "audio": 0}, {"filename": "/data/images/fishes/ex_small/heads/right/head_blink.png", "start": 232634, "end": 232716, "audio": 0}, {"filename": "/data/images/fishes/ex_small/heads/right/head_dark_00.png", "start": 232716, "end": 232798, "audio": 0}, {"filename": "/data/images/fishes/ex_small/heads/right/head_dark_01.png", "start": 232798, "end": 232880, "audio": 0}, {"filename": "/data/images/fishes/ex_small/heads/right/head_pushing.png", "start": 232880, "end": 232962, "audio": 0}, {"filename": "/data/images/fishes/ex_small/heads/right/head_scowl_00.png", "start": 232962, "end": 233044, "audio": 0}, {"filename": "/data/images/fishes/ex_small/heads/right/head_scowl_01.png", "start": 233044, "end": 233126, "audio": 0}, {"filename": "/data/images/fishes/ex_small/heads/right/head_shock.png", "start": 233126, "end": 233208, "audio": 0}, {"filename": "/data/images/fishes/ex_small/heads/right/head_smile.png", "start": 233208, "end": 233290, "audio": 0}, {"filename": "/data/images/fishes/ex_small/heads/right/head_talking_00.png", "start": 233290, "end": 233372, "audio": 0}, {"filename": "/data/images/fishes/ex_small/heads/right/head_talking_01.png", "start": 233372, "end": 233454, "audio": 0}, {"filename": "/data/images/fishes/ex_small/heads/right/head_talking_02.png", "start": 233454, "end": 233536, "audio": 0}, {"filename": "/data/images/fishes/ex_small/left/body_rest_00.png", "start": 233536, "end": 235545, "audio": 0}, {"filename": "/data/images/fishes/ex_small/left/body_skeleton_00.png", "start": 235545, "end": 237373, "audio": 0}, {"filename": "/data/images/fishes/ex_small/left/body_swam_00.png", "start": 237373, "end": 239382, "audio": 0}, {"filename": "/data/images/fishes/ex_small/left/body_talk_00.png", "start": 239382, "end": 241391, "audio": 0}, {"filename": "/data/images/fishes/ex_small/left/body_turn_00.png", "start": 241391, "end": 243400, "audio": 0}, {"filename": "/data/images/fishes/ex_small/left/body_vertical_00.png", "start": 243400, "end": 245409, "audio": 0}, {"filename": "/data/images/fishes/ex_small/right/body_rest_00.png", "start": 245409, "end": 247437, "audio": 0}, {"filename": "/data/images/fishes/ex_small/right/body_skeleton_00.png", "start": 247437, "end": 249273, "audio": 0}, {"filename": "/data/images/fishes/ex_small/right/body_swam_00.png", "start": 249273, "end": 251301, "audio": 0}, {"filename": "/data/images/fishes/ex_small/right/body_talk_00.png", "start": 251301, "end": 253329, "audio": 0}, {"filename": "/data/images/fishes/ex_small/right/body_turn_00.png", "start": 253329, "end": 255357, "audio": 0}, {"filename": "/data/images/fishes/ex_small/right/body_vertical_00.png", "start": 255357, "end": 257385, "audio": 0}, {"filename": "/data/images/fishes/small/heads/left/head_blink.png", "start": 257385, "end": 259097, "audio": 0}, {"filename": "/data/images/fishes/small/heads/left/head_dark_00.png", "start": 259097, "end": 259319, "audio": 0}, {"filename": "/data/images/fishes/small/heads/left/head_dark_01.png", "start": 259319, "end": 259391, "audio": 0}, {"filename": "/data/images/fishes/small/heads/left/head_pushing.png", "start": 259391, "end": 261120, "audio": 0}, {"filename": "/data/images/fishes/small/heads/left/head_scowl_00.png", "start": 261120, "end": 262817, "audio": 0}, {"filename": "/data/images/fishes/small/heads/left/head_scowl_01.png", "start": 262817, "end": 264497, "audio": 0}, {"filename": "/data/images/fishes/small/heads/left/head_shock.png", "start": 264497, "end": 266187, "audio": 0}, {"filename": "/data/images/fishes/small/heads/left/head_smile.png", "start": 266187, "end": 267906, "audio": 0}, {"filename": "/data/images/fishes/small/heads/left/head_talking_00.png", "start": 267906, "end": 267997, "audio": 0}, {"filename": "/data/images/fishes/small/heads/left/head_talking_01.png", "start": 267997, "end": 269547, "audio": 0}, {"filename": "/data/images/fishes/small/heads/left/head_talking_02.png", "start": 269547, "end": 271294, "audio": 0}, {"filename": "/data/images/fishes/small/heads/right/head_blink.png", "start": 271294, "end": 272968, "audio": 0}, {"filename": "/data/images/fishes/small/heads/right/head_dark_00.png", "start": 272968, "end": 273189, "audio": 0}, {"filename": "/data/images/fishes/small/heads/right/head_dark_01.png", "start": 273189, "end": 273261, "audio": 0}, {"filename": "/data/images/fishes/small/heads/right/head_pushing.png", "start": 273261, "end": 274958, "audio": 0}, {"filename": "/data/images/fishes/small/heads/right/head_scowl_00.png", "start": 274958, "end": 276662, "audio": 0}, {"filename": "/data/images/fishes/small/heads/right/head_scowl_01.png", "start": 276662, "end": 278358, "audio": 0}, {"filename": "/data/images/fishes/small/heads/right/head_shock.png", "start": 278358, "end": 280071, "audio": 0}, {"filename": "/data/images/fishes/small/heads/right/head_smile.png", "start": 280071, "end": 281809, "audio": 0}, {"filename": "/data/images/fishes/small/heads/right/head_talking_00.png", "start": 281809, "end": 281900, "audio": 0}, {"filename": "/data/images/fishes/small/heads/right/head_talking_01.png", "start": 281900, "end": 283432, "audio": 0}, {"filename": "/data/images/fishes/small/heads/right/head_talking_02.png", "start": 283432, "end": 285145, "audio": 0}, {"filename": "/data/images/fishes/small/left/body_rest_00.png", "start": 285145, "end": 286717, "audio": 0}, {"filename": "/data/images/fishes/small/left/body_rest_01.png", "start": 286717, "end": 288259, "audio": 0}, {"filename": "/data/images/fishes/small/left/body_rest_02.png", "start": 288259, "end": 289799, "audio": 0}, {"filename": "/data/images/fishes/small/left/body_skeleton_00.png", "start": 289799, "end": 290865, "audio": 0}, {"filename": "/data/images/fishes/small/left/body_swam_00.png", "start": 290865, "end": 292298, "audio": 0}, {"filename": "/data/images/fishes/small/left/body_swam_01.png", "start": 292298, "end": 293633, "audio": 0}, {"filename": "/data/images/fishes/small/left/body_swam_02.png", "start": 293633, "end": 295042, "audio": 0}, {"filename": "/data/images/fishes/small/left/body_swam_03.png", "start": 295042, "end": 296502, "audio": 0}, {"filename": "/data/images/fishes/small/left/body_swam_04.png", "start": 296502, "end": 297850, "audio": 0}, {"filename": "/data/images/fishes/small/left/body_swam_05.png", "start": 297850, "end": 299265, "audio": 0}, {"filename": "/data/images/fishes/small/left/body_talk_00.png", "start": 299265, "end": 300858, "audio": 0}, {"filename": "/data/images/fishes/small/left/body_talk_01.png", "start": 300858, "end": 302424, "audio": 0}, {"filename": "/data/images/fishes/small/left/body_talk_02.png", "start": 302424, "end": 303971, "audio": 0}, {"filename": "/data/images/fishes/small/left/body_turn_00.png", "start": 303971, "end": 305589, "audio": 0}, {"filename": "/data/images/fishes/small/left/body_turn_01.png", "start": 305589, "end": 306685, "audio": 0}, {"filename": "/data/images/fishes/small/left/body_turn_02.png", "start": 306685, "end": 307872, "audio": 0}, {"filename": "/data/images/fishes/small/left/body_vertical_00.png", "start": 307872, "end": 309455, "audio": 0}, {"filename": "/data/images/fishes/small/left/body_vertical_01.png", "start": 309455, "end": 311083, "audio": 0}, {"filename": "/data/images/fishes/small/left/body_vertical_02.png", "start": 311083, "end": 312678, "audio": 0}, {"filename": "/data/images/fishes/small/left/body_vertical_03.png", "start": 312678, "end": 314258, "audio": 0}, {"filename": "/data/images/fishes/small/left/body_vertical_04.png", "start": 314258, "end": 315858, "audio": 0}, {"filename": "/data/images/fishes/small/left/body_vertical_05.png", "start": 315858, "end": 317468, "audio": 0}, {"filename": "/data/images/fishes/small/right/body_rest_00.png", "start": 317468, "end": 319052, "audio": 0}, {"filename": "/data/images/fishes/small/right/body_rest_01.png", "start": 319052, "end": 320596, "audio": 0}, {"filename": "/data/images/fishes/small/right/body_rest_02.png", "start": 320596, "end": 322141, "audio": 0}, {"filename": "/data/images/fishes/small/right/body_skeleton_00.png", "start": 322141, "end": 323204, "audio": 0}, {"filename": "/data/images/fishes/small/right/body_swam_00.png", "start": 323204, "end": 324675, "audio": 0}, {"filename": "/data/images/fishes/small/right/body_swam_01.png", "start": 324675, "end": 326021, "audio": 0}, {"filename": "/data/images/fishes/small/right/body_swam_02.png", "start": 326021, "end": 327435, "audio": 0}, {"filename": "/data/images/fishes/small/right/body_swam_03.png", "start": 327435, "end": 328902, "audio": 0}, {"filename": "/data/images/fishes/small/right/body_swam_04.png", "start": 328902, "end": 330261, "audio": 0}, {"filename": "/data/images/fishes/small/right/body_swam_05.png", "start": 330261, "end": 331688, "audio": 0}, {"filename": "/data/images/fishes/small/right/body_talk_00.png", "start": 331688, "end": 333287, "audio": 0}, {"filename": "/data/images/fishes/small/right/body_talk_01.png", "start": 333287, "end": 334855, "audio": 0}, {"filename": "/data/images/fishes/small/right/body_talk_02.png", "start": 334855, "end": 336402, "audio": 0}, {"filename": "/data/images/fishes/small/right/body_turn_00.png", "start": 336402, "end": 338011, "audio": 0}, {"filename": "/data/images/fishes/small/right/body_turn_01.png", "start": 338011, "end": 339116, "audio": 0}, {"filename": "/data/images/fishes/small/right/body_turn_02.png", "start": 339116, "end": 340309, "audio": 0}, {"filename": "/data/images/fishes/small/right/body_vertical_00.png", "start": 340309, "end": 341920, "audio": 0}, {"filename": "/data/images/fishes/small/right/body_vertical_01.png", "start": 341920, "end": 343564, "audio": 0}, {"filename": "/data/images/fishes/small/right/body_vertical_02.png", "start": 343564, "end": 345190, "audio": 0}, {"filename": "/data/images/fishes/small/right/body_vertical_03.png", "start": 345190, "end": 346790, "audio": 0}, {"filename": "/data/images/fishes/small/right/body_vertical_04.png", "start": 346790, "end": 348424, "audio": 0}, {"filename": "/data/images/fishes/small/right/body_vertical_05.png", "start": 348424, "end": 350056, "audio": 0}], "remote_package_size": 350056, "package_uuid": "e4bd0c18-dd77-49c2-a5af-a611f4e23ccc"});

})();
