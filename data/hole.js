
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
    var PACKAGE_NAME = 'web/data/hole.data';
    var REMOTE_PACKAGE_BASE = 'data/hole.data';
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
Module['FS_createPath']('/data/images', 'hole', true, true);
Module['FS_createPath']('/data', 'script', true, true);
Module['FS_createPath']('/data/script', 'hole', true, true);
Module['FS_createPath']('/data', 'sound', true, true);
Module['FS_createPath']('/data/sound', 'hole', true, true);
Module['FS_createPath']('/data/sound/hole', 'cs', true, true);
Module['FS_createPath']('/data/sound/hole', 'nl', true, true);

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
              Module['removeRunDependency']('datafile_web/data/hole.data');

    };
    Module['addRunDependency']('datafile_web/data/hole.data');
  
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
 loadPackage({"files": [{"filename": "/data/images/hole/barva_00.png", "start": 0, "end": 192, "audio": 0}, {"filename": "/data/images/hole/barva_01.png", "start": 192, "end": 380, "audio": 0}, {"filename": "/data/images/hole/barva_02.png", "start": 380, "end": 568, "audio": 0}, {"filename": "/data/images/hole/barva_03.png", "start": 568, "end": 756, "audio": 0}, {"filename": "/data/images/hole/barva_04.png", "start": 756, "end": 944, "audio": 0}, {"filename": "/data/images/hole/barva_05.png", "start": 944, "end": 1132, "audio": 0}, {"filename": "/data/images/hole/kreveta.png", "start": 1132, "end": 3669, "audio": 0}, {"filename": "/data/images/hole/kriz.png", "start": 3669, "end": 6900, "audio": 0}, {"filename": "/data/images/hole/lebka_00.png", "start": 6900, "end": 7972, "audio": 0}, {"filename": "/data/images/hole/lebka_01.png", "start": 7972, "end": 9061, "audio": 0}, {"filename": "/data/images/hole/lebka_02.png", "start": 9061, "end": 10116, "audio": 0}, {"filename": "/data/images/hole/lebka_03.png", "start": 10116, "end": 11216, "audio": 0}, {"filename": "/data/images/hole/lebka_04.png", "start": 11216, "end": 12631, "audio": 0}, {"filename": "/data/images/hole/lebka_05.png", "start": 12631, "end": 14069, "audio": 0}, {"filename": "/data/images/hole/nindpar.png", "start": 14069, "end": 15155, "audio": 0}, {"filename": "/data/images/hole/ocel_00.png", "start": 15155, "end": 17010, "audio": 0}, {"filename": "/data/images/hole/ocel_01.png", "start": 17010, "end": 18850, "audio": 0}, {"filename": "/data/images/hole/ocel_02.png", "start": 18850, "end": 20686, "audio": 0}, {"filename": "/data/images/hole/ocel_03.png", "start": 20686, "end": 22518, "audio": 0}, {"filename": "/data/images/hole/ocel_04.png", "start": 22518, "end": 24349, "audio": 0}, {"filename": "/data/images/hole/ocel_05.png", "start": 24349, "end": 26182, "audio": 0}, {"filename": "/data/images/hole/ocel_06.png", "start": 26182, "end": 28015, "audio": 0}, {"filename": "/data/images/hole/ocel_07.png", "start": 28015, "end": 29848, "audio": 0}, {"filename": "/data/images/hole/ocel_08.png", "start": 29848, "end": 31680, "audio": 0}, {"filename": "/data/images/hole/ocel_09.png", "start": 31680, "end": 33514, "audio": 0}, {"filename": "/data/images/hole/ocel_10.png", "start": 33514, "end": 33608, "audio": 0}, {"filename": "/data/images/hole/popredi.png", "start": 33608, "end": 137700, "audio": 0}, {"filename": "/data/images/hole/pozadi.png", "start": 137700, "end": 422589, "audio": 0}, {"filename": "/data/images/hole/shrimp_00.png", "start": 422589, "end": 425027, "audio": 0}, {"filename": "/data/images/hole/shrimp_01.png", "start": 425027, "end": 427466, "audio": 0}, {"filename": "/data/images/hole/shrimp_02.png", "start": 427466, "end": 429917, "audio": 0}, {"filename": "/data/images/hole/shrimp_03.png", "start": 429917, "end": 432356, "audio": 0}, {"filename": "/data/images/hole/shrimp_04.png", "start": 432356, "end": 434793, "audio": 0}, {"filename": "/data/images/hole/zsluch_00.png", "start": 434793, "end": 438416, "audio": 0}, {"filename": "/data/images/hole/zsluch_01.png", "start": 438416, "end": 442064, "audio": 0}, {"filename": "/data/images/hole/zsluch_02.png", "start": 442064, "end": 445738, "audio": 0}, {"filename": "/data/images/hole/zsluch_03.png", "start": 445738, "end": 449418, "audio": 0}, {"filename": "/data/images/hole/zsluch_04.png", "start": 449418, "end": 453101, "audio": 0}, {"filename": "/data/images/hole/zsluch_05.png", "start": 453101, "end": 456764, "audio": 0}, {"filename": "/data/script/hole/code.lua", "start": 456764, "end": 461723, "audio": 0}, {"filename": "/data/script/hole/dialogs_bg.lua", "start": 461723, "end": 464944, "audio": 0}, {"filename": "/data/script/hole/dialogs_cs.lua", "start": 464944, "end": 467602, "audio": 0}, {"filename": "/data/script/hole/dialogs_de.lua", "start": 467602, "end": 470321, "audio": 0}, {"filename": "/data/script/hole/dialogs_en.lua", "start": 470321, "end": 471899, "audio": 0}, {"filename": "/data/script/hole/dialogs.lua", "start": 471899, "end": 471937, "audio": 0}, {"filename": "/data/script/hole/dialogs_nl.lua", "start": 471937, "end": 474641, "audio": 0}, {"filename": "/data/script/hole/dialogs_ru.lua", "start": 474641, "end": 477813, "audio": 0}, {"filename": "/data/script/hole/dialogs_sv.lua", "start": 477813, "end": 480488, "audio": 0}, {"filename": "/data/script/hole/init.lua", "start": 480488, "end": 481131, "audio": 0}, {"filename": "/data/script/hole/models.lua", "start": 481131, "end": 484513, "audio": 0}, {"filename": "/data/sound/hole/cs/l-dejte0.ogg", "start": 484513, "end": 527725, "audio": 1}, {"filename": "/data/sound/hole/cs/l-dejte1.ogg", "start": 527725, "end": 561615, "audio": 1}, {"filename": "/data/sound/hole/cs/l-dejte2.ogg", "start": 561615, "end": 625336, "audio": 1}, {"filename": "/data/sound/hole/cs/l-dejte3.ogg", "start": 625336, "end": 668198, "audio": 1}, {"filename": "/data/sound/hole/cs/l-halo0.ogg", "start": 668198, "end": 692598, "audio": 1}, {"filename": "/data/sound/hole/cs/l-halo1.ogg", "start": 692598, "end": 710848, "audio": 1}, {"filename": "/data/sound/hole/cs/l-halo2.ogg", "start": 710848, "end": 757395, "audio": 1}, {"filename": "/data/sound/hole/cs/l-vinnetou.ogg", "start": 757395, "end": 808814, "audio": 1}, {"filename": "/data/sound/hole/cs/m-nedame0.ogg", "start": 808814, "end": 853844, "audio": 1}, {"filename": "/data/sound/hole/cs/m-nedame1.ogg", "start": 853844, "end": 898174, "audio": 1}, {"filename": "/data/sound/hole/cs/m-sluchatko.ogg", "start": 898174, "end": 950463, "audio": 1}, {"filename": "/data/sound/hole/cs/m-strasidelna.ogg", "start": 950463, "end": 988259, "audio": 1}, {"filename": "/data/sound/hole/cs/m-zmizet.ogg", "start": 988259, "end": 1048051, "audio": 1}, {"filename": "/data/sound/hole/cs/s-prejete.ogg", "start": 1048051, "end": 1088274, "audio": 1}, {"filename": "/data/sound/hole/cs/v-bojim.ogg", "start": 1088274, "end": 1194442, "audio": 1}, {"filename": "/data/sound/hole/cs/v-neber.ogg", "start": 1194442, "end": 1304103, "audio": 1}, {"filename": "/data/sound/hole/cs/v-nedame0.ogg", "start": 1304103, "end": 1365040, "audio": 1}, {"filename": "/data/sound/hole/cs/v-nedame1.ogg", "start": 1365040, "end": 1416221, "audio": 1}, {"filename": "/data/sound/hole/cs/v-vratte.ogg", "start": 1416221, "end": 1500189, "audio": 1}, {"filename": "/data/sound/hole/cs/v-zkus.ogg", "start": 1500189, "end": 1528483, "audio": 1}, {"filename": "/data/sound/hole/nl/m-nedame0.ogg", "start": 1528483, "end": 1549411, "audio": 1}, {"filename": "/data/sound/hole/nl/m-nedame1.ogg", "start": 1549411, "end": 1573696, "audio": 1}, {"filename": "/data/sound/hole/nl/m-sluchatko.ogg", "start": 1573696, "end": 1594492, "audio": 1}, {"filename": "/data/sound/hole/nl/m-strasidelna.ogg", "start": 1594492, "end": 1612160, "audio": 1}, {"filename": "/data/sound/hole/nl/m-zmizet.ogg", "start": 1612160, "end": 1636357, "audio": 1}, {"filename": "/data/sound/hole/nl/v-bojim.ogg", "start": 1636357, "end": 1666308, "audio": 1}, {"filename": "/data/sound/hole/nl/v-neber.ogg", "start": 1666308, "end": 1705994, "audio": 1}, {"filename": "/data/sound/hole/nl/v-nedame0.ogg", "start": 1705994, "end": 1730178, "audio": 1}, {"filename": "/data/sound/hole/nl/v-nedame1.ogg", "start": 1730178, "end": 1748568, "audio": 1}, {"filename": "/data/sound/hole/nl/v-vratte.ogg", "start": 1748568, "end": 1779335, "audio": 1}, {"filename": "/data/sound/hole/nl/v-zkus.ogg", "start": 1779335, "end": 1795588, "audio": 1}], "remote_package_size": 1795588, "package_uuid": "2f91fce5-9dc7-4266-9e36-8498dff8deb5"});

})();
