
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
    var PACKAGE_NAME = 'web/data/puzzle.data';
    var REMOTE_PACKAGE_BASE = 'data/puzzle.data';
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
Module['FS_createPath']('/data/images', 'puzzle', true, true);
Module['FS_createPath']('/data', 'script', true, true);
Module['FS_createPath']('/data/script', 'puzzle', true, true);
Module['FS_createPath']('/data', 'sound', true, true);
Module['FS_createPath']('/data/sound', 'puzzle', true, true);
Module['FS_createPath']('/data/sound/puzzle', 'cs', true, true);
Module['FS_createPath']('/data/sound/puzzle', 'en', true, true);
Module['FS_createPath']('/data/sound/puzzle', 'nl', true, true);

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
              Module['removeRunDependency']('datafile_web/data/puzzle.data');

    };
    Module['addRunDependency']('datafile_web/data/puzzle.data');
  
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
 loadPackage({"files": [{"filename": "/data/images/puzzle/01-mona_00.png", "start": 0, "end": 6200, "audio": 0}, {"filename": "/data/images/puzzle/01-mona_01.png", "start": 6200, "end": 12393, "audio": 0}, {"filename": "/data/images/puzzle/01-mona_02.png", "start": 12393, "end": 18607, "audio": 0}, {"filename": "/data/images/puzzle/01-mona_03.png", "start": 18607, "end": 24833, "audio": 0}, {"filename": "/data/images/puzzle/01-mona_04.png", "start": 24833, "end": 31066, "audio": 0}, {"filename": "/data/images/puzzle/02-mona_00.png", "start": 31066, "end": 36221, "audio": 0}, {"filename": "/data/images/puzzle/02-mona_01.png", "start": 36221, "end": 41365, "audio": 0}, {"filename": "/data/images/puzzle/02-mona_02.png", "start": 41365, "end": 46514, "audio": 0}, {"filename": "/data/images/puzzle/02-mona_03.png", "start": 46514, "end": 51665, "audio": 0}, {"filename": "/data/images/puzzle/02-mona_04.png", "start": 51665, "end": 56814, "audio": 0}, {"filename": "/data/images/puzzle/03-mona_00.png", "start": 56814, "end": 62803, "audio": 0}, {"filename": "/data/images/puzzle/03-mona_01.png", "start": 62803, "end": 68792, "audio": 0}, {"filename": "/data/images/puzzle/03-mona_02.png", "start": 68792, "end": 74781, "audio": 0}, {"filename": "/data/images/puzzle/03-mona_03.png", "start": 74781, "end": 80770, "audio": 0}, {"filename": "/data/images/puzzle/03-mona_04.png", "start": 80770, "end": 86759, "audio": 0}, {"filename": "/data/images/puzzle/04-mona_00.png", "start": 86759, "end": 91652, "audio": 0}, {"filename": "/data/images/puzzle/04-mona_01.png", "start": 91652, "end": 96545, "audio": 0}, {"filename": "/data/images/puzzle/04-mona_02.png", "start": 96545, "end": 101438, "audio": 0}, {"filename": "/data/images/puzzle/04-mona_03.png", "start": 101438, "end": 106331, "audio": 0}, {"filename": "/data/images/puzzle/04-mona_04.png", "start": 106331, "end": 111224, "audio": 0}, {"filename": "/data/images/puzzle/05-mona_00.png", "start": 111224, "end": 117488, "audio": 0}, {"filename": "/data/images/puzzle/05-mona_01.png", "start": 117488, "end": 123580, "audio": 0}, {"filename": "/data/images/puzzle/05-mona_02.png", "start": 123580, "end": 129729, "audio": 0}, {"filename": "/data/images/puzzle/05-mona_03.png", "start": 129729, "end": 136004, "audio": 0}, {"filename": "/data/images/puzzle/05-mona_04.png", "start": 136004, "end": 142370, "audio": 0}, {"filename": "/data/images/puzzle/06-mona_00.png", "start": 142370, "end": 147912, "audio": 0}, {"filename": "/data/images/puzzle/06-mona_01.png", "start": 147912, "end": 153371, "audio": 0}, {"filename": "/data/images/puzzle/06-mona_02.png", "start": 153371, "end": 158914, "audio": 0}, {"filename": "/data/images/puzzle/06-mona_03.png", "start": 158914, "end": 164598, "audio": 0}, {"filename": "/data/images/puzzle/06-mona_04.png", "start": 164598, "end": 170311, "audio": 0}, {"filename": "/data/images/puzzle/07-mona_00.png", "start": 170311, "end": 176320, "audio": 0}, {"filename": "/data/images/puzzle/07-mona_01.png", "start": 176320, "end": 182183, "audio": 0}, {"filename": "/data/images/puzzle/07-mona_02.png", "start": 182183, "end": 188134, "audio": 0}, {"filename": "/data/images/puzzle/07-mona_03.png", "start": 188134, "end": 194212, "audio": 0}, {"filename": "/data/images/puzzle/07-mona_04.png", "start": 194212, "end": 200362, "audio": 0}, {"filename": "/data/images/puzzle/08-mona_00.png", "start": 200362, "end": 205318, "audio": 0}, {"filename": "/data/images/puzzle/08-mona_01.png", "start": 205318, "end": 210274, "audio": 0}, {"filename": "/data/images/puzzle/08-mona_02.png", "start": 210274, "end": 215230, "audio": 0}, {"filename": "/data/images/puzzle/08-mona_03.png", "start": 215230, "end": 220186, "audio": 0}, {"filename": "/data/images/puzzle/08-mona_04.png", "start": 220186, "end": 225142, "audio": 0}, {"filename": "/data/images/puzzle/09-mona_00.png", "start": 225142, "end": 231785, "audio": 0}, {"filename": "/data/images/puzzle/09-mona_01.png", "start": 231785, "end": 238418, "audio": 0}, {"filename": "/data/images/puzzle/09-mona_02.png", "start": 238418, "end": 245052, "audio": 0}, {"filename": "/data/images/puzzle/09-mona_03.png", "start": 245052, "end": 251690, "audio": 0}, {"filename": "/data/images/puzzle/09-mona_04.png", "start": 251690, "end": 258329, "audio": 0}, {"filename": "/data/images/puzzle/10-mona_00.png", "start": 258329, "end": 263577, "audio": 0}, {"filename": "/data/images/puzzle/10-mona_01.png", "start": 263577, "end": 268754, "audio": 0}, {"filename": "/data/images/puzzle/10-mona_02.png", "start": 268754, "end": 273918, "audio": 0}, {"filename": "/data/images/puzzle/10-mona_03.png", "start": 273918, "end": 279049, "audio": 0}, {"filename": "/data/images/puzzle/10-mona_04.png", "start": 279049, "end": 284181, "audio": 0}, {"filename": "/data/images/puzzle/11-mona_00.png", "start": 284181, "end": 288593, "audio": 0}, {"filename": "/data/images/puzzle/11-mona_01.png", "start": 288593, "end": 293004, "audio": 0}, {"filename": "/data/images/puzzle/11-mona_02.png", "start": 293004, "end": 297414, "audio": 0}, {"filename": "/data/images/puzzle/11-mona_03.png", "start": 297414, "end": 301823, "audio": 0}, {"filename": "/data/images/puzzle/11-mona_04.png", "start": 301823, "end": 306232, "audio": 0}, {"filename": "/data/images/puzzle/12-mona_00.png", "start": 306232, "end": 311302, "audio": 0}, {"filename": "/data/images/puzzle/12-mona_01.png", "start": 311302, "end": 316372, "audio": 0}, {"filename": "/data/images/puzzle/12-mona_02.png", "start": 316372, "end": 321442, "audio": 0}, {"filename": "/data/images/puzzle/12-mona_03.png", "start": 321442, "end": 326512, "audio": 0}, {"filename": "/data/images/puzzle/12-mona_04.png", "start": 326512, "end": 331582, "audio": 0}, {"filename": "/data/images/puzzle/13-mona_00.png", "start": 331582, "end": 337127, "audio": 0}, {"filename": "/data/images/puzzle/13-mona_01.png", "start": 337127, "end": 342672, "audio": 0}, {"filename": "/data/images/puzzle/13-mona_02.png", "start": 342672, "end": 348217, "audio": 0}, {"filename": "/data/images/puzzle/13-mona_03.png", "start": 348217, "end": 353762, "audio": 0}, {"filename": "/data/images/puzzle/13-mona_04.png", "start": 353762, "end": 359307, "audio": 0}, {"filename": "/data/images/puzzle/14-mona_00.png", "start": 359307, "end": 366023, "audio": 0}, {"filename": "/data/images/puzzle/14-mona_01.png", "start": 366023, "end": 372739, "audio": 0}, {"filename": "/data/images/puzzle/14-mona_02.png", "start": 372739, "end": 379455, "audio": 0}, {"filename": "/data/images/puzzle/14-mona_03.png", "start": 379455, "end": 386171, "audio": 0}, {"filename": "/data/images/puzzle/14-mona_04.png", "start": 386171, "end": 392887, "audio": 0}, {"filename": "/data/images/puzzle/15-mona_00.png", "start": 392887, "end": 397016, "audio": 0}, {"filename": "/data/images/puzzle/15-mona_01.png", "start": 397016, "end": 401145, "audio": 0}, {"filename": "/data/images/puzzle/15-mona_02.png", "start": 401145, "end": 405274, "audio": 0}, {"filename": "/data/images/puzzle/15-mona_03.png", "start": 405274, "end": 409403, "audio": 0}, {"filename": "/data/images/puzzle/15-mona_04.png", "start": 409403, "end": 413532, "audio": 0}, {"filename": "/data/images/puzzle/16-mona_00.png", "start": 413532, "end": 419610, "audio": 0}, {"filename": "/data/images/puzzle/16-mona_01.png", "start": 419610, "end": 425688, "audio": 0}, {"filename": "/data/images/puzzle/16-mona_02.png", "start": 425688, "end": 431766, "audio": 0}, {"filename": "/data/images/puzzle/16-mona_03.png", "start": 431766, "end": 437844, "audio": 0}, {"filename": "/data/images/puzzle/16-mona_04.png", "start": 437844, "end": 443922, "audio": 0}, {"filename": "/data/images/puzzle/17-mona_00.png", "start": 443922, "end": 450081, "audio": 0}, {"filename": "/data/images/puzzle/17-mona_01.png", "start": 450081, "end": 456240, "audio": 0}, {"filename": "/data/images/puzzle/17-mona_02.png", "start": 456240, "end": 462399, "audio": 0}, {"filename": "/data/images/puzzle/17-mona_03.png", "start": 462399, "end": 468558, "audio": 0}, {"filename": "/data/images/puzzle/17-mona_04.png", "start": 468558, "end": 474717, "audio": 0}, {"filename": "/data/images/puzzle/18-mona_00.png", "start": 474717, "end": 480348, "audio": 0}, {"filename": "/data/images/puzzle/18-mona_01.png", "start": 480348, "end": 485979, "audio": 0}, {"filename": "/data/images/puzzle/18-mona_02.png", "start": 485979, "end": 491610, "audio": 0}, {"filename": "/data/images/puzzle/18-mona_03.png", "start": 491610, "end": 497241, "audio": 0}, {"filename": "/data/images/puzzle/18-mona_04.png", "start": 497241, "end": 502872, "audio": 0}, {"filename": "/data/images/puzzle/19-mona_00.png", "start": 502872, "end": 508191, "audio": 0}, {"filename": "/data/images/puzzle/19-mona_01.png", "start": 508191, "end": 513510, "audio": 0}, {"filename": "/data/images/puzzle/19-mona_02.png", "start": 513510, "end": 518829, "audio": 0}, {"filename": "/data/images/puzzle/19-mona_03.png", "start": 518829, "end": 524148, "audio": 0}, {"filename": "/data/images/puzzle/19-mona_04.png", "start": 524148, "end": 529467, "audio": 0}, {"filename": "/data/images/puzzle/20-mona_00.png", "start": 529467, "end": 536105, "audio": 0}, {"filename": "/data/images/puzzle/20-mona_01.png", "start": 536105, "end": 542743, "audio": 0}, {"filename": "/data/images/puzzle/20-mona_02.png", "start": 542743, "end": 549381, "audio": 0}, {"filename": "/data/images/puzzle/20-mona_03.png", "start": 549381, "end": 556019, "audio": 0}, {"filename": "/data/images/puzzle/20-mona_04.png", "start": 556019, "end": 562657, "audio": 0}, {"filename": "/data/images/puzzle/pld_00.png", "start": 562657, "end": 573223, "audio": 0}, {"filename": "/data/images/puzzle/pld_01.png", "start": 573223, "end": 583141, "audio": 0}, {"filename": "/data/images/puzzle/pld_02.png", "start": 583141, "end": 593676, "audio": 0}, {"filename": "/data/images/puzzle/pld_03.png", "start": 593676, "end": 604041, "audio": 0}, {"filename": "/data/images/puzzle/pld_04.png", "start": 604041, "end": 614862, "audio": 0}, {"filename": "/data/images/puzzle/pld_05.png", "start": 614862, "end": 625963, "audio": 0}, {"filename": "/data/images/puzzle/pld_06.png", "start": 625963, "end": 636613, "audio": 0}, {"filename": "/data/images/puzzle/pld_07.png", "start": 636613, "end": 647525, "audio": 0}, {"filename": "/data/images/puzzle/pld_08.png", "start": 647525, "end": 658763, "audio": 0}, {"filename": "/data/images/puzzle/pld_09.png", "start": 658763, "end": 669439, "audio": 0}, {"filename": "/data/images/puzzle/pld_10.png", "start": 669439, "end": 680365, "audio": 0}, {"filename": "/data/images/puzzle/pld_11.png", "start": 680365, "end": 691527, "audio": 0}, {"filename": "/data/images/puzzle/pld_12.png", "start": 691527, "end": 702285, "audio": 0}, {"filename": "/data/images/puzzle/pld_13.png", "start": 702285, "end": 713298, "audio": 0}, {"filename": "/data/images/puzzle/pld_14.png", "start": 713298, "end": 724643, "audio": 0}, {"filename": "/data/images/puzzle/pld_15.png", "start": 724643, "end": 735893, "audio": 0}, {"filename": "/data/images/puzzle/puclik-21-tmp.png", "start": 735893, "end": 741256, "audio": 0}, {"filename": "/data/images/puzzle/puclik-22-tmp.png", "start": 741256, "end": 742624, "audio": 0}, {"filename": "/data/images/puzzle/puclik-23-tmp.png", "start": 742624, "end": 743320, "audio": 0}, {"filename": "/data/images/puzzle/puclik-24-tmp.png", "start": 743320, "end": 744016, "audio": 0}, {"filename": "/data/images/puzzle/puclik-26-tmp.png", "start": 744016, "end": 750443, "audio": 0}, {"filename": "/data/images/puzzle/puclik-27-tmp.png", "start": 750443, "end": 751382, "audio": 0}, {"filename": "/data/images/puzzle/puclik-28-tmp.png", "start": 751382, "end": 754088, "audio": 0}, {"filename": "/data/images/puzzle/puclik-29-tmp.png", "start": 754088, "end": 754888, "audio": 0}, {"filename": "/data/images/puzzle/puclik-30-tmp.png", "start": 754888, "end": 755688, "audio": 0}, {"filename": "/data/images/puzzle/puclik-31-tmp.png", "start": 755688, "end": 756612, "audio": 0}, {"filename": "/data/images/puzzle/puclik-p.png", "start": 756612, "end": 1132683, "audio": 0}, {"filename": "/data/images/puzzle/puclik-w.png", "start": 1132683, "end": 1280255, "audio": 0}, {"filename": "/data/script/puzzle/code.lua", "start": 1280255, "end": 1290603, "audio": 0}, {"filename": "/data/script/puzzle/dialogs_bg.lua", "start": 1290603, "end": 1292769, "audio": 0}, {"filename": "/data/script/puzzle/dialogs_cs.lua", "start": 1292769, "end": 1294540, "audio": 0}, {"filename": "/data/script/puzzle/dialogs_de.lua", "start": 1294540, "end": 1296345, "audio": 0}, {"filename": "/data/script/puzzle/dialogs_en.lua", "start": 1296345, "end": 1297490, "audio": 0}, {"filename": "/data/script/puzzle/dialogs_es.lua", "start": 1297490, "end": 1299300, "audio": 0}, {"filename": "/data/script/puzzle/dialogs_fr.lua", "start": 1299300, "end": 1301146, "audio": 0}, {"filename": "/data/script/puzzle/dialogs_it.lua", "start": 1301146, "end": 1302889, "audio": 0}, {"filename": "/data/script/puzzle/dialogs.lua", "start": 1302889, "end": 1302927, "audio": 0}, {"filename": "/data/script/puzzle/dialogs_nl.lua", "start": 1302927, "end": 1304720, "audio": 0}, {"filename": "/data/script/puzzle/dialogs_pl.lua", "start": 1304720, "end": 1306495, "audio": 0}, {"filename": "/data/script/puzzle/dialogs_ru.lua", "start": 1306495, "end": 1308715, "audio": 0}, {"filename": "/data/script/puzzle/dialogs_sv.lua", "start": 1308715, "end": 1310507, "audio": 0}, {"filename": "/data/script/puzzle/init.lua", "start": 1310507, "end": 1311152, "audio": 0}, {"filename": "/data/script/puzzle/models.lua", "start": 1311152, "end": 1319098, "audio": 0}, {"filename": "/data/sound/puzzle/cs/puc-m-hele.ogg", "start": 1319098, "end": 1335742, "audio": 1}, {"filename": "/data/sound/puzzle/cs/puc-m-koukej.ogg", "start": 1335742, "end": 1358205, "audio": 1}, {"filename": "/data/sound/puzzle/cs/puc-m-oblicej.ogg", "start": 1358205, "end": 1382279, "audio": 1}, {"filename": "/data/sound/puzzle/cs/puc-m-obraz.ogg", "start": 1382279, "end": 1416684, "audio": 1}, {"filename": "/data/sound/puzzle/cs/puc-m-pld0.ogg", "start": 1416684, "end": 1430450, "audio": 1}, {"filename": "/data/sound/puzzle/cs/puc-m-pld1.ogg", "start": 1430450, "end": 1454663, "audio": 1}, {"filename": "/data/sound/puzzle/cs/puc-m-slizka.ogg", "start": 1454663, "end": 1487905, "audio": 1}, {"filename": "/data/sound/puzzle/cs/puc-m-stalo.ogg", "start": 1487905, "end": 1503078, "audio": 1}, {"filename": "/data/sound/puzzle/cs/puc-v-fuska0.ogg", "start": 1503078, "end": 1517254, "audio": 1}, {"filename": "/data/sound/puzzle/cs/puc-v-fuska1.ogg", "start": 1517254, "end": 1534831, "audio": 1}, {"filename": "/data/sound/puzzle/cs/puc-v-fuska2.ogg", "start": 1534831, "end": 1548350, "audio": 1}, {"filename": "/data/sound/puzzle/cs/puc-v-nesmysl.ogg", "start": 1548350, "end": 1560972, "audio": 1}, {"filename": "/data/sound/puzzle/cs/puc-v-podivej.ogg", "start": 1560972, "end": 1579964, "audio": 1}, {"filename": "/data/sound/puzzle/cs/puc-v-videl.ogg", "start": 1579964, "end": 1596975, "audio": 1}, {"filename": "/data/sound/puzzle/en/puc-x-pldik.ogg", "start": 1596975, "end": 1616175, "audio": 1}, {"filename": "/data/sound/puzzle/nl/puc-m-hele.ogg", "start": 1616175, "end": 1632888, "audio": 1}, {"filename": "/data/sound/puzzle/nl/puc-m-koukej.ogg", "start": 1632888, "end": 1656757, "audio": 1}, {"filename": "/data/sound/puzzle/nl/puc-m-oblicej.ogg", "start": 1656757, "end": 1682557, "audio": 1}, {"filename": "/data/sound/puzzle/nl/puc-m-obraz.ogg", "start": 1682557, "end": 1717050, "audio": 1}, {"filename": "/data/sound/puzzle/nl/puc-m-pld0.ogg", "start": 1717050, "end": 1733122, "audio": 1}, {"filename": "/data/sound/puzzle/nl/puc-m-pld1.ogg", "start": 1733122, "end": 1753796, "audio": 1}, {"filename": "/data/sound/puzzle/nl/puc-m-slizka.ogg", "start": 1753796, "end": 1777942, "audio": 1}, {"filename": "/data/sound/puzzle/nl/puc-m-stalo.ogg", "start": 1777942, "end": 1798584, "audio": 1}, {"filename": "/data/sound/puzzle/nl/puc-v-fuska0.ogg", "start": 1798584, "end": 1816207, "audio": 1}, {"filename": "/data/sound/puzzle/nl/puc-v-fuska1.ogg", "start": 1816207, "end": 1835589, "audio": 1}, {"filename": "/data/sound/puzzle/nl/puc-v-fuska2.ogg", "start": 1835589, "end": 1854660, "audio": 1}, {"filename": "/data/sound/puzzle/nl/puc-v-nesmysl.ogg", "start": 1854660, "end": 1871818, "audio": 1}, {"filename": "/data/sound/puzzle/nl/puc-v-podivej.ogg", "start": 1871818, "end": 1897386, "audio": 1}, {"filename": "/data/sound/puzzle/nl/puc-v-videl.ogg", "start": 1897386, "end": 1919112, "audio": 1}], "remote_package_size": 1919112, "package_uuid": "67797637-9092-4f66-b06f-d37daacc4f4f"});

})();
