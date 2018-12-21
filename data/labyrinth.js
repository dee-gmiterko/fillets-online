
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
    var PACKAGE_NAME = 'web/data/labyrinth.data';
    var REMOTE_PACKAGE_BASE = 'data/labyrinth.data';
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
Module['FS_createPath']('/data/images', 'labyrinth', true, true);
Module['FS_createPath']('/data', 'script', true, true);
Module['FS_createPath']('/data/script', 'labyrinth', true, true);
Module['FS_createPath']('/data', 'sound', true, true);
Module['FS_createPath']('/data/sound', 'labyrinth', true, true);
Module['FS_createPath']('/data/sound/labyrinth', 'cs', true, true);
Module['FS_createPath']('/data/sound/labyrinth', 'nl', true, true);

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
              Module['removeRunDependency']('datafile_web/data/labyrinth.data');

    };
    Module['addRunDependency']('datafile_web/data/labyrinth.data');
  
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
 loadPackage({"files": [{"filename": "/data/images/labyrinth/3-ocel.png", "start": 0, "end": 1992, "audio": 0}, {"filename": "/data/images/labyrinth/bludiste-p.png", "start": 1992, "end": 314762, "audio": 0}, {"filename": "/data/images/labyrinth/bludiste-w.png", "start": 314762, "end": 457368, "audio": 0}, {"filename": "/data/images/labyrinth/koral_b.png", "start": 457368, "end": 499146, "audio": 0}, {"filename": "/data/images/labyrinth/maly_snek_00.png", "start": 499146, "end": 499766, "audio": 0}, {"filename": "/data/images/labyrinth/maly_snek_01.png", "start": 499766, "end": 500427, "audio": 0}, {"filename": "/data/images/labyrinth/maly_snek_02.png", "start": 500427, "end": 501117, "audio": 0}, {"filename": "/data/images/labyrinth/maly_snek_03.png", "start": 501117, "end": 501730, "audio": 0}, {"filename": "/data/script/labyrinth/code.lua", "start": 501730, "end": 507145, "audio": 0}, {"filename": "/data/script/labyrinth/dialogs_bg.lua", "start": 507145, "end": 510659, "audio": 0}, {"filename": "/data/script/labyrinth/dialogs_cs.lua", "start": 510659, "end": 513568, "audio": 0}, {"filename": "/data/script/labyrinth/dialogs_de_CH.lua", "start": 513568, "end": 514267, "audio": 0}, {"filename": "/data/script/labyrinth/dialogs_de.lua", "start": 514267, "end": 517286, "audio": 0}, {"filename": "/data/script/labyrinth/dialogs_en.lua", "start": 517286, "end": 518997, "audio": 0}, {"filename": "/data/script/labyrinth/dialogs_es.lua", "start": 518997, "end": 521972, "audio": 0}, {"filename": "/data/script/labyrinth/dialogs_fr.lua", "start": 521972, "end": 525012, "audio": 0}, {"filename": "/data/script/labyrinth/dialogs_it.lua", "start": 525012, "end": 527987, "audio": 0}, {"filename": "/data/script/labyrinth/dialogs.lua", "start": 527987, "end": 528025, "audio": 0}, {"filename": "/data/script/labyrinth/dialogs_nl.lua", "start": 528025, "end": 530943, "audio": 0}, {"filename": "/data/script/labyrinth/dialogs_pl.lua", "start": 530943, "end": 533864, "audio": 0}, {"filename": "/data/script/labyrinth/dialogs_ru.lua", "start": 533864, "end": 537392, "audio": 0}, {"filename": "/data/script/labyrinth/dialogs_sv.lua", "start": 537392, "end": 540382, "audio": 0}, {"filename": "/data/script/labyrinth/init.lua", "start": 540382, "end": 541030, "audio": 0}, {"filename": "/data/script/labyrinth/models.lua", "start": 541030, "end": 543790, "audio": 0}, {"filename": "/data/sound/labyrinth/cs/bl-m-funkce.ogg", "start": 543790, "end": 595530, "audio": 1}, {"filename": "/data/sound/labyrinth/cs/bl-m-koral0.ogg", "start": 595530, "end": 610906, "audio": 1}, {"filename": "/data/sound/labyrinth/cs/bl-m-snecku0.ogg", "start": 610906, "end": 632568, "audio": 1}, {"filename": "/data/sound/labyrinth/cs/bl-m-snecku1.ogg", "start": 632568, "end": 656318, "audio": 1}, {"filename": "/data/sound/labyrinth/cs/bl-m-snecku2.ogg", "start": 656318, "end": 678865, "audio": 1}, {"filename": "/data/sound/labyrinth/cs/bl-m-tvar.ogg", "start": 678865, "end": 707623, "audio": 1}, {"filename": "/data/sound/labyrinth/cs/bl-m-visi.ogg", "start": 707623, "end": 722539, "audio": 1}, {"filename": "/data/sound/labyrinth/cs/bl-m-zeptej.ogg", "start": 722539, "end": 745778, "audio": 1}, {"filename": "/data/sound/labyrinth/cs/bl-m-zvlastni0.ogg", "start": 745778, "end": 763382, "audio": 1}, {"filename": "/data/sound/labyrinth/cs/bl-v-dost0.ogg", "start": 763382, "end": 801029, "audio": 1}, {"filename": "/data/sound/labyrinth/cs/bl-v-dost1.ogg", "start": 801029, "end": 827987, "audio": 1}, {"filename": "/data/sound/labyrinth/cs/bl-v-dost2.ogg", "start": 827987, "end": 853528, "audio": 1}, {"filename": "/data/sound/labyrinth/cs/bl-v-koral1.ogg", "start": 853528, "end": 869559, "audio": 1}, {"filename": "/data/sound/labyrinth/cs/bl-v-nevim0.ogg", "start": 869559, "end": 889391, "audio": 1}, {"filename": "/data/sound/labyrinth/cs/bl-v-nevim1.ogg", "start": 889391, "end": 912737, "audio": 1}, {"filename": "/data/sound/labyrinth/cs/bl-v-pestovany.ogg", "start": 912737, "end": 934459, "audio": 1}, {"filename": "/data/sound/labyrinth/cs/bl-v-pozadi.ogg", "start": 934459, "end": 957240, "audio": 1}, {"filename": "/data/sound/labyrinth/cs/bl-v-proc.ogg", "start": 957240, "end": 977106, "audio": 1}, {"filename": "/data/sound/labyrinth/cs/bl-v-zvlastni1.ogg", "start": 977106, "end": 993793, "audio": 1}, {"filename": "/data/sound/labyrinth/nl/bl-m-funkce.ogg", "start": 993793, "end": 1049269, "audio": 1}, {"filename": "/data/sound/labyrinth/nl/bl-m-koral0.ogg", "start": 1049269, "end": 1067862, "audio": 1}, {"filename": "/data/sound/labyrinth/nl/bl-m-snecku0.ogg", "start": 1067862, "end": 1090565, "audio": 1}, {"filename": "/data/sound/labyrinth/nl/bl-m-snecku1.ogg", "start": 1090565, "end": 1119192, "audio": 1}, {"filename": "/data/sound/labyrinth/nl/bl-m-snecku2.ogg", "start": 1119192, "end": 1151840, "audio": 1}, {"filename": "/data/sound/labyrinth/nl/bl-m-tvar.ogg", "start": 1151840, "end": 1175192, "audio": 1}, {"filename": "/data/sound/labyrinth/nl/bl-m-visi.ogg", "start": 1175192, "end": 1193568, "audio": 1}, {"filename": "/data/sound/labyrinth/nl/bl-m-zeptej.ogg", "start": 1193568, "end": 1214632, "audio": 1}, {"filename": "/data/sound/labyrinth/nl/bl-m-zvlastni0.ogg", "start": 1214632, "end": 1234941, "audio": 1}, {"filename": "/data/sound/labyrinth/nl/bl-v-dost0.ogg", "start": 1234941, "end": 1268615, "audio": 1}, {"filename": "/data/sound/labyrinth/nl/bl-v-dost1.ogg", "start": 1268615, "end": 1289513, "audio": 1}, {"filename": "/data/sound/labyrinth/nl/bl-v-dost2.ogg", "start": 1289513, "end": 1317566, "audio": 1}, {"filename": "/data/sound/labyrinth/nl/bl-v-koral1.ogg", "start": 1317566, "end": 1335249, "audio": 1}, {"filename": "/data/sound/labyrinth/nl/bl-v-nevim0.ogg", "start": 1335249, "end": 1362719, "audio": 1}, {"filename": "/data/sound/labyrinth/nl/bl-v-nevim1.ogg", "start": 1362719, "end": 1386028, "audio": 1}, {"filename": "/data/sound/labyrinth/nl/bl-v-pestovany.ogg", "start": 1386028, "end": 1418453, "audio": 1}, {"filename": "/data/sound/labyrinth/nl/bl-v-pozadi.ogg", "start": 1418453, "end": 1444363, "audio": 1}, {"filename": "/data/sound/labyrinth/nl/bl-v-proc.ogg", "start": 1444363, "end": 1466971, "audio": 1}, {"filename": "/data/sound/labyrinth/nl/bl-v-zvlastni1.ogg", "start": 1466971, "end": 1485810, "audio": 1}], "remote_package_size": 1485810, "package_uuid": "81a380f9-8304-41c1-b284-5745ebe6d012"});

})();
