
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
    var PACKAGE_NAME = 'web/data/fdto.data';
    var REMOTE_PACKAGE_BASE = 'data/fdto.data';
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
Module['FS_createPath']('/data/images', 'fdto', true, true);
Module['FS_createPath']('/data', 'script', true, true);
Module['FS_createPath']('/data/script', 'fdto', true, true);
Module['FS_createPath']('/data', 'sound', true, true);
Module['FS_createPath']('/data/sound', 'fdto', true, true);
Module['FS_createPath']('/data/sound/fdto', 'cs', true, true);
Module['FS_createPath']('/data/sound/fdto', 'nl', true, true);

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
              Module['removeRunDependency']('datafile_web/data/fdto.data');

    };
    Module['addRunDependency']('datafile_web/data/fdto.data');
  
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
 loadPackage({"files": [{"filename": "/data/images/fdto/antena.png", "start": 0, "end": 525, "audio": 0}, {"filename": "/data/images/fdto/dole_00.png", "start": 525, "end": 1060, "audio": 0}, {"filename": "/data/images/fdto/dole_01.png", "start": 1060, "end": 2428, "audio": 0}, {"filename": "/data/images/fdto/dole_02.png", "start": 2428, "end": 4125, "audio": 0}, {"filename": "/data/images/fdto/dole_03.png", "start": 4125, "end": 6048, "audio": 0}, {"filename": "/data/images/fdto/dole_04.png", "start": 6048, "end": 8052, "audio": 0}, {"filename": "/data/images/fdto/dole_05.png", "start": 8052, "end": 9553, "audio": 0}, {"filename": "/data/images/fdto/dole_06.png", "start": 9553, "end": 10379, "audio": 0}, {"filename": "/data/images/fdto/dole_07.png", "start": 10379, "end": 11818, "audio": 0}, {"filename": "/data/images/fdto/dole_08.png", "start": 11818, "end": 13496, "audio": 0}, {"filename": "/data/images/fdto/dole_09.png", "start": 13496, "end": 15088, "audio": 0}, {"filename": "/data/images/fdto/dole_10.png", "start": 15088, "end": 16597, "audio": 0}, {"filename": "/data/images/fdto/dole_11.png", "start": 16597, "end": 17885, "audio": 0}, {"filename": "/data/images/fdto/dole_12.png", "start": 17885, "end": 18776, "audio": 0}, {"filename": "/data/images/fdto/dole_13.png", "start": 18776, "end": 20046, "audio": 0}, {"filename": "/data/images/fdto/dole_14.png", "start": 20046, "end": 21555, "audio": 0}, {"filename": "/data/images/fdto/dole_15.png", "start": 21555, "end": 23284, "audio": 0}, {"filename": "/data/images/fdto/dole_16.png", "start": 23284, "end": 25268, "audio": 0}, {"filename": "/data/images/fdto/dole_17.png", "start": 25268, "end": 26926, "audio": 0}, {"filename": "/data/images/fdto/dole_18.png", "start": 26926, "end": 27832, "audio": 0}, {"filename": "/data/images/fdto/dole_19.png", "start": 27832, "end": 29524, "audio": 0}, {"filename": "/data/images/fdto/dole_20.png", "start": 29524, "end": 31470, "audio": 0}, {"filename": "/data/images/fdto/dole_21.png", "start": 31470, "end": 33119, "audio": 0}, {"filename": "/data/images/fdto/dole_22.png", "start": 33119, "end": 34668, "audio": 0}, {"filename": "/data/images/fdto/dole_23.png", "start": 34668, "end": 35978, "audio": 0}, {"filename": "/data/images/fdto/dt.png", "start": 35978, "end": 37840, "audio": 0}, {"filename": "/data/images/fdto/f_00.png", "start": 37840, "end": 38935, "audio": 0}, {"filename": "/data/images/fdto/f_01.png", "start": 38935, "end": 40116, "audio": 0}, {"filename": "/data/images/fdto/f_02.png", "start": 40116, "end": 41234, "audio": 0}, {"filename": "/data/images/fdto/f_03.png", "start": 41234, "end": 42067, "audio": 0}, {"filename": "/data/images/fdto/f_04.png", "start": 42067, "end": 42725, "audio": 0}, {"filename": "/data/images/fdto/f_05.png", "start": 42725, "end": 43383, "audio": 0}, {"filename": "/data/images/fdto/f_06.png", "start": 43383, "end": 44041, "audio": 0}, {"filename": "/data/images/fdto/f_07.png", "start": 44041, "end": 44699, "audio": 0}, {"filename": "/data/images/fdto/f_08.png", "start": 44699, "end": 45357, "audio": 0}, {"filename": "/data/images/fdto/f_09.png", "start": 45357, "end": 46279, "audio": 0}, {"filename": "/data/images/fdto/f_10.png", "start": 46279, "end": 47411, "audio": 0}, {"filename": "/data/images/fdto/f_11.png", "start": 47411, "end": 48667, "audio": 0}, {"filename": "/data/images/fdto/f_12.png", "start": 48667, "end": 49685, "audio": 0}, {"filename": "/data/images/fdto/f_13.png", "start": 49685, "end": 50869, "audio": 0}, {"filename": "/data/images/fdto/f_14.png", "start": 50869, "end": 52009, "audio": 0}, {"filename": "/data/images/fdto/f_15.png", "start": 52009, "end": 52910, "audio": 0}, {"filename": "/data/images/fdto/f_16.png", "start": 52910, "end": 53568, "audio": 0}, {"filename": "/data/images/fdto/f_17.png", "start": 53568, "end": 54226, "audio": 0}, {"filename": "/data/images/fdto/f_18.png", "start": 54226, "end": 54884, "audio": 0}, {"filename": "/data/images/fdto/f_19.png", "start": 54884, "end": 55542, "audio": 0}, {"filename": "/data/images/fdto/f_20.png", "start": 55542, "end": 56200, "audio": 0}, {"filename": "/data/images/fdto/f_21.png", "start": 56200, "end": 57109, "audio": 0}, {"filename": "/data/images/fdto/f_22.png", "start": 57109, "end": 58217, "audio": 0}, {"filename": "/data/images/fdto/f_23.png", "start": 58217, "end": 59457, "audio": 0}, {"filename": "/data/images/fdto/fdto-p.png", "start": 59457, "end": 345170, "audio": 0}, {"filename": "/data/images/fdto/fdto-w.png", "start": 345170, "end": 462766, "audio": 0}, {"filename": "/data/images/fdto/konik_00.png", "start": 462766, "end": 464202, "audio": 0}, {"filename": "/data/images/fdto/konik_01.png", "start": 464202, "end": 465597, "audio": 0}, {"filename": "/data/images/fdto/konik_02.png", "start": 465597, "end": 467019, "audio": 0}, {"filename": "/data/images/fdto/koral.png", "start": 467019, "end": 469302, "audio": 0}, {"filename": "/data/images/fdto/krab_00.png", "start": 469302, "end": 470385, "audio": 0}, {"filename": "/data/images/fdto/micek_00.png", "start": 470385, "end": 470670, "audio": 0}, {"filename": "/data/images/fdto/micek_01.png", "start": 470670, "end": 470955, "audio": 0}, {"filename": "/data/images/fdto/micek_02.png", "start": 470955, "end": 471240, "audio": 0}, {"filename": "/data/images/fdto/micek_03.png", "start": 471240, "end": 471525, "audio": 0}, {"filename": "/data/images/fdto/micek_04.png", "start": 471525, "end": 471810, "audio": 0}, {"filename": "/data/images/fdto/micek_05.png", "start": 471810, "end": 472095, "audio": 0}, {"filename": "/data/images/fdto/nahore_00.png", "start": 472095, "end": 472676, "audio": 0}, {"filename": "/data/images/fdto/nahore_01.png", "start": 472676, "end": 474008, "audio": 0}, {"filename": "/data/images/fdto/nahore_02.png", "start": 474008, "end": 475833, "audio": 0}, {"filename": "/data/images/fdto/nahore_03.png", "start": 475833, "end": 477778, "audio": 0}, {"filename": "/data/images/fdto/nahore_04.png", "start": 477778, "end": 479795, "audio": 0}, {"filename": "/data/images/fdto/nahore_05.png", "start": 479795, "end": 481253, "audio": 0}, {"filename": "/data/images/fdto/nahore_06.png", "start": 481253, "end": 481961, "audio": 0}, {"filename": "/data/images/fdto/nahore_07.png", "start": 481961, "end": 483338, "audio": 0}, {"filename": "/data/images/fdto/nahore_08.png", "start": 483338, "end": 485116, "audio": 0}, {"filename": "/data/images/fdto/nahore_09.png", "start": 485116, "end": 486756, "audio": 0}, {"filename": "/data/images/fdto/nahore_10.png", "start": 486756, "end": 488321, "audio": 0}, {"filename": "/data/images/fdto/nahore_11.png", "start": 488321, "end": 489678, "audio": 0}, {"filename": "/data/images/fdto/nahore_12.png", "start": 489678, "end": 490583, "audio": 0}, {"filename": "/data/images/fdto/nahore_13.png", "start": 490583, "end": 491907, "audio": 0}, {"filename": "/data/images/fdto/nahore_14.png", "start": 491907, "end": 493546, "audio": 0}, {"filename": "/data/images/fdto/nahore_15.png", "start": 493546, "end": 495306, "audio": 0}, {"filename": "/data/images/fdto/nahore_16.png", "start": 495306, "end": 497356, "audio": 0}, {"filename": "/data/images/fdto/nahore_17.png", "start": 497356, "end": 498987, "audio": 0}, {"filename": "/data/images/fdto/nahore_18.png", "start": 498987, "end": 499809, "audio": 0}, {"filename": "/data/images/fdto/nahore_19.png", "start": 499809, "end": 501383, "audio": 0}, {"filename": "/data/images/fdto/nahore_20.png", "start": 501383, "end": 503411, "audio": 0}, {"filename": "/data/images/fdto/nahore_21.png", "start": 503411, "end": 505095, "audio": 0}, {"filename": "/data/images/fdto/nahore_22.png", "start": 505095, "end": 506722, "audio": 0}, {"filename": "/data/images/fdto/nahore_23.png", "start": 506722, "end": 508132, "audio": 0}, {"filename": "/data/images/fdto/o_00.png", "start": 508132, "end": 509690, "audio": 0}, {"filename": "/data/images/fdto/o_01.png", "start": 509690, "end": 517093, "audio": 0}, {"filename": "/data/images/fdto/o_02.png", "start": 517093, "end": 525444, "audio": 0}, {"filename": "/data/images/fdto/o_03.png", "start": 525444, "end": 533772, "audio": 0}, {"filename": "/data/images/fdto/o_04.png", "start": 533772, "end": 542327, "audio": 0}, {"filename": "/data/images/fdto/o_05.png", "start": 542327, "end": 549546, "audio": 0}, {"filename": "/data/images/fdto/o_06.png", "start": 549546, "end": 554705, "audio": 0}, {"filename": "/data/images/fdto/o_07.png", "start": 554705, "end": 561722, "audio": 0}, {"filename": "/data/images/fdto/o_08.png", "start": 561722, "end": 569847, "audio": 0}, {"filename": "/data/images/fdto/o_09.png", "start": 569847, "end": 577941, "audio": 0}, {"filename": "/data/images/fdto/o_10.png", "start": 577941, "end": 586099, "audio": 0}, {"filename": "/data/images/fdto/o_11.png", "start": 586099, "end": 593406, "audio": 0}, {"filename": "/data/images/fdto/o_12.png", "start": 593406, "end": 599595, "audio": 0}, {"filename": "/data/images/fdto/o_13.png", "start": 599595, "end": 606878, "audio": 0}, {"filename": "/data/images/fdto/o_14.png", "start": 606878, "end": 614850, "audio": 0}, {"filename": "/data/images/fdto/o_15.png", "start": 614850, "end": 623214, "audio": 0}, {"filename": "/data/images/fdto/o_16.png", "start": 623214, "end": 631744, "audio": 0}, {"filename": "/data/images/fdto/o_17.png", "start": 631744, "end": 639464, "audio": 0}, {"filename": "/data/images/fdto/o_18.png", "start": 639464, "end": 644931, "audio": 0}, {"filename": "/data/images/fdto/o_19.png", "start": 644931, "end": 652404, "audio": 0}, {"filename": "/data/images/fdto/o_20.png", "start": 652404, "end": 660730, "audio": 0}, {"filename": "/data/images/fdto/o_21.png", "start": 660730, "end": 668899, "audio": 0}, {"filename": "/data/images/fdto/o_22.png", "start": 668899, "end": 676960, "audio": 0}, {"filename": "/data/images/fdto/o_23.png", "start": 676960, "end": 684376, "audio": 0}, {"filename": "/data/images/fdto/prazdne.png", "start": 684376, "end": 684487, "audio": 0}, {"filename": "/data/images/fdto/semafor_00.png", "start": 684487, "end": 686624, "audio": 0}, {"filename": "/data/images/fdto/semafor_01.png", "start": 686624, "end": 688800, "audio": 0}, {"filename": "/data/images/fdto/semafor_02.png", "start": 688800, "end": 690971, "audio": 0}, {"filename": "/data/images/fdto/semafor_03.png", "start": 690971, "end": 692978, "audio": 0}, {"filename": "/data/images/fdto/spodek_00.png", "start": 692978, "end": 693903, "audio": 0}, {"filename": "/data/images/fdto/spodek_01.png", "start": 693903, "end": 695670, "audio": 0}, {"filename": "/data/images/fdto/spodek_02.png", "start": 695670, "end": 697538, "audio": 0}, {"filename": "/data/images/fdto/spodek_03.png", "start": 697538, "end": 699425, "audio": 0}, {"filename": "/data/images/fdto/spodek_04.png", "start": 699425, "end": 701435, "audio": 0}, {"filename": "/data/images/fdto/spodek_05.png", "start": 701435, "end": 703212, "audio": 0}, {"filename": "/data/images/fdto/spodek_06.png", "start": 703212, "end": 704713, "audio": 0}, {"filename": "/data/images/fdto/spodek_07.png", "start": 704713, "end": 706415, "audio": 0}, {"filename": "/data/images/fdto/spodek_08.png", "start": 706415, "end": 708283, "audio": 0}, {"filename": "/data/images/fdto/spodek_09.png", "start": 708283, "end": 710166, "audio": 0}, {"filename": "/data/images/fdto/spodek_10.png", "start": 710166, "end": 711985, "audio": 0}, {"filename": "/data/images/fdto/spodek_11.png", "start": 711985, "end": 713708, "audio": 0}, {"filename": "/data/images/fdto/spodek_12.png", "start": 713708, "end": 715239, "audio": 0}, {"filename": "/data/images/fdto/spodek_13.png", "start": 715239, "end": 716907, "audio": 0}, {"filename": "/data/images/fdto/spodek_14.png", "start": 716907, "end": 718691, "audio": 0}, {"filename": "/data/images/fdto/spodek_15.png", "start": 718691, "end": 720619, "audio": 0}, {"filename": "/data/images/fdto/spodek_16.png", "start": 720619, "end": 722531, "audio": 0}, {"filename": "/data/images/fdto/spodek_17.png", "start": 722531, "end": 724357, "audio": 0}, {"filename": "/data/images/fdto/spodek_18.png", "start": 724357, "end": 725853, "audio": 0}, {"filename": "/data/images/fdto/spodek_19.png", "start": 725853, "end": 727744, "audio": 0}, {"filename": "/data/images/fdto/spodek_20.png", "start": 727744, "end": 729709, "audio": 0}, {"filename": "/data/images/fdto/spodek_21.png", "start": 729709, "end": 731618, "audio": 0}, {"filename": "/data/images/fdto/spodek_22.png", "start": 731618, "end": 733449, "audio": 0}, {"filename": "/data/images/fdto/spodek_23.png", "start": 733449, "end": 735170, "audio": 0}, {"filename": "/data/images/fdto/velryb_00.png", "start": 735170, "end": 738610, "audio": 0}, {"filename": "/data/images/fdto/velryb_01.png", "start": 738610, "end": 742170, "audio": 0}, {"filename": "/data/images/fdto/velryb_02.png", "start": 742170, "end": 745692, "audio": 0}, {"filename": "/data/images/fdto/velryb_03.png", "start": 745692, "end": 749216, "audio": 0}, {"filename": "/data/images/fdto/velryb_04.png", "start": 749216, "end": 752786, "audio": 0}, {"filename": "/data/images/fdto/velryb_05.png", "start": 752786, "end": 756416, "audio": 0}, {"filename": "/data/images/fdto/velryb_06.png", "start": 756416, "end": 760000, "audio": 0}, {"filename": "/data/images/fdto/velryb_07.png", "start": 760000, "end": 763578, "audio": 0}, {"filename": "/data/images/fdto/velryb_08.png", "start": 763578, "end": 767134, "audio": 0}, {"filename": "/data/images/fdto/velryb_09.png", "start": 767134, "end": 770649, "audio": 0}, {"filename": "/data/images/fdto/velryb_10.png", "start": 770649, "end": 774205, "audio": 0}, {"filename": "/data/images/fdto/velryb_11.png", "start": 774205, "end": 777698, "audio": 0}, {"filename": "/data/images/fdto/vrsek_00.png", "start": 777698, "end": 777960, "audio": 0}, {"filename": "/data/images/fdto/vrsek_01.png", "start": 777960, "end": 778204, "audio": 0}, {"filename": "/data/images/fdto/vrsek01.png", "start": 778204, "end": 778448, "audio": 0}, {"filename": "/data/images/fdto/vrsek_02.png", "start": 778448, "end": 778732, "audio": 0}, {"filename": "/data/images/fdto/vrsek_03.png", "start": 778732, "end": 779026, "audio": 0}, {"filename": "/data/images/fdto/vrsek_04.png", "start": 779026, "end": 779340, "audio": 0}, {"filename": "/data/images/fdto/vrsek_05.png", "start": 779340, "end": 779636, "audio": 0}, {"filename": "/data/images/fdto/vrsek_06.png", "start": 779636, "end": 779873, "audio": 0}, {"filename": "/data/images/fdto/vrsek_07.png", "start": 779873, "end": 780151, "audio": 0}, {"filename": "/data/images/fdto/vrsek_08.png", "start": 780151, "end": 780435, "audio": 0}, {"filename": "/data/images/fdto/vrsek_09.png", "start": 780435, "end": 780735, "audio": 0}, {"filename": "/data/images/fdto/vrsek_10.png", "start": 780735, "end": 781014, "audio": 0}, {"filename": "/data/images/fdto/vrsek_11.png", "start": 781014, "end": 781296, "audio": 0}, {"filename": "/data/images/fdto/vrsek_12.png", "start": 781296, "end": 781547, "audio": 0}, {"filename": "/data/images/fdto/vrsek_13.png", "start": 781547, "end": 781802, "audio": 0}, {"filename": "/data/images/fdto/vrsek_14.png", "start": 781802, "end": 782085, "audio": 0}, {"filename": "/data/images/fdto/vrsek_15.png", "start": 782085, "end": 782372, "audio": 0}, {"filename": "/data/images/fdto/vrsek_16.png", "start": 782372, "end": 782677, "audio": 0}, {"filename": "/data/images/fdto/vrsek_17.png", "start": 782677, "end": 782973, "audio": 0}, {"filename": "/data/images/fdto/vrsek_18.png", "start": 782973, "end": 783233, "audio": 0}, {"filename": "/data/images/fdto/vrsek_19.png", "start": 783233, "end": 783525, "audio": 0}, {"filename": "/data/images/fdto/vrsek_20.png", "start": 783525, "end": 783841, "audio": 0}, {"filename": "/data/images/fdto/vrsek_21.png", "start": 783841, "end": 784155, "audio": 0}, {"filename": "/data/images/fdto/vrsek_22.png", "start": 784155, "end": 784446, "audio": 0}, {"filename": "/data/images/fdto/vrsek_23.png", "start": 784446, "end": 784718, "audio": 0}, {"filename": "/data/script/fdto/code.lua", "start": 784718, "end": 789413, "audio": 0}, {"filename": "/data/script/fdto/dialogs_bg.lua", "start": 789413, "end": 793103, "audio": 0}, {"filename": "/data/script/fdto/dialogs_cs.lua", "start": 793103, "end": 796140, "audio": 0}, {"filename": "/data/script/fdto/dialogs_de.lua", "start": 796140, "end": 799182, "audio": 0}, {"filename": "/data/script/fdto/dialogs_en.lua", "start": 799182, "end": 800991, "audio": 0}, {"filename": "/data/script/fdto/dialogs.lua", "start": 800991, "end": 801029, "audio": 0}, {"filename": "/data/script/fdto/dialogs_nl.lua", "start": 801029, "end": 804034, "audio": 0}, {"filename": "/data/script/fdto/dialogs_pl.lua", "start": 804034, "end": 807049, "audio": 0}, {"filename": "/data/script/fdto/dialogs_ru.lua", "start": 807049, "end": 810667, "audio": 0}, {"filename": "/data/script/fdto/dialogs_sv.lua", "start": 810667, "end": 813711, "audio": 0}, {"filename": "/data/script/fdto/init.lua", "start": 813711, "end": 814354, "audio": 0}, {"filename": "/data/script/fdto/models.lua", "start": 814354, "end": 818146, "audio": 0}, {"filename": "/data/sound/fdto/cs/agenti-m.ogg", "start": 818146, "end": 839222, "audio": 1}, {"filename": "/data/sound/fdto/cs/budova-m.ogg", "start": 839222, "end": 867490, "audio": 1}, {"filename": "/data/sound/fdto/cs/cely-m.ogg", "start": 867490, "end": 883047, "audio": 1}, {"filename": "/data/sound/fdto/cs/drzel-m.ogg", "start": 883047, "end": 930137, "audio": 1}, {"filename": "/data/sound/fdto/cs/hybeme-v.ogg", "start": 930137, "end": 973473, "audio": 1}, {"filename": "/data/sound/fdto/cs/kecas-v.ogg", "start": 973473, "end": 994119, "audio": 1}, {"filename": "/data/sound/fdto/cs/mene-m.ogg", "start": 994119, "end": 1011167, "audio": 1}, {"filename": "/data/sound/fdto/cs/mrka-m.ogg", "start": 1011167, "end": 1047530, "audio": 1}, {"filename": "/data/sound/fdto/cs/nacekala2-m.ogg", "start": 1047530, "end": 1068932, "audio": 1}, {"filename": "/data/sound/fdto/cs/nacekala-m.ogg", "start": 1068932, "end": 1086859, "audio": 1}, {"filename": "/data/sound/fdto/cs/nebyl-v.ogg", "start": 1086859, "end": 1120575, "audio": 1}, {"filename": "/data/sound/fdto/cs/nejlepsi-b.ogg", "start": 1120575, "end": 1146165, "audio": 1}, {"filename": "/data/sound/fdto/cs/nemrka-v.ogg", "start": 1146165, "end": 1158809, "audio": 1}, {"filename": "/data/sound/fdto/cs/nevi-b.ogg", "start": 1158809, "end": 1185611, "audio": 1}, {"filename": "/data/sound/fdto/cs/podvodou-v.ogg", "start": 1185611, "end": 1196524, "audio": 1}, {"filename": "/data/sound/fdto/cs/proc-m.ogg", "start": 1196524, "end": 1254127, "audio": 1}, {"filename": "/data/sound/fdto/cs/proc-v.ogg", "start": 1254127, "end": 1301809, "audio": 1}, {"filename": "/data/sound/fdto/cs/rozbil-v.ogg", "start": 1301809, "end": 1329553, "audio": 1}, {"filename": "/data/sound/fdto/cs/rozkladaci-v.ogg", "start": 1329553, "end": 1358140, "audio": 1}, {"filename": "/data/sound/fdto/cs/semafor-v.ogg", "start": 1358140, "end": 1391307, "audio": 1}, {"filename": "/data/sound/fdto/cs/ted1-m.ogg", "start": 1391307, "end": 1416469, "audio": 1}, {"filename": "/data/sound/fdto/cs/ted2-m.ogg", "start": 1416469, "end": 1440799, "audio": 1}, {"filename": "/data/sound/fdto/cs/ted3-m.ogg", "start": 1440799, "end": 1461836, "audio": 1}, {"filename": "/data/sound/fdto/cs/ted4-m.ogg", "start": 1461836, "end": 1492964, "audio": 1}, {"filename": "/data/sound/fdto/cs/ted5-m.ogg", "start": 1492964, "end": 1519029, "audio": 1}, {"filename": "/data/sound/fdto/cs/ted6-m.ogg", "start": 1519029, "end": 1559089, "audio": 1}, {"filename": "/data/sound/fdto/cs/vidis-v.ogg", "start": 1559089, "end": 1572572, "audio": 1}, {"filename": "/data/sound/fdto/cs/zelena-v.ogg", "start": 1572572, "end": 1598943, "audio": 1}, {"filename": "/data/sound/fdto/nl/agenti-m.ogg", "start": 1598943, "end": 1618772, "audio": 1}, {"filename": "/data/sound/fdto/nl/budova-m.ogg", "start": 1618772, "end": 1650238, "audio": 1}, {"filename": "/data/sound/fdto/nl/cely-m.ogg", "start": 1650238, "end": 1667594, "audio": 1}, {"filename": "/data/sound/fdto/nl/drzel-m.ogg", "start": 1667594, "end": 1701556, "audio": 1}, {"filename": "/data/sound/fdto/nl/hybeme-v.ogg", "start": 1701556, "end": 1727255, "audio": 1}, {"filename": "/data/sound/fdto/nl/kecas-v.ogg", "start": 1727255, "end": 1743915, "audio": 1}, {"filename": "/data/sound/fdto/nl/mene-m.ogg", "start": 1743915, "end": 1762783, "audio": 1}, {"filename": "/data/sound/fdto/nl/mrka-m.ogg", "start": 1762783, "end": 1785809, "audio": 1}, {"filename": "/data/sound/fdto/nl/nacekala-m.ogg", "start": 1785809, "end": 1805959, "audio": 1}, {"filename": "/data/sound/fdto/nl/nebyl-v.ogg", "start": 1805959, "end": 1831467, "audio": 1}, {"filename": "/data/sound/fdto/nl/nemrka-v.ogg", "start": 1831467, "end": 1848688, "audio": 1}, {"filename": "/data/sound/fdto/nl/podvodou-v.ogg", "start": 1848688, "end": 1865278, "audio": 1}, {"filename": "/data/sound/fdto/nl/proc-m.ogg", "start": 1865278, "end": 1897140, "audio": 1}, {"filename": "/data/sound/fdto/nl/proc-v.ogg", "start": 1897140, "end": 1922742, "audio": 1}, {"filename": "/data/sound/fdto/nl/rozbil-v.ogg", "start": 1922742, "end": 1946472, "audio": 1}, {"filename": "/data/sound/fdto/nl/rozkladaci-v.ogg", "start": 1946472, "end": 1965539, "audio": 1}, {"filename": "/data/sound/fdto/nl/semafor-v.ogg", "start": 1965539, "end": 1988149, "audio": 1}, {"filename": "/data/sound/fdto/nl/ted1-m.ogg", "start": 1988149, "end": 2006101, "audio": 1}, {"filename": "/data/sound/fdto/nl/ted2-m.ogg", "start": 2006101, "end": 2023188, "audio": 1}, {"filename": "/data/sound/fdto/nl/ted3-m.ogg", "start": 2023188, "end": 2041024, "audio": 1}, {"filename": "/data/sound/fdto/nl/ted4-m.ogg", "start": 2041024, "end": 2060703, "audio": 1}, {"filename": "/data/sound/fdto/nl/vidis-v.ogg", "start": 2060703, "end": 2077970, "audio": 1}, {"filename": "/data/sound/fdto/nl/zelena-v.ogg", "start": 2077970, "end": 2098923, "audio": 1}], "remote_package_size": 2098923, "package_uuid": "81a316af-2bdf-436f-92e4-aff2cfcae4cb"});

})();
