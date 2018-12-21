
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
    var PACKAGE_NAME = 'web/data/snowman.data';
    var REMOTE_PACKAGE_BASE = 'data/snowman.data';
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
Module['FS_createPath']('/data/images', 'snowman', true, true);
Module['FS_createPath']('/data', 'script', true, true);
Module['FS_createPath']('/data/script', 'snowman', true, true);
Module['FS_createPath']('/data', 'sound', true, true);
Module['FS_createPath']('/data/sound', 'snowman', true, true);
Module['FS_createPath']('/data/sound/snowman', 'cs', true, true);
Module['FS_createPath']('/data/sound/snowman', 'en', true, true);
Module['FS_createPath']('/data/sound/snowman', 'nl', true, true);

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
              Module['removeRunDependency']('datafile_web/data/snowman.data');

    };
    Module['addRunDependency']('datafile_web/data/snowman.data');
  
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
 loadPackage({"files": [{"filename": "/data/images/snowman/posun-1-tmp.png", "start": 0, "end": 994, "audio": 0}, {"filename": "/data/images/snowman/snehulak_00.png", "start": 994, "end": 2641, "audio": 0}, {"filename": "/data/images/snowman/snehulak_01.png", "start": 2641, "end": 4120, "audio": 0}, {"filename": "/data/images/snowman/snehulak_02.png", "start": 4120, "end": 5740, "audio": 0}, {"filename": "/data/images/snowman/stolekm.png", "start": 5740, "end": 7720, "audio": 0}, {"filename": "/data/images/snowman/stolekv.png", "start": 7720, "end": 10156, "audio": 0}, {"filename": "/data/images/snowman/trup-hotovo.png", "start": 10156, "end": 143139, "audio": 0}, {"filename": "/data/images/snowman/trup-p1.png", "start": 143139, "end": 372675, "audio": 0}, {"filename": "/data/script/snowman/code.lua", "start": 372675, "end": 377222, "audio": 0}, {"filename": "/data/script/snowman/dialogs_bg.lua", "start": 377222, "end": 378691, "audio": 0}, {"filename": "/data/script/snowman/dialogs_cs.lua", "start": 378691, "end": 379862, "audio": 0}, {"filename": "/data/script/snowman/dialogs_de.lua", "start": 379862, "end": 381065, "audio": 0}, {"filename": "/data/script/snowman/dialogs_en.lua", "start": 381065, "end": 381827, "audio": 0}, {"filename": "/data/script/snowman/dialogs_es.lua", "start": 381827, "end": 383040, "audio": 0}, {"filename": "/data/script/snowman/dialogs_fr.lua", "start": 383040, "end": 384244, "audio": 0}, {"filename": "/data/script/snowman/dialogs_it.lua", "start": 384244, "end": 385441, "audio": 0}, {"filename": "/data/script/snowman/dialogs.lua", "start": 385441, "end": 385479, "audio": 0}, {"filename": "/data/script/snowman/dialogs_nl.lua", "start": 385479, "end": 386691, "audio": 0}, {"filename": "/data/script/snowman/dialogs_pl.lua", "start": 386691, "end": 387858, "audio": 0}, {"filename": "/data/script/snowman/dialogs_ru.lua", "start": 387858, "end": 389335, "audio": 0}, {"filename": "/data/script/snowman/dialogs_sv.lua", "start": 389335, "end": 390514, "audio": 0}, {"filename": "/data/script/snowman/init.lua", "start": 390514, "end": 391160, "audio": 0}, {"filename": "/data/script/snowman/models.lua", "start": 391160, "end": 392757, "audio": 0}, {"filename": "/data/sound/snowman/cs/tr-m-au1.ogg", "start": 392757, "end": 404904, "audio": 1}, {"filename": "/data/sound/snowman/cs/tr-m-au2.ogg", "start": 404904, "end": 417044, "audio": 1}, {"filename": "/data/sound/snowman/cs/tr-m-chlad1.ogg", "start": 417044, "end": 430631, "audio": 1}, {"filename": "/data/sound/snowman/cs/tr-m-chlad2.ogg", "start": 430631, "end": 442934, "audio": 1}, {"filename": "/data/sound/snowman/cs/tr-m-cvicit.ogg", "start": 442934, "end": 463836, "audio": 1}, {"filename": "/data/sound/snowman/cs/tr-m-ztuhl.ogg", "start": 463836, "end": 480430, "audio": 1}, {"filename": "/data/sound/snowman/cs/tr-v-agres.ogg", "start": 480430, "end": 504622, "audio": 1}, {"filename": "/data/sound/snowman/cs/tr-v-jid1.ogg", "start": 504622, "end": 525726, "audio": 1}, {"filename": "/data/sound/snowman/cs/tr-v-jid2.ogg", "start": 525726, "end": 546357, "audio": 1}, {"filename": "/data/sound/snowman/cs/tr-v-prezil.ogg", "start": 546357, "end": 565098, "audio": 1}, {"filename": "/data/sound/snowman/en/tr-x-koste.ogg", "start": 565098, "end": 570042, "audio": 1}, {"filename": "/data/sound/snowman/nl/tr-m-au1.ogg", "start": 570042, "end": 584942, "audio": 1}, {"filename": "/data/sound/snowman/nl/tr-m-au2.ogg", "start": 584942, "end": 598647, "audio": 1}, {"filename": "/data/sound/snowman/nl/tr-m-chlad1.ogg", "start": 598647, "end": 617123, "audio": 1}, {"filename": "/data/sound/snowman/nl/tr-m-chlad2.ogg", "start": 617123, "end": 632071, "audio": 1}, {"filename": "/data/sound/snowman/nl/tr-m-cvicit.ogg", "start": 632071, "end": 660750, "audio": 1}, {"filename": "/data/sound/snowman/nl/tr-m-ztuhl.ogg", "start": 660750, "end": 680862, "audio": 1}, {"filename": "/data/sound/snowman/nl/tr-v-agres.ogg", "start": 680862, "end": 703626, "audio": 1}, {"filename": "/data/sound/snowman/nl/tr-v-jid1.ogg", "start": 703626, "end": 725105, "audio": 1}, {"filename": "/data/sound/snowman/nl/tr-v-jid2.ogg", "start": 725105, "end": 749186, "audio": 1}, {"filename": "/data/sound/snowman/nl/tr-v-prezil.ogg", "start": 749186, "end": 770837, "audio": 1}], "remote_package_size": 770837, "package_uuid": "5e0365ba-44df-4930-a10a-a6db96690bba"});

})();
