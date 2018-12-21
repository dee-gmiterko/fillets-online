
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
    var PACKAGE_NAME = 'web/data/elevator1.data';
    var REMOTE_PACKAGE_BASE = 'data/elevator1.data';
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
Module['FS_createPath']('/data/images', 'elevator1', true, true);
Module['FS_createPath']('/data', 'script', true, true);
Module['FS_createPath']('/data/script', 'elevator1', true, true);
Module['FS_createPath']('/data', 'sound', true, true);
Module['FS_createPath']('/data/sound', 'elevator1', true, true);
Module['FS_createPath']('/data/sound/elevator1', 'cs', true, true);
Module['FS_createPath']('/data/sound/elevator1', 'nl', true, true);

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
              Module['removeRunDependency']('datafile_web/data/elevator1.data');

    };
    Module['addRunDependency']('datafile_web/data/elevator1.data');
  
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
 loadPackage({"files": [{"filename": "/data/images/elevator1/amfora_zelena.png", "start": 0, "end": 926, "audio": 0}, {"filename": "/data/images/elevator1/hlava_m-_00.png", "start": 926, "end": 1642, "audio": 0}, {"filename": "/data/images/elevator1/hlava_m-_01.png", "start": 1642, "end": 2367, "audio": 0}, {"filename": "/data/images/elevator1/hlava_m-_02.png", "start": 2367, "end": 3103, "audio": 0}, {"filename": "/data/images/elevator1/kriz_00.png", "start": 3103, "end": 6219, "audio": 0}, {"filename": "/data/images/elevator1/kriz_01.png", "start": 6219, "end": 9517, "audio": 0}, {"filename": "/data/images/elevator1/kriz_02.png", "start": 9517, "end": 12721, "audio": 0}, {"filename": "/data/images/elevator1/lebzna.png", "start": 12721, "end": 14518, "audio": 0}, {"filename": "/data/images/elevator1/shell1.png", "start": 14518, "end": 15249, "audio": 0}, {"filename": "/data/images/elevator1/stroj_00.png", "start": 15249, "end": 20366, "audio": 0}, {"filename": "/data/images/elevator1/stroj_01.png", "start": 20366, "end": 24751, "audio": 0}, {"filename": "/data/images/elevator1/stroj_02.png", "start": 24751, "end": 29845, "audio": 0}, {"filename": "/data/images/elevator1/stroj_03.png", "start": 29845, "end": 34952, "audio": 0}, {"filename": "/data/images/elevator1/stroj_04.png", "start": 34952, "end": 39426, "audio": 0}, {"filename": "/data/images/elevator1/stroj_05.png", "start": 39426, "end": 44534, "audio": 0}, {"filename": "/data/images/elevator1/zdviz1-p.png", "start": 44534, "end": 303316, "audio": 0}, {"filename": "/data/images/elevator1/zdviz-1-tmp.png", "start": 303316, "end": 306942, "audio": 0}, {"filename": "/data/images/elevator1/zdviz1-w.png", "start": 306942, "end": 450751, "audio": 0}, {"filename": "/data/script/elevator1/code.lua", "start": 450751, "end": 458763, "audio": 0}, {"filename": "/data/script/elevator1/dialogs_bg.lua", "start": 458763, "end": 462051, "audio": 0}, {"filename": "/data/script/elevator1/dialogs_cs.lua", "start": 462051, "end": 464794, "audio": 0}, {"filename": "/data/script/elevator1/dialogs_de_CH.lua", "start": 464794, "end": 464952, "audio": 0}, {"filename": "/data/script/elevator1/dialogs_de.lua", "start": 464952, "end": 467768, "audio": 0}, {"filename": "/data/script/elevator1/dialogs_en.lua", "start": 467768, "end": 469381, "audio": 0}, {"filename": "/data/script/elevator1/dialogs_es.lua", "start": 469381, "end": 472178, "audio": 0}, {"filename": "/data/script/elevator1/dialogs_fr.lua", "start": 472178, "end": 475034, "audio": 0}, {"filename": "/data/script/elevator1/dialogs_it.lua", "start": 475034, "end": 477753, "audio": 0}, {"filename": "/data/script/elevator1/dialogs.lua", "start": 477753, "end": 477791, "audio": 0}, {"filename": "/data/script/elevator1/dialogs_nl.lua", "start": 477791, "end": 480488, "audio": 0}, {"filename": "/data/script/elevator1/dialogs_pl.lua", "start": 480488, "end": 483207, "audio": 0}, {"filename": "/data/script/elevator1/dialogs_ru.lua", "start": 483207, "end": 486370, "audio": 0}, {"filename": "/data/script/elevator1/dialogs_sl.lua", "start": 486370, "end": 489054, "audio": 0}, {"filename": "/data/script/elevator1/dialogs_sv.lua", "start": 489054, "end": 491751, "audio": 0}, {"filename": "/data/script/elevator1/init.lua", "start": 491751, "end": 492399, "audio": 0}, {"filename": "/data/script/elevator1/models.lua", "start": 492399, "end": 495009, "audio": 0}, {"filename": "/data/sound/elevator1/cs/zd1-m-cesta.ogg", "start": 495009, "end": 508309, "audio": 1}, {"filename": "/data/sound/elevator1/cs/zd1-m-dolu.ogg", "start": 508309, "end": 521490, "audio": 1}, {"filename": "/data/sound/elevator1/cs/zd1-m-last.ogg", "start": 521490, "end": 535230, "audio": 1}, {"filename": "/data/sound/elevator1/cs/zd1-m-poved.ogg", "start": 535230, "end": 553234, "audio": 1}, {"filename": "/data/sound/elevator1/cs/zd1-m-slap.ogg", "start": 553234, "end": 578692, "audio": 1}, {"filename": "/data/sound/elevator1/cs/zd1-m-stejne.ogg", "start": 578692, "end": 611114, "audio": 1}, {"filename": "/data/sound/elevator1/cs/zd1-m-tlac.ogg", "start": 611114, "end": 626019, "audio": 1}, {"filename": "/data/sound/elevator1/cs/zd1-v-civil.ogg", "start": 626019, "end": 665133, "audio": 1}, {"filename": "/data/sound/elevator1/cs/zd1-v-krecek.ogg", "start": 665133, "end": 688584, "audio": 1}, {"filename": "/data/sound/elevator1/cs/zd1-v-lebka.ogg", "start": 688584, "end": 706575, "audio": 1}, {"filename": "/data/sound/elevator1/cs/zd1-v-styd.ogg", "start": 706575, "end": 733217, "audio": 1}, {"filename": "/data/sound/elevator1/cs/zd1-v-talis.ogg", "start": 733217, "end": 768647, "audio": 1}, {"filename": "/data/sound/elevator1/cs/zd1-x-huhu1.ogg", "start": 768647, "end": 798022, "audio": 1}, {"filename": "/data/sound/elevator1/cs/zd1-x-huhu2.ogg", "start": 798022, "end": 834168, "audio": 1}, {"filename": "/data/sound/elevator1/cs/zd1-x-huhu3.ogg", "start": 834168, "end": 865552, "audio": 1}, {"filename": "/data/sound/elevator1/cs/zd1-x-huhu4.ogg", "start": 865552, "end": 893286, "audio": 1}, {"filename": "/data/sound/elevator1/cs/zd1-x-huhu5.ogg", "start": 893286, "end": 924973, "audio": 1}, {"filename": "/data/sound/elevator1/cs/zd1-x-huhu6.ogg", "start": 924973, "end": 957113, "audio": 1}, {"filename": "/data/sound/elevator1/nl/zd1-m-cesta.ogg", "start": 957113, "end": 960812, "audio": 1}, {"filename": "/data/sound/elevator1/nl/zd1-m-dolu.ogg", "start": 960812, "end": 977349, "audio": 1}, {"filename": "/data/sound/elevator1/nl/zd1-m-last.ogg", "start": 977349, "end": 995204, "audio": 1}, {"filename": "/data/sound/elevator1/nl/zd1-m-poved.ogg", "start": 995204, "end": 1013527, "audio": 1}, {"filename": "/data/sound/elevator1/nl/zd1-m-slap.ogg", "start": 1013527, "end": 1041935, "audio": 1}, {"filename": "/data/sound/elevator1/nl/zd1-m-stejne.ogg", "start": 1041935, "end": 1076874, "audio": 1}, {"filename": "/data/sound/elevator1/nl/zd1-m-tlac.ogg", "start": 1076874, "end": 1094558, "audio": 1}, {"filename": "/data/sound/elevator1/nl/zd1-v-civil.ogg", "start": 1094558, "end": 1132147, "audio": 1}, {"filename": "/data/sound/elevator1/nl/zd1-v-krecek.ogg", "start": 1132147, "end": 1156219, "audio": 1}, {"filename": "/data/sound/elevator1/nl/zd1-v-lebka.ogg", "start": 1156219, "end": 1175587, "audio": 1}, {"filename": "/data/sound/elevator1/nl/zd1-v-styd.ogg", "start": 1175587, "end": 1203082, "audio": 1}, {"filename": "/data/sound/elevator1/nl/zd1-v-talis.ogg", "start": 1203082, "end": 1242538, "audio": 1}], "remote_package_size": 1242538, "package_uuid": "a89a565c-ecd9-4a60-8c22-b1eeddd7bc21"});

})();
