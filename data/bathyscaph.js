
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
    var PACKAGE_NAME = 'web/data/bathyscaph.data';
    var REMOTE_PACKAGE_BASE = 'data/bathyscaph.data';
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
Module['FS_createPath']('/data/images', 'bathyscaph', true, true);
Module['FS_createPath']('/data', 'script', true, true);
Module['FS_createPath']('/data/script', 'bathyscaph', true, true);
Module['FS_createPath']('/data', 'sound', true, true);
Module['FS_createPath']('/data/sound', 'bathyscaph', true, true);
Module['FS_createPath']('/data/sound/bathyscaph', 'cs', true, true);
Module['FS_createPath']('/data/sound/bathyscaph', 'en', true, true);
Module['FS_createPath']('/data/sound/bathyscaph', 'nl', true, true);

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
              Module['removeRunDependency']('datafile_web/data/bathyscaph.data');

    };
    Module['addRunDependency']('datafile_web/data/bathyscaph.data');
  
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
 loadPackage({"files": [{"filename": "/data/images/bathyscaph/batyskaf-3-tmp.png", "start": 0, "end": 867, "audio": 0}, {"filename": "/data/images/bathyscaph/batyskaf-p.png", "start": 867, "end": 133133, "audio": 0}, {"filename": "/data/images/bathyscaph/batyskaf-w.png", "start": 133133, "end": 255852, "audio": 0}, {"filename": "/data/images/bathyscaph/budik_00.png", "start": 255852, "end": 256507, "audio": 0}, {"filename": "/data/images/bathyscaph/budik_01.png", "start": 256507, "end": 257085, "audio": 0}, {"filename": "/data/images/bathyscaph/dalekohled_00.png", "start": 257085, "end": 258314, "audio": 0}, {"filename": "/data/images/bathyscaph/dalekohled_01.png", "start": 258314, "end": 259491, "audio": 0}, {"filename": "/data/images/bathyscaph/mikroskop_00.png", "start": 259491, "end": 262045, "audio": 0}, {"filename": "/data/images/bathyscaph/mikroskop_01.png", "start": 262045, "end": 264565, "audio": 0}, {"filename": "/data/images/bathyscaph/mikroskop_02.png", "start": 264565, "end": 267105, "audio": 0}, {"filename": "/data/images/bathyscaph/msluch_00.png", "start": 267105, "end": 269929, "audio": 0}, {"filename": "/data/images/bathyscaph/msluch_01.png", "start": 269929, "end": 272821, "audio": 0}, {"filename": "/data/images/bathyscaph/msluch_02.png", "start": 272821, "end": 275767, "audio": 0}, {"filename": "/data/images/bathyscaph/mtelefon.png", "start": 275767, "end": 279144, "audio": 0}, {"filename": "/data/images/bathyscaph/sluch_00.png", "start": 279144, "end": 281993, "audio": 0}, {"filename": "/data/images/bathyscaph/sluch_01.png", "start": 281993, "end": 284885, "audio": 0}, {"filename": "/data/images/bathyscaph/sluch_02.png", "start": 284885, "end": 287868, "audio": 0}, {"filename": "/data/images/bathyscaph/snek_00.png", "start": 287868, "end": 290405, "audio": 0}, {"filename": "/data/images/bathyscaph/snek_01.png", "start": 290405, "end": 292949, "audio": 0}, {"filename": "/data/images/bathyscaph/telefon.png", "start": 292949, "end": 296335, "audio": 0}, {"filename": "/data/script/bathyscaph/code.lua", "start": 296335, "end": 310256, "audio": 0}, {"filename": "/data/script/bathyscaph/dialogs_bg.lua", "start": 310256, "end": 313755, "audio": 0}, {"filename": "/data/script/bathyscaph/dialogs_cs.lua", "start": 313755, "end": 316698, "audio": 0}, {"filename": "/data/script/bathyscaph/dialogs_de.lua", "start": 316698, "end": 319744, "audio": 0}, {"filename": "/data/script/bathyscaph/dialogs_en.lua", "start": 319744, "end": 321626, "audio": 0}, {"filename": "/data/script/bathyscaph/dialogs_es.lua", "start": 321626, "end": 324628, "audio": 0}, {"filename": "/data/script/bathyscaph/dialogs_fr.lua", "start": 324628, "end": 327715, "audio": 0}, {"filename": "/data/script/bathyscaph/dialogs_it.lua", "start": 327715, "end": 330686, "audio": 0}, {"filename": "/data/script/bathyscaph/dialogs.lua", "start": 330686, "end": 330724, "audio": 0}, {"filename": "/data/script/bathyscaph/dialogs_nl.lua", "start": 330724, "end": 333652, "audio": 0}, {"filename": "/data/script/bathyscaph/dialogs_pl.lua", "start": 333652, "end": 336550, "audio": 0}, {"filename": "/data/script/bathyscaph/dialogs_ru.lua", "start": 336550, "end": 340015, "audio": 0}, {"filename": "/data/script/bathyscaph/dialogs_sl.lua", "start": 340015, "end": 343016, "audio": 0}, {"filename": "/data/script/bathyscaph/dialogs_sv.lua", "start": 343016, "end": 346026, "audio": 0}, {"filename": "/data/script/bathyscaph/init.lua", "start": 346026, "end": 346675, "audio": 0}, {"filename": "/data/script/bathyscaph/models.lua", "start": 346675, "end": 349319, "audio": 0}, {"filename": "/data/sound/bathyscaph/cs/bat-m-mikro.ogg", "start": 349319, "end": 363605, "audio": 1}, {"filename": "/data/sound/bathyscaph/cs/bat-m-sluch.ogg", "start": 363605, "end": 382367, "audio": 1}, {"filename": "/data/sound/bathyscaph/cs/bat-m-tohle.ogg", "start": 382367, "end": 401873, "audio": 1}, {"filename": "/data/sound/bathyscaph/cs/bat-p-0.ogg", "start": 401873, "end": 412529, "audio": 1}, {"filename": "/data/sound/bathyscaph/cs/bat-p-1.ogg", "start": 412529, "end": 423173, "audio": 1}, {"filename": "/data/sound/bathyscaph/cs/bat-p-2.ogg", "start": 423173, "end": 436409, "audio": 1}, {"filename": "/data/sound/bathyscaph/cs/bat-p-3.ogg", "start": 436409, "end": 447205, "audio": 1}, {"filename": "/data/sound/bathyscaph/cs/bat-p-4.ogg", "start": 447205, "end": 458172, "audio": 1}, {"filename": "/data/sound/bathyscaph/cs/bat-p-5.ogg", "start": 458172, "end": 469003, "audio": 1}, {"filename": "/data/sound/bathyscaph/cs/bat-p-zhov0.ogg", "start": 469003, "end": 519212, "audio": 1}, {"filename": "/data/sound/bathyscaph/cs/bat-p-zhov1.ogg", "start": 519212, "end": 656897, "audio": 1}, {"filename": "/data/sound/bathyscaph/cs/bat-s-prome0.ogg", "start": 656897, "end": 668452, "audio": 1}, {"filename": "/data/sound/bathyscaph/cs/bat-s-prome1.ogg", "start": 668452, "end": 682913, "audio": 1}, {"filename": "/data/sound/bathyscaph/cs/bat-s-prome2.ogg", "start": 682913, "end": 698777, "audio": 1}, {"filename": "/data/sound/bathyscaph/cs/bat-s-snek0.ogg", "start": 698777, "end": 717599, "audio": 1}, {"filename": "/data/sound/bathyscaph/cs/bat-s-snek1.ogg", "start": 717599, "end": 741280, "audio": 1}, {"filename": "/data/sound/bathyscaph/cs/bat-s-snek2.ogg", "start": 741280, "end": 754772, "audio": 1}, {"filename": "/data/sound/bathyscaph/cs/bat-s-snek3.ogg", "start": 754772, "end": 772233, "audio": 1}, {"filename": "/data/sound/bathyscaph/cs/bat-v-klid.ogg", "start": 772233, "end": 783671, "audio": 1}, {"filename": "/data/sound/bathyscaph/cs/bat-v-vyp.ogg", "start": 783671, "end": 797520, "audio": 1}, {"filename": "/data/sound/bathyscaph/cs/bat-v-zved0.ogg", "start": 797520, "end": 811042, "audio": 1}, {"filename": "/data/sound/bathyscaph/cs/bat-v-zved1.ogg", "start": 811042, "end": 825403, "audio": 1}, {"filename": "/data/sound/bathyscaph/en/bat-t-budik.ogg", "start": 825403, "end": 830831, "audio": 1}, {"filename": "/data/sound/bathyscaph/en/bat-t-phone0.ogg", "start": 830831, "end": 842338, "audio": 1}, {"filename": "/data/sound/bathyscaph/en/bat-t-phone1.ogg", "start": 842338, "end": 853617, "audio": 1}, {"filename": "/data/sound/bathyscaph/nl/bat-m-mikro.ogg", "start": 853617, "end": 869332, "audio": 1}, {"filename": "/data/sound/bathyscaph/nl/bat-m-sluch.ogg", "start": 869332, "end": 886899, "audio": 1}, {"filename": "/data/sound/bathyscaph/nl/bat-m-tohle.ogg", "start": 886899, "end": 907183, "audio": 1}, {"filename": "/data/sound/bathyscaph/nl/bat-v-klid.ogg", "start": 907183, "end": 925440, "audio": 1}, {"filename": "/data/sound/bathyscaph/nl/bat-v-vyp.ogg", "start": 925440, "end": 945271, "audio": 1}, {"filename": "/data/sound/bathyscaph/nl/bat-v-zved0.ogg", "start": 945271, "end": 963110, "audio": 1}, {"filename": "/data/sound/bathyscaph/nl/bat-v-zved1.ogg", "start": 963110, "end": 981060, "audio": 1}], "remote_package_size": 981060, "package_uuid": "5b05ab02-e347-473e-9d80-864b329db913"});

})();
