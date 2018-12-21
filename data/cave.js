
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
    var PACKAGE_NAME = 'web/data/cave.data';
    var REMOTE_PACKAGE_BASE = 'data/cave.data';
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
Module['FS_createPath']('/data/images', 'cave', true, true);
Module['FS_createPath']('/data', 'script', true, true);
Module['FS_createPath']('/data/script', 'cave', true, true);
Module['FS_createPath']('/data', 'sound', true, true);
Module['FS_createPath']('/data/sound', 'cave', true, true);
Module['FS_createPath']('/data/sound/cave', 'cs', true, true);
Module['FS_createPath']('/data/sound/cave', 'nl', true, true);

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
              Module['removeRunDependency']('datafile_web/data/cave.data');

    };
    Module['addRunDependency']('datafile_web/data/cave.data');
  
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
 loadPackage({"files": [{"filename": "/data/images/cave/amfora.png", "start": 0, "end": 1063, "audio": 0}, {"filename": "/data/images/cave/das-_00.png", "start": 1063, "end": 3915, "audio": 0}, {"filename": "/data/images/cave/das-_01.png", "start": 3915, "end": 6769, "audio": 0}, {"filename": "/data/images/cave/das-_02.png", "start": 6769, "end": 9614, "audio": 0}, {"filename": "/data/images/cave/das-_03.png", "start": 9614, "end": 12466, "audio": 0}, {"filename": "/data/images/cave/das-_04.png", "start": 12466, "end": 15312, "audio": 0}, {"filename": "/data/images/cave/das-_05.png", "start": 15312, "end": 18173, "audio": 0}, {"filename": "/data/images/cave/das-_06.png", "start": 18173, "end": 21021, "audio": 0}, {"filename": "/data/images/cave/das-_07.png", "start": 21021, "end": 23879, "audio": 0}, {"filename": "/data/images/cave/das-_08.png", "start": 23879, "end": 26730, "audio": 0}, {"filename": "/data/images/cave/jeskyne-p.png", "start": 26730, "end": 184139, "audio": 0}, {"filename": "/data/images/cave/jeskyne-w.png", "start": 184139, "end": 381334, "audio": 0}, {"filename": "/data/images/cave/krapnik3.png", "start": 381334, "end": 383754, "audio": 0}, {"filename": "/data/images/cave/muslicka.png", "start": 383754, "end": 384456, "audio": 0}, {"filename": "/data/images/cave/netopejr_00.png", "start": 384456, "end": 386561, "audio": 0}, {"filename": "/data/images/cave/netopejr_01.png", "start": 386561, "end": 388697, "audio": 0}, {"filename": "/data/images/cave/netopejr_02.png", "start": 388697, "end": 390727, "audio": 0}, {"filename": "/data/images/cave/netopejr_03.png", "start": 390727, "end": 392787, "audio": 0}, {"filename": "/data/images/cave/rybicka_h_00.png", "start": 392787, "end": 393933, "audio": 0}, {"filename": "/data/images/cave/rybicka_h_01.png", "start": 393933, "end": 395093, "audio": 0}, {"filename": "/data/images/cave/rybicka_h_02.png", "start": 395093, "end": 396244, "audio": 0}, {"filename": "/data/images/cave/rybicka_h_03.png", "start": 396244, "end": 397370, "audio": 0}, {"filename": "/data/images/cave/tyc_00.png", "start": 397370, "end": 398329, "audio": 0}, {"filename": "/data/images/cave/tyc_01.png", "start": 398329, "end": 399326, "audio": 0}, {"filename": "/data/images/cave/vaza_cervena.png", "start": 399326, "end": 400182, "audio": 0}, {"filename": "/data/images/cave/vazav_00.png", "start": 400182, "end": 401477, "audio": 0}, {"filename": "/data/images/cave/vazav_01.png", "start": 401477, "end": 402772, "audio": 0}, {"filename": "/data/images/cave/zahavec_00.png", "start": 402772, "end": 405822, "audio": 0}, {"filename": "/data/images/cave/zahavec_01.png", "start": 405822, "end": 408865, "audio": 0}, {"filename": "/data/images/cave/zahavec_02.png", "start": 408865, "end": 411782, "audio": 0}, {"filename": "/data/images/cave/zahavec_03.png", "start": 411782, "end": 414815, "audio": 0}, {"filename": "/data/images/cave/zahavec_04.png", "start": 414815, "end": 417859, "audio": 0}, {"filename": "/data/images/cave/zahavec_05.png", "start": 417859, "end": 420808, "audio": 0}, {"filename": "/data/images/cave/zahavec_06.png", "start": 420808, "end": 423816, "audio": 0}, {"filename": "/data/images/cave/zahavec_07.png", "start": 423816, "end": 426852, "audio": 0}, {"filename": "/data/images/cave/zahavec_08.png", "start": 426852, "end": 429808, "audio": 0}, {"filename": "/data/script/cave/code.lua", "start": 429808, "end": 441734, "audio": 0}, {"filename": "/data/script/cave/dialogs_bg.lua", "start": 441734, "end": 445757, "audio": 0}, {"filename": "/data/script/cave/dialogs_cs.lua", "start": 445757, "end": 449161, "audio": 0}, {"filename": "/data/script/cave/dialogs_de_CH.lua", "start": 449161, "end": 449416, "audio": 0}, {"filename": "/data/script/cave/dialogs_de.lua", "start": 449416, "end": 452964, "audio": 0}, {"filename": "/data/script/cave/dialogs_en.lua", "start": 452964, "end": 455059, "audio": 0}, {"filename": "/data/script/cave/dialogs_es.lua", "start": 455059, "end": 458594, "audio": 0}, {"filename": "/data/script/cave/dialogs_fr.lua", "start": 458594, "end": 462196, "audio": 0}, {"filename": "/data/script/cave/dialogs_it.lua", "start": 462196, "end": 465653, "audio": 0}, {"filename": "/data/script/cave/dialogs.lua", "start": 465653, "end": 465691, "audio": 0}, {"filename": "/data/script/cave/dialogs_nl.lua", "start": 465691, "end": 469188, "audio": 0}, {"filename": "/data/script/cave/dialogs_pl.lua", "start": 469188, "end": 472592, "audio": 0}, {"filename": "/data/script/cave/dialogs_ru.lua", "start": 472592, "end": 476734, "audio": 0}, {"filename": "/data/script/cave/dialogs_sv.lua", "start": 476734, "end": 480276, "audio": 0}, {"filename": "/data/script/cave/init.lua", "start": 480276, "end": 480919, "audio": 0}, {"filename": "/data/script/cave/models.lua", "start": 480919, "end": 483593, "audio": 0}, {"filename": "/data/sound/cave/cs/jes-m-deprese.ogg", "start": 483593, "end": 511442, "audio": 1}, {"filename": "/data/sound/cave/cs/jes-m-netopyr0.ogg", "start": 511442, "end": 529871, "audio": 1}, {"filename": "/data/sound/cave/cs/jes-m-netopyr1.ogg", "start": 529871, "end": 544847, "audio": 1}, {"filename": "/data/sound/cave/cs/jes-m-netopyr2.ogg", "start": 544847, "end": 563282, "audio": 1}, {"filename": "/data/sound/cave/cs/jes-m-netopyr3.ogg", "start": 563282, "end": 582207, "audio": 1}, {"filename": "/data/sound/cave/cs/jes-m-netopyr.ogg", "start": 582207, "end": 610962, "audio": 1}, {"filename": "/data/sound/cave/cs/jes-m-potvora0.ogg", "start": 610962, "end": 628260, "audio": 1}, {"filename": "/data/sound/cave/cs/jes-m-potvora1.ogg", "start": 628260, "end": 641862, "audio": 1}, {"filename": "/data/sound/cave/cs/jes-m-potvora2.ogg", "start": 641862, "end": 657437, "audio": 1}, {"filename": "/data/sound/cave/cs/jes-m-ryba.ogg", "start": 657437, "end": 682292, "audio": 1}, {"filename": "/data/sound/cave/cs/jes-m-takvidis.ogg", "start": 682292, "end": 699590, "audio": 1}, {"filename": "/data/sound/cave/cs/jes-m-tvor.ogg", "start": 699590, "end": 727731, "audio": 1}, {"filename": "/data/sound/cave/cs/jes-v-gral.ogg", "start": 727731, "end": 757490, "audio": 1}, {"filename": "/data/sound/cave/cs/jes-v-kamen.ogg", "start": 757490, "end": 779820, "audio": 1}, {"filename": "/data/sound/cave/cs/jes-v-nechut0.ogg", "start": 779820, "end": 802402, "audio": 1}, {"filename": "/data/sound/cave/cs/jes-v-nechut1.ogg", "start": 802402, "end": 825874, "audio": 1}, {"filename": "/data/sound/cave/cs/jes-v-nestezuj.ogg", "start": 825874, "end": 852055, "audio": 1}, {"filename": "/data/sound/cave/cs/jes-v-netopyr0.ogg", "start": 852055, "end": 866803, "audio": 1}, {"filename": "/data/sound/cave/cs/jes-v-netopyr1.ogg", "start": 866803, "end": 880511, "audio": 1}, {"filename": "/data/sound/cave/cs/jes-v-netopyr2.ogg", "start": 880511, "end": 894511, "audio": 1}, {"filename": "/data/sound/cave/cs/jes-v-nevim.ogg", "start": 894511, "end": 908318, "audio": 1}, {"filename": "/data/sound/cave/cs/jes-v-potvora0.ogg", "start": 908318, "end": 925200, "audio": 1}, {"filename": "/data/sound/cave/cs/jes-v-potvora1.ogg", "start": 925200, "end": 940266, "audio": 1}, {"filename": "/data/sound/cave/cs/jes-v-potvora2.ogg", "start": 940266, "end": 954543, "audio": 1}, {"filename": "/data/sound/cave/cs/jes-v-tojo.ogg", "start": 954543, "end": 969696, "audio": 1}, {"filename": "/data/sound/cave/cs/jes-v-uzke.ogg", "start": 969696, "end": 999786, "audio": 1}, {"filename": "/data/sound/cave/nl/jes-m-deprese.ogg", "start": 999786, "end": 1025888, "audio": 1}, {"filename": "/data/sound/cave/nl/jes-m-netopyr0.ogg", "start": 1025888, "end": 1049123, "audio": 1}, {"filename": "/data/sound/cave/nl/jes-m-netopyr1.ogg", "start": 1049123, "end": 1069461, "audio": 1}, {"filename": "/data/sound/cave/nl/jes-m-netopyr2.ogg", "start": 1069461, "end": 1093717, "audio": 1}, {"filename": "/data/sound/cave/nl/jes-m-netopyr3.ogg", "start": 1093717, "end": 1117232, "audio": 1}, {"filename": "/data/sound/cave/nl/jes-m-netopyr.ogg", "start": 1117232, "end": 1139060, "audio": 1}, {"filename": "/data/sound/cave/nl/jes-m-potvora0.ogg", "start": 1139060, "end": 1165809, "audio": 1}, {"filename": "/data/sound/cave/nl/jes-m-potvora1.ogg", "start": 1165809, "end": 1185812, "audio": 1}, {"filename": "/data/sound/cave/nl/jes-m-potvora2.ogg", "start": 1185812, "end": 1209448, "audio": 1}, {"filename": "/data/sound/cave/nl/jes-m-ryba.ogg", "start": 1209448, "end": 1230092, "audio": 1}, {"filename": "/data/sound/cave/nl/jes-m-takvidis.ogg", "start": 1230092, "end": 1246130, "audio": 1}, {"filename": "/data/sound/cave/nl/jes-m-tvor.ogg", "start": 1246130, "end": 1266705, "audio": 1}, {"filename": "/data/sound/cave/nl/jes-v-gral.ogg", "start": 1266705, "end": 1291657, "audio": 1}, {"filename": "/data/sound/cave/nl/jes-v-kamen.ogg", "start": 1291657, "end": 1318169, "audio": 1}, {"filename": "/data/sound/cave/nl/jes-v-nechut0.ogg", "start": 1318169, "end": 1339991, "audio": 1}, {"filename": "/data/sound/cave/nl/jes-v-nechut1.ogg", "start": 1339991, "end": 1371899, "audio": 1}, {"filename": "/data/sound/cave/nl/jes-v-nestezuj.ogg", "start": 1371899, "end": 1398481, "audio": 1}, {"filename": "/data/sound/cave/nl/jes-v-netopyr0.ogg", "start": 1398481, "end": 1420381, "audio": 1}, {"filename": "/data/sound/cave/nl/jes-v-netopyr1.ogg", "start": 1420381, "end": 1439465, "audio": 1}, {"filename": "/data/sound/cave/nl/jes-v-netopyr2.ogg", "start": 1439465, "end": 1459127, "audio": 1}, {"filename": "/data/sound/cave/nl/jes-v-nevim.ogg", "start": 1459127, "end": 1476568, "audio": 1}, {"filename": "/data/sound/cave/nl/jes-v-potvora0.ogg", "start": 1476568, "end": 1498216, "audio": 1}, {"filename": "/data/sound/cave/nl/jes-v-potvora1.ogg", "start": 1498216, "end": 1521679, "audio": 1}, {"filename": "/data/sound/cave/nl/jes-v-potvora2.ogg", "start": 1521679, "end": 1540026, "audio": 1}, {"filename": "/data/sound/cave/nl/jes-v-tojo.ogg", "start": 1540026, "end": 1554201, "audio": 1}, {"filename": "/data/sound/cave/nl/jes-v-uzke.ogg", "start": 1554201, "end": 1587137, "audio": 1}], "remote_package_size": 1587137, "package_uuid": "6e63aba4-c4e6-4ea5-b46e-9a759c33358a"});

})();
