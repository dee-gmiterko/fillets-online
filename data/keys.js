
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
    var PACKAGE_NAME = 'web/data/keys.data';
    var REMOTE_PACKAGE_BASE = 'data/keys.data';
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
Module['FS_createPath']('/data/images', 'keys', true, true);
Module['FS_createPath']('/data', 'script', true, true);
Module['FS_createPath']('/data/script', 'keys', true, true);
Module['FS_createPath']('/data', 'sound', true, true);
Module['FS_createPath']('/data/sound', 'keys', true, true);
Module['FS_createPath']('/data/sound/keys', 'cs', true, true);
Module['FS_createPath']('/data/sound/keys', 'en', true, true);
Module['FS_createPath']('/data/sound/keys', 'nl', true, true);

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
              Module['removeRunDependency']('datafile_web/data/keys.data');

    };
    Module['addRunDependency']('datafile_web/data/keys.data');
  
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
 loadPackage({"files": [{"filename": "/data/images/keys/klic_00.png", "start": 0, "end": 726, "audio": 0}, {"filename": "/data/images/keys/klic_01.png", "start": 726, "end": 1552, "audio": 0}, {"filename": "/data/images/keys/klic_02.png", "start": 1552, "end": 2378, "audio": 0}, {"filename": "/data/images/keys/klic_03.png", "start": 2378, "end": 3105, "audio": 0}, {"filename": "/data/images/keys/klic_04.png", "start": 3105, "end": 3987, "audio": 0}, {"filename": "/data/images/keys/klic_05.png", "start": 3987, "end": 4867, "audio": 0}, {"filename": "/data/images/keys/mvalec.png", "start": 4867, "end": 5249, "audio": 0}, {"filename": "/data/images/keys/ocel1.png", "start": 5249, "end": 6830, "audio": 0}, {"filename": "/data/images/keys/ocel2.png", "start": 6830, "end": 8458, "audio": 0}, {"filename": "/data/images/keys/ocel3.png", "start": 8458, "end": 9915, "audio": 0}, {"filename": "/data/images/keys/ocel4.png", "start": 9915, "end": 11476, "audio": 0}, {"filename": "/data/images/keys/popredi.png", "start": 11476, "end": 77778, "audio": 0}, {"filename": "/data/images/keys/pozadi.png", "start": 77778, "end": 162911, "audio": 0}, {"filename": "/data/images/keys/szamek.png", "start": 162911, "end": 164136, "audio": 0}, {"filename": "/data/images/keys/vocel.png", "start": 164136, "end": 165810, "audio": 0}, {"filename": "/data/images/keys/vvalec.png", "start": 165810, "end": 166202, "audio": 0}, {"filename": "/data/images/keys/vzamek.png", "start": 166202, "end": 167380, "audio": 0}, {"filename": "/data/script/keys/code.lua", "start": 167380, "end": 171876, "audio": 0}, {"filename": "/data/script/keys/dialogs_bg.lua", "start": 171876, "end": 178295, "audio": 0}, {"filename": "/data/script/keys/dialogs_cs.lua", "start": 178295, "end": 183772, "audio": 0}, {"filename": "/data/script/keys/dialogs_de.lua", "start": 183772, "end": 189536, "audio": 0}, {"filename": "/data/script/keys/dialogs_en.lua", "start": 189536, "end": 193024, "audio": 0}, {"filename": "/data/script/keys/dialogs.lua", "start": 193024, "end": 193062, "audio": 0}, {"filename": "/data/script/keys/dialogs_nl.lua", "start": 193062, "end": 198717, "audio": 0}, {"filename": "/data/script/keys/dialogs_sv.lua", "start": 198717, "end": 204112, "audio": 0}, {"filename": "/data/script/keys/init.lua", "start": 204112, "end": 204755, "audio": 0}, {"filename": "/data/script/keys/models.lua", "start": 204755, "end": 207093, "audio": 0}, {"filename": "/data/sound/keys/cs/init-0-0.ogg", "start": 207093, "end": 227570, "audio": 1}, {"filename": "/data/sound/keys/cs/init-0-1.ogg", "start": 227570, "end": 244911, "audio": 1}, {"filename": "/data/sound/keys/cs/init-0-2.ogg", "start": 244911, "end": 268766, "audio": 1}, {"filename": "/data/sound/keys/cs/init-0-3.ogg", "start": 268766, "end": 318788, "audio": 1}, {"filename": "/data/sound/keys/cs/init-0-4.ogg", "start": 318788, "end": 339900, "audio": 1}, {"filename": "/data/sound/keys/cs/init-0-5.ogg", "start": 339900, "end": 372328, "audio": 1}, {"filename": "/data/sound/keys/cs/init-0-6.ogg", "start": 372328, "end": 401782, "audio": 1}, {"filename": "/data/sound/keys/cs/init-0-7.ogg", "start": 401782, "end": 414458, "audio": 1}, {"filename": "/data/sound/keys/cs/rand-0-0.ogg", "start": 414458, "end": 453895, "audio": 1}, {"filename": "/data/sound/keys/cs/rand-0-1.ogg", "start": 453895, "end": 477800, "audio": 1}, {"filename": "/data/sound/keys/cs/rand-0-2.ogg", "start": 477800, "end": 488602, "audio": 1}, {"filename": "/data/sound/keys/cs/rand-0-3.ogg", "start": 488602, "end": 534219, "audio": 1}, {"filename": "/data/sound/keys/cs/rand-0-4.ogg", "start": 534219, "end": 552560, "audio": 1}, {"filename": "/data/sound/keys/cs/rand-0-5-0.ogg", "start": 552560, "end": 569456, "audio": 1}, {"filename": "/data/sound/keys/cs/rand-0-5-1.ogg", "start": 569456, "end": 581360, "audio": 1}, {"filename": "/data/sound/keys/cs/rand-0-5-2.ogg", "start": 581360, "end": 590742, "audio": 1}, {"filename": "/data/sound/keys/cs/rand-0-5-3.ogg", "start": 590742, "end": 602491, "audio": 1}, {"filename": "/data/sound/keys/cs/rand-0-5-4.ogg", "start": 602491, "end": 625649, "audio": 1}, {"filename": "/data/sound/keys/cs/rand-0-5-5.ogg", "start": 625649, "end": 664541, "audio": 1}, {"filename": "/data/sound/keys/cs/rand-0-6.ogg", "start": 664541, "end": 675594, "audio": 1}, {"filename": "/data/sound/keys/cs/rand-0-7.ogg", "start": 675594, "end": 690086, "audio": 1}, {"filename": "/data/sound/keys/cs/rand-1-0.ogg", "start": 690086, "end": 729823, "audio": 1}, {"filename": "/data/sound/keys/cs/rand-1-1.ogg", "start": 729823, "end": 763959, "audio": 1}, {"filename": "/data/sound/keys/cs/rand-2-0.ogg", "start": 763959, "end": 804459, "audio": 1}, {"filename": "/data/sound/keys/cs/rand-3-0.ogg", "start": 804459, "end": 842010, "audio": 1}, {"filename": "/data/sound/keys/cs/rand-3-1.ogg", "start": 842010, "end": 881319, "audio": 1}, {"filename": "/data/sound/keys/cs/rand-3-2.ogg", "start": 881319, "end": 917116, "audio": 1}, {"filename": "/data/sound/keys/cs/rand-3-3-0.ogg", "start": 917116, "end": 935760, "audio": 1}, {"filename": "/data/sound/keys/cs/rand-3-3-1.ogg", "start": 935760, "end": 955653, "audio": 1}, {"filename": "/data/sound/keys/cs/rand-3-4-0.ogg", "start": 955653, "end": 966594, "audio": 1}, {"filename": "/data/sound/keys/cs/rand-3-4-1.ogg", "start": 966594, "end": 989410, "audio": 1}, {"filename": "/data/sound/keys/cs/rand-4-0.ogg", "start": 989410, "end": 1041956, "audio": 1}, {"filename": "/data/sound/keys/cs/rand-4-1.ogg", "start": 1041956, "end": 1058306, "audio": 1}, {"filename": "/data/sound/keys/cs/rand-4-2.ogg", "start": 1058306, "end": 1072698, "audio": 1}, {"filename": "/data/sound/keys/cs/rand-4-3.ogg", "start": 1072698, "end": 1089466, "audio": 1}, {"filename": "/data/sound/keys/cs/rand-4-4-0.ogg", "start": 1089466, "end": 1126631, "audio": 1}, {"filename": "/data/sound/keys/cs/rand-4-4-1.ogg", "start": 1126631, "end": 1167887, "audio": 1}, {"filename": "/data/sound/keys/cs/rand-4-4-2.ogg", "start": 1167887, "end": 1222013, "audio": 1}, {"filename": "/data/sound/keys/cs/rand-4-5.ogg", "start": 1222013, "end": 1248252, "audio": 1}, {"filename": "/data/sound/keys/cs/rand-4-6.ogg", "start": 1248252, "end": 1264521, "audio": 1}, {"filename": "/data/sound/keys/cs/rand-5-0.ogg", "start": 1264521, "end": 1318025, "audio": 1}, {"filename": "/data/sound/keys/cs/rand-5-1.ogg", "start": 1318025, "end": 1336184, "audio": 1}, {"filename": "/data/sound/keys/cs/rand-6-0.ogg", "start": 1336184, "end": 1372869, "audio": 1}, {"filename": "/data/sound/keys/cs/rand-6-1.ogg", "start": 1372869, "end": 1386094, "audio": 1}, {"filename": "/data/sound/keys/cs/rand-7-0.ogg", "start": 1386094, "end": 1410596, "audio": 1}, {"filename": "/data/sound/keys/cs/rand-7-1.ogg", "start": 1410596, "end": 1421751, "audio": 1}, {"filename": "/data/sound/keys/en/unlocking-0.ogg", "start": 1421751, "end": 1434614, "audio": 1}, {"filename": "/data/sound/keys/en/unlocking-1.ogg", "start": 1434614, "end": 1448242, "audio": 1}, {"filename": "/data/sound/keys/en/unlocking-2.ogg", "start": 1448242, "end": 1461993, "audio": 1}, {"filename": "/data/sound/keys/en/unlocking-3.ogg", "start": 1461993, "end": 1478728, "audio": 1}, {"filename": "/data/sound/keys/nl/init-0-0.ogg", "start": 1478728, "end": 1497826, "audio": 1}, {"filename": "/data/sound/keys/nl/init-0-1.ogg", "start": 1497826, "end": 1516892, "audio": 1}, {"filename": "/data/sound/keys/nl/init-0-2.ogg", "start": 1516892, "end": 1541656, "audio": 1}, {"filename": "/data/sound/keys/nl/init-0-3.ogg", "start": 1541656, "end": 1573496, "audio": 1}, {"filename": "/data/sound/keys/nl/init-0-4.ogg", "start": 1573496, "end": 1591794, "audio": 1}, {"filename": "/data/sound/keys/nl/init-0-5.ogg", "start": 1591794, "end": 1613782, "audio": 1}, {"filename": "/data/sound/keys/nl/init-0-6.ogg", "start": 1613782, "end": 1638247, "audio": 1}, {"filename": "/data/sound/keys/nl/init-0-7.ogg", "start": 1638247, "end": 1653305, "audio": 1}, {"filename": "/data/sound/keys/nl/rand-0-0.ogg", "start": 1653305, "end": 1684558, "audio": 1}, {"filename": "/data/sound/keys/nl/rand-0-1.ogg", "start": 1684558, "end": 1703291, "audio": 1}, {"filename": "/data/sound/keys/nl/rand-0-2.ogg", "start": 1703291, "end": 1718696, "audio": 1}, {"filename": "/data/sound/keys/nl/rand-0-3.ogg", "start": 1718696, "end": 1743243, "audio": 1}, {"filename": "/data/sound/keys/nl/rand-0-4.ogg", "start": 1743243, "end": 1763058, "audio": 1}, {"filename": "/data/sound/keys/nl/rand-0-5-0.ogg", "start": 1763058, "end": 1780524, "audio": 1}, {"filename": "/data/sound/keys/nl/rand-0-5-1.ogg", "start": 1780524, "end": 1795829, "audio": 1}, {"filename": "/data/sound/keys/nl/rand-0-5-2.ogg", "start": 1795829, "end": 1811054, "audio": 1}, {"filename": "/data/sound/keys/nl/rand-0-5-3.ogg", "start": 1811054, "end": 1826947, "audio": 1}, {"filename": "/data/sound/keys/nl/rand-0-5-4.ogg", "start": 1826947, "end": 1848255, "audio": 1}, {"filename": "/data/sound/keys/nl/rand-0-5-5.ogg", "start": 1848255, "end": 1873521, "audio": 1}, {"filename": "/data/sound/keys/nl/rand-0-6.ogg", "start": 1873521, "end": 1888467, "audio": 1}, {"filename": "/data/sound/keys/nl/rand-0-7.ogg", "start": 1888467, "end": 1903627, "audio": 1}, {"filename": "/data/sound/keys/nl/rand-1-0.ogg", "start": 1903627, "end": 1927888, "audio": 1}, {"filename": "/data/sound/keys/nl/rand-1-1.ogg", "start": 1927888, "end": 1954163, "audio": 1}, {"filename": "/data/sound/keys/nl/rand-2-0.ogg", "start": 1954163, "end": 1976849, "audio": 1}, {"filename": "/data/sound/keys/nl/rand-3-0.ogg", "start": 1976849, "end": 2008723, "audio": 1}, {"filename": "/data/sound/keys/nl/rand-3-1.ogg", "start": 2008723, "end": 2037394, "audio": 1}, {"filename": "/data/sound/keys/nl/rand-3-2.ogg", "start": 2037394, "end": 2066261, "audio": 1}, {"filename": "/data/sound/keys/nl/rand-3-3-0.ogg", "start": 2066261, "end": 2085776, "audio": 1}, {"filename": "/data/sound/keys/nl/rand-3-3-1.ogg", "start": 2085776, "end": 2104133, "audio": 1}, {"filename": "/data/sound/keys/nl/rand-3-4-0.ogg", "start": 2104133, "end": 2119674, "audio": 1}, {"filename": "/data/sound/keys/nl/rand-3-4-1.ogg", "start": 2119674, "end": 2142344, "audio": 1}, {"filename": "/data/sound/keys/nl/rand-4-0.ogg", "start": 2142344, "end": 2172906, "audio": 1}, {"filename": "/data/sound/keys/nl/rand-4-1.ogg", "start": 2172906, "end": 2189890, "audio": 1}, {"filename": "/data/sound/keys/nl/rand-4-2.ogg", "start": 2189890, "end": 2206568, "audio": 1}, {"filename": "/data/sound/keys/nl/rand-4-3.ogg", "start": 2206568, "end": 2221875, "audio": 1}, {"filename": "/data/sound/keys/nl/rand-4-4-0.ogg", "start": 2221875, "end": 2251623, "audio": 1}, {"filename": "/data/sound/keys/nl/rand-4-4-1.ogg", "start": 2251623, "end": 2284400, "audio": 1}, {"filename": "/data/sound/keys/nl/rand-4-4-2.ogg", "start": 2284400, "end": 2317595, "audio": 1}, {"filename": "/data/sound/keys/nl/rand-4-5.ogg", "start": 2317595, "end": 2340623, "audio": 1}, {"filename": "/data/sound/keys/nl/rand-4-6.ogg", "start": 2340623, "end": 2355178, "audio": 1}, {"filename": "/data/sound/keys/nl/rand-5-0.ogg", "start": 2355178, "end": 2382691, "audio": 1}, {"filename": "/data/sound/keys/nl/rand-5-1.ogg", "start": 2382691, "end": 2404440, "audio": 1}, {"filename": "/data/sound/keys/nl/rand-6-0.ogg", "start": 2404440, "end": 2429181, "audio": 1}, {"filename": "/data/sound/keys/nl/rand-6-1.ogg", "start": 2429181, "end": 2445906, "audio": 1}, {"filename": "/data/sound/keys/nl/rand-7-0.ogg", "start": 2445906, "end": 2466169, "audio": 1}, {"filename": "/data/sound/keys/nl/rand-7-1.ogg", "start": 2466169, "end": 2480412, "audio": 1}], "remote_package_size": 2480412, "package_uuid": "1be65597-85ff-4fc3-a024-b7a13e0749b0"});

})();
