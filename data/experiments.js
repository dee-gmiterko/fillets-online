
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
    var PACKAGE_NAME = 'web/data/experiments.data';
    var REMOTE_PACKAGE_BASE = 'data/experiments.data';
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
Module['FS_createPath']('/data/images', 'experiments', true, true);
Module['FS_createPath']('/data', 'script', true, true);
Module['FS_createPath']('/data/script', 'experiments', true, true);
Module['FS_createPath']('/data', 'sound', true, true);
Module['FS_createPath']('/data/sound', 'experiments', true, true);
Module['FS_createPath']('/data/sound/experiments', 'cs', true, true);
Module['FS_createPath']('/data/sound/experiments', 'nl', true, true);

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
              Module['removeRunDependency']('datafile_web/data/experiments.data');

    };
    Module['addRunDependency']('datafile_web/data/experiments.data');
  
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
 loadPackage({"files": [{"filename": "/data/images/experiments/banka-3-tmp.png", "start": 0, "end": 2472, "audio": 0}, {"filename": "/data/images/experiments/banka-4-tmp.png", "start": 2472, "end": 5169, "audio": 0}, {"filename": "/data/images/experiments/banka-5-tmp.png", "start": 5169, "end": 8046, "audio": 0}, {"filename": "/data/images/experiments/banka-6-tmp.png", "start": 8046, "end": 10747, "audio": 0}, {"filename": "/data/images/experiments/banka-7-tmp.png", "start": 10747, "end": 13518, "audio": 0}, {"filename": "/data/images/experiments/banka-p.png", "start": 13518, "end": 212468, "audio": 0}, {"filename": "/data/images/experiments/banka-w.png", "start": 212468, "end": 257901, "audio": 0}, {"filename": "/data/images/experiments/dvere.png", "start": 257901, "end": 259745, "audio": 0}, {"filename": "/data/images/experiments/horni_tvor_00.png", "start": 259745, "end": 260942, "audio": 0}, {"filename": "/data/images/experiments/horni_tvor_01.png", "start": 260942, "end": 262128, "audio": 0}, {"filename": "/data/images/experiments/horni_tvor_02.png", "start": 262128, "end": 263311, "audio": 0}, {"filename": "/data/images/experiments/horni_tvor_03.png", "start": 263311, "end": 264504, "audio": 0}, {"filename": "/data/images/experiments/horni_tvor_04.png", "start": 264504, "end": 265689, "audio": 0}, {"filename": "/data/images/experiments/horni_tvor_05.png", "start": 265689, "end": 266894, "audio": 0}, {"filename": "/data/images/experiments/injekc.png", "start": 266894, "end": 268826, "audio": 0}, {"filename": "/data/images/experiments/klec_00.png", "start": 268826, "end": 273321, "audio": 0}, {"filename": "/data/images/experiments/klec_01.png", "start": 273321, "end": 277806, "audio": 0}, {"filename": "/data/images/experiments/kreveta.png", "start": 277806, "end": 280289, "audio": 0}, {"filename": "/data/images/experiments/lahvac_00.png", "start": 280289, "end": 282932, "audio": 0}, {"filename": "/data/images/experiments/lahvac_01.png", "start": 282932, "end": 285438, "audio": 0}, {"filename": "/data/images/experiments/lahvac_02.png", "start": 285438, "end": 287871, "audio": 0}, {"filename": "/data/images/experiments/lahvac_03.png", "start": 287871, "end": 291058, "audio": 0}, {"filename": "/data/images/experiments/lahvac_04.png", "start": 291058, "end": 294245, "audio": 0}, {"filename": "/data/images/experiments/lahvac_05.png", "start": 294245, "end": 296988, "audio": 0}, {"filename": "/data/images/experiments/lahvac_06.png", "start": 296988, "end": 300092, "audio": 0}, {"filename": "/data/images/experiments/lahvac_07.png", "start": 300092, "end": 303325, "audio": 0}, {"filename": "/data/images/experiments/lahvac_08.png", "start": 303325, "end": 306447, "audio": 0}, {"filename": "/data/images/experiments/lahvac_09.png", "start": 306447, "end": 309333, "audio": 0}, {"filename": "/data/images/experiments/lahvac_10.png", "start": 309333, "end": 311945, "audio": 0}, {"filename": "/data/images/experiments/lahvac_11.png", "start": 311945, "end": 314744, "audio": 0}, {"filename": "/data/images/experiments/lahvac_12.png", "start": 314744, "end": 317439, "audio": 0}, {"filename": "/data/images/experiments/lahvac_13.png", "start": 317439, "end": 320398, "audio": 0}, {"filename": "/data/images/experiments/lahvac_14.png", "start": 320398, "end": 323320, "audio": 0}, {"filename": "/data/images/experiments/lahvac_15.png", "start": 323320, "end": 326005, "audio": 0}, {"filename": "/data/images/experiments/lahvac_16.png", "start": 326005, "end": 328646, "audio": 0}, {"filename": "/data/images/experiments/lahvac_17.png", "start": 328646, "end": 331481, "audio": 0}, {"filename": "/data/images/experiments/lahvac_18.png", "start": 331481, "end": 334277, "audio": 0}, {"filename": "/data/images/experiments/lahvac_19.png", "start": 334277, "end": 337159, "audio": 0}, {"filename": "/data/images/experiments/lahvac_20.png", "start": 337159, "end": 340174, "audio": 0}, {"filename": "/data/images/experiments/lahvac_21.png", "start": 340174, "end": 343166, "audio": 0}, {"filename": "/data/images/experiments/lahvac_22.png", "start": 343166, "end": 346316, "audio": 0}, {"filename": "/data/images/experiments/lahvac_23.png", "start": 346316, "end": 349558, "audio": 0}, {"filename": "/data/images/experiments/lahvac_24.png", "start": 349558, "end": 352602, "audio": 0}, {"filename": "/data/images/experiments/lahvac_25.png", "start": 352602, "end": 355732, "audio": 0}, {"filename": "/data/images/experiments/lahvac_26.png", "start": 355732, "end": 359128, "audio": 0}, {"filename": "/data/images/experiments/lahvac_27.png", "start": 359128, "end": 362342, "audio": 0}, {"filename": "/data/images/experiments/lahvac_28.png", "start": 362342, "end": 365602, "audio": 0}, {"filename": "/data/images/experiments/lahvac_29.png", "start": 365602, "end": 368957, "audio": 0}, {"filename": "/data/images/experiments/lahvac_30.png", "start": 368957, "end": 372284, "audio": 0}, {"filename": "/data/images/experiments/lahvac_31.png", "start": 372284, "end": 375364, "audio": 0}, {"filename": "/data/images/experiments/lahvac_32.png", "start": 375364, "end": 378366, "audio": 0}, {"filename": "/data/images/experiments/lahvac_33.png", "start": 378366, "end": 381699, "audio": 0}, {"filename": "/data/images/experiments/mala_00.png", "start": 381699, "end": 383587, "audio": 0}, {"filename": "/data/images/experiments/mala_01.png", "start": 383587, "end": 385445, "audio": 0}, {"filename": "/data/images/experiments/mala_02.png", "start": 385445, "end": 387321, "audio": 0}, {"filename": "/data/images/experiments/mala_03.png", "start": 387321, "end": 389178, "audio": 0}, {"filename": "/data/images/experiments/mala_04.png", "start": 389178, "end": 390915, "audio": 0}, {"filename": "/data/images/experiments/mala_05.png", "start": 390915, "end": 392798, "audio": 0}, {"filename": "/data/images/experiments/mala_06.png", "start": 392798, "end": 394658, "audio": 0}, {"filename": "/data/images/experiments/med.png", "start": 394658, "end": 396594, "audio": 0}, {"filename": "/data/images/experiments/mrtvolka_00.png", "start": 396594, "end": 398116, "audio": 0}, {"filename": "/data/images/experiments/mrtvolka_01.png", "start": 398116, "end": 399658, "audio": 0}, {"filename": "/data/images/experiments/mrtvolka_02.png", "start": 399658, "end": 401188, "audio": 0}, {"filename": "/data/images/experiments/mrtvolka_03.png", "start": 401188, "end": 402680, "audio": 0}, {"filename": "/data/images/experiments/mrtvolka_04.png", "start": 402680, "end": 404152, "audio": 0}, {"filename": "/data/images/experiments/mrtvolka_05.png", "start": 404152, "end": 405591, "audio": 0}, {"filename": "/data/images/experiments/mrtvolka_06.png", "start": 405591, "end": 406921, "audio": 0}, {"filename": "/data/images/experiments/mrtvolka_07.png", "start": 406921, "end": 408122, "audio": 0}, {"filename": "/data/images/experiments/mrtvolka_08.png", "start": 408122, "end": 409188, "audio": 0}, {"filename": "/data/images/experiments/mutant_00.png", "start": 409188, "end": 412407, "audio": 0}, {"filename": "/data/images/experiments/mutant_01.png", "start": 412407, "end": 415727, "audio": 0}, {"filename": "/data/images/experiments/mutant_02.png", "start": 415727, "end": 418795, "audio": 0}, {"filename": "/data/images/experiments/mutant_03.png", "start": 418795, "end": 422056, "audio": 0}, {"filename": "/data/images/experiments/mutant_04.png", "start": 422056, "end": 425125, "audio": 0}, {"filename": "/data/images/experiments/mutant_05.png", "start": 425125, "end": 428760, "audio": 0}, {"filename": "/data/images/experiments/mutant_06.png", "start": 428760, "end": 432110, "audio": 0}, {"filename": "/data/images/experiments/mutant_07.png", "start": 432110, "end": 435727, "audio": 0}, {"filename": "/data/images/experiments/mutant_08.png", "start": 435727, "end": 439159, "audio": 0}, {"filename": "/data/images/experiments/mutant_09.png", "start": 439159, "end": 442602, "audio": 0}, {"filename": "/data/images/experiments/nuz.png", "start": 442602, "end": 444329, "audio": 0}, {"filename": "/data/images/experiments/oka_00.png", "start": 444329, "end": 447047, "audio": 0}, {"filename": "/data/images/experiments/oka_01.png", "start": 447047, "end": 449763, "audio": 0}, {"filename": "/data/images/experiments/oka_02.png", "start": 449763, "end": 452440, "audio": 0}, {"filename": "/data/images/experiments/oka_03.png", "start": 452440, "end": 455080, "audio": 0}, {"filename": "/data/images/experiments/oka_04.png", "start": 455080, "end": 457749, "audio": 0}, {"filename": "/data/images/experiments/oka_05.png", "start": 457749, "end": 460381, "audio": 0}, {"filename": "/data/images/experiments/oka_06.png", "start": 460381, "end": 463042, "audio": 0}, {"filename": "/data/images/experiments/oka_07.png", "start": 463042, "end": 465871, "audio": 0}, {"filename": "/data/images/experiments/oka_08.png", "start": 465871, "end": 468880, "audio": 0}, {"filename": "/data/images/experiments/oka_09.png", "start": 468880, "end": 471936, "audio": 0}, {"filename": "/data/images/experiments/oka_10.png", "start": 471936, "end": 475089, "audio": 0}, {"filename": "/data/images/experiments/oka_11.png", "start": 475089, "end": 478113, "audio": 0}, {"filename": "/data/images/experiments/oka_12.png", "start": 478113, "end": 481295, "audio": 0}, {"filename": "/data/images/experiments/oka_13.png", "start": 481295, "end": 484308, "audio": 0}, {"filename": "/data/images/experiments/oka_14.png", "start": 484308, "end": 487214, "audio": 0}, {"filename": "/data/images/experiments/oko_00.png", "start": 487214, "end": 487930, "audio": 0}, {"filename": "/data/images/experiments/oko_01.png", "start": 487930, "end": 488621, "audio": 0}, {"filename": "/data/images/experiments/oko_02.png", "start": 488621, "end": 489309, "audio": 0}, {"filename": "/data/images/experiments/oko_03.png", "start": 489309, "end": 489978, "audio": 0}, {"filename": "/data/images/experiments/oko_04.png", "start": 489978, "end": 490694, "audio": 0}, {"filename": "/data/images/experiments/p_00.png", "start": 490694, "end": 491383, "audio": 0}, {"filename": "/data/images/experiments/p_01.png", "start": 491383, "end": 492054, "audio": 0}, {"filename": "/data/images/experiments/p_02.png", "start": 492054, "end": 492729, "audio": 0}, {"filename": "/data/images/experiments/p_03.png", "start": 492729, "end": 493417, "audio": 0}, {"filename": "/data/images/experiments/p_04.png", "start": 493417, "end": 494102, "audio": 0}, {"filename": "/data/images/experiments/p_05.png", "start": 494102, "end": 494651, "audio": 0}, {"filename": "/data/images/experiments/p_06.png", "start": 494651, "end": 495089, "audio": 0}, {"filename": "/data/images/experiments/p_07.png", "start": 495089, "end": 495509, "audio": 0}, {"filename": "/data/images/experiments/p_08.png", "start": 495509, "end": 495813, "audio": 0}, {"filename": "/data/images/experiments/p_09.png", "start": 495813, "end": 496399, "audio": 0}, {"filename": "/data/images/experiments/p_10.png", "start": 496399, "end": 497005, "audio": 0}, {"filename": "/data/images/experiments/p_11.png", "start": 497005, "end": 497692, "audio": 0}, {"filename": "/data/images/experiments/p_12.png", "start": 497692, "end": 498018, "audio": 0}, {"filename": "/data/images/experiments/p_13.png", "start": 498018, "end": 498582, "audio": 0}, {"filename": "/data/images/experiments/p_14.png", "start": 498582, "end": 499121, "audio": 0}, {"filename": "/data/images/experiments/p_15.png", "start": 499121, "end": 499704, "audio": 0}, {"filename": "/data/images/experiments/p_16.png", "start": 499704, "end": 500393, "audio": 0}, {"filename": "/data/images/experiments/p_17.png", "start": 500393, "end": 501073, "audio": 0}, {"filename": "/data/images/experiments/p_18.png", "start": 501073, "end": 501606, "audio": 0}, {"filename": "/data/images/experiments/p_19.png", "start": 501606, "end": 501950, "audio": 0}, {"filename": "/data/images/experiments/p_20.png", "start": 501950, "end": 502359, "audio": 0}, {"filename": "/data/images/experiments/p_21.png", "start": 502359, "end": 502735, "audio": 0}, {"filename": "/data/images/experiments/p_22.png", "start": 502735, "end": 503093, "audio": 0}, {"filename": "/data/images/experiments/p_23.png", "start": 503093, "end": 503674, "audio": 0}, {"filename": "/data/images/experiments/p_24.png", "start": 503674, "end": 504129, "audio": 0}, {"filename": "/data/images/experiments/p_25.png", "start": 504129, "end": 504545, "audio": 0}, {"filename": "/data/images/experiments/p_26.png", "start": 504545, "end": 504861, "audio": 0}, {"filename": "/data/images/experiments/p_27.png", "start": 504861, "end": 505443, "audio": 0}, {"filename": "/data/images/experiments/p_28.png", "start": 505443, "end": 506056, "audio": 0}, {"filename": "/data/images/experiments/p_29.png", "start": 506056, "end": 506758, "audio": 0}, {"filename": "/data/images/experiments/p_30.png", "start": 506758, "end": 507088, "audio": 0}, {"filename": "/data/images/experiments/p_31.png", "start": 507088, "end": 507662, "audio": 0}, {"filename": "/data/images/experiments/p_32.png", "start": 507662, "end": 508194, "audio": 0}, {"filename": "/data/images/experiments/p_33.png", "start": 508194, "end": 508774, "audio": 0}, {"filename": "/data/images/experiments/p_34.png", "start": 508774, "end": 509460, "audio": 0}, {"filename": "/data/images/experiments/p_35.png", "start": 509460, "end": 510140, "audio": 0}, {"filename": "/data/images/experiments/p_36.png", "start": 510140, "end": 510253, "audio": 0}, {"filename": "/data/images/experiments/pilka.png", "start": 510253, "end": 512231, "audio": 0}, {"filename": "/data/images/experiments/q_00.png", "start": 512231, "end": 512920, "audio": 0}, {"filename": "/data/images/experiments/q_01.png", "start": 512920, "end": 513591, "audio": 0}, {"filename": "/data/images/experiments/q_02.png", "start": 513591, "end": 514266, "audio": 0}, {"filename": "/data/images/experiments/q_03.png", "start": 514266, "end": 514954, "audio": 0}, {"filename": "/data/images/experiments/q_04.png", "start": 514954, "end": 515639, "audio": 0}, {"filename": "/data/images/experiments/q_05.png", "start": 515639, "end": 516188, "audio": 0}, {"filename": "/data/images/experiments/q_06.png", "start": 516188, "end": 516721, "audio": 0}, {"filename": "/data/images/experiments/q_07.png", "start": 516721, "end": 517302, "audio": 0}, {"filename": "/data/images/experiments/sklena_00.png", "start": 517302, "end": 520246, "audio": 0}, {"filename": "/data/images/experiments/sklena_01.png", "start": 520246, "end": 523186, "audio": 0}, {"filename": "/data/images/experiments/sklena_02.png", "start": 523186, "end": 526097, "audio": 0}, {"filename": "/data/images/experiments/sklena_03.png", "start": 526097, "end": 529047, "audio": 0}, {"filename": "/data/images/experiments/sklena_04.png", "start": 529047, "end": 532030, "audio": 0}, {"filename": "/data/images/experiments/sklena_05.png", "start": 532030, "end": 534992, "audio": 0}, {"filename": "/data/images/experiments/sklena_06.png", "start": 534992, "end": 537975, "audio": 0}, {"filename": "/data/images/experiments/sklena_07.png", "start": 537975, "end": 540695, "audio": 0}, {"filename": "/data/images/experiments/sklena_08.png", "start": 540695, "end": 543414, "audio": 0}, {"filename": "/data/images/experiments/sklena_09.png", "start": 543414, "end": 546129, "audio": 0}, {"filename": "/data/images/experiments/sklena_10.png", "start": 546129, "end": 548546, "audio": 0}, {"filename": "/data/images/experiments/sklena_11.png", "start": 548546, "end": 550963, "audio": 0}, {"filename": "/data/images/experiments/spodni_tvor_00.png", "start": 550963, "end": 552166, "audio": 0}, {"filename": "/data/images/experiments/spodni_tvor_01.png", "start": 552166, "end": 553385, "audio": 0}, {"filename": "/data/images/experiments/spodni_tvor_02.png", "start": 553385, "end": 554605, "audio": 0}, {"filename": "/data/images/experiments/spodni_tvor_03.png", "start": 554605, "end": 555812, "audio": 0}, {"filename": "/data/images/experiments/spodni_tvor_04.png", "start": 555812, "end": 557010, "audio": 0}, {"filename": "/data/images/experiments/spodni_tvor_05.png", "start": 557010, "end": 558206, "audio": 0}, {"filename": "/data/images/experiments/zk_b_00.png", "start": 558206, "end": 559153, "audio": 0}, {"filename": "/data/images/experiments/zk_b_01.png", "start": 559153, "end": 560149, "audio": 0}, {"filename": "/data/images/experiments/zk_b_02.png", "start": 560149, "end": 561123, "audio": 0}, {"filename": "/data/images/experiments/zk_c_00.png", "start": 561123, "end": 562097, "audio": 0}, {"filename": "/data/images/experiments/zk_c_01.png", "start": 562097, "end": 563124, "audio": 0}, {"filename": "/data/images/experiments/zk_c_02.png", "start": 563124, "end": 564144, "audio": 0}, {"filename": "/data/images/experiments/zk_f_00.png", "start": 564144, "end": 565110, "audio": 0}, {"filename": "/data/images/experiments/zk_f_01.png", "start": 565110, "end": 566123, "audio": 0}, {"filename": "/data/images/experiments/zk_f_02.png", "start": 566123, "end": 567122, "audio": 0}, {"filename": "/data/images/experiments/zk_lezici.png", "start": 567122, "end": 567990, "audio": 0}, {"filename": "/data/images/experiments/zk_m_00.png", "start": 567990, "end": 568935, "audio": 0}, {"filename": "/data/images/experiments/zk_m_01.png", "start": 568935, "end": 569912, "audio": 0}, {"filename": "/data/images/experiments/zk_m_02.png", "start": 569912, "end": 570893, "audio": 0}, {"filename": "/data/images/experiments/zk_o_00.png", "start": 570893, "end": 571869, "audio": 0}, {"filename": "/data/images/experiments/zk_o_01.png", "start": 571869, "end": 572895, "audio": 0}, {"filename": "/data/images/experiments/zk_o_02.png", "start": 572895, "end": 573924, "audio": 0}, {"filename": "/data/images/experiments/zk_r_00.png", "start": 573924, "end": 574905, "audio": 0}, {"filename": "/data/images/experiments/zk_r_01.png", "start": 574905, "end": 575932, "audio": 0}, {"filename": "/data/images/experiments/zk_r_02.png", "start": 575932, "end": 576954, "audio": 0}, {"filename": "/data/images/experiments/zk_y.png", "start": 576954, "end": 577923, "audio": 0}, {"filename": "/data/images/experiments/zk_zd_00.png", "start": 577923, "end": 578867, "audio": 0}, {"filename": "/data/images/experiments/zk_zd_01.png", "start": 578867, "end": 579866, "audio": 0}, {"filename": "/data/images/experiments/zk_zd_02.png", "start": 579866, "end": 580866, "audio": 0}, {"filename": "/data/images/experiments/zk_z.png", "start": 580866, "end": 581810, "audio": 0}, {"filename": "/data/script/experiments/code.lua", "start": 581810, "end": 626113, "audio": 0}, {"filename": "/data/script/experiments/dialogs_bg.lua", "start": 626113, "end": 631782, "audio": 0}, {"filename": "/data/script/experiments/dialogs_cs.lua", "start": 631782, "end": 636470, "audio": 0}, {"filename": "/data/script/experiments/dialogs_de_CH.lua", "start": 636470, "end": 636620, "audio": 0}, {"filename": "/data/script/experiments/dialogs_de.lua", "start": 636620, "end": 641355, "audio": 0}, {"filename": "/data/script/experiments/dialogs_en.lua", "start": 641355, "end": 644262, "audio": 0}, {"filename": "/data/script/experiments/dialogs_es.lua", "start": 644262, "end": 649108, "audio": 0}, {"filename": "/data/script/experiments/dialogs_fr.lua", "start": 649108, "end": 653937, "audio": 0}, {"filename": "/data/script/experiments/dialogs_it.lua", "start": 653937, "end": 658680, "audio": 0}, {"filename": "/data/script/experiments/dialogs.lua", "start": 658680, "end": 658718, "audio": 0}, {"filename": "/data/script/experiments/dialogs_nl.lua", "start": 658718, "end": 663481, "audio": 0}, {"filename": "/data/script/experiments/dialogs_pl.lua", "start": 663481, "end": 668207, "audio": 0}, {"filename": "/data/script/experiments/dialogs_ru.lua", "start": 668207, "end": 673822, "audio": 0}, {"filename": "/data/script/experiments/dialogs_sv.lua", "start": 673822, "end": 678622, "audio": 0}, {"filename": "/data/script/experiments/init.lua", "start": 678622, "end": 679272, "audio": 0}, {"filename": "/data/script/experiments/models.lua", "start": 679272, "end": 690929, "audio": 0}, {"filename": "/data/script/experiments/prog_pld.lua", "start": 690929, "end": 706656, "audio": 0}, {"filename": "/data/sound/experiments/cs/bank-m-bojim.ogg", "start": 706656, "end": 724387, "audio": 1}, {"filename": "/data/sound/experiments/cs/bank-m-fuj.ogg", "start": 724387, "end": 734091, "audio": 1}, {"filename": "/data/sound/experiments/cs/bank-m-hlavakolem.ogg", "start": 734091, "end": 755404, "audio": 1}, {"filename": "/data/sound/experiments/cs/bank-m-jejda.ogg", "start": 755404, "end": 770967, "audio": 1}, {"filename": "/data/sound/experiments/cs/bank-m-kouka.ogg", "start": 770967, "end": 789003, "audio": 1}, {"filename": "/data/sound/experiments/cs/bank-m-labolator1.ogg", "start": 789003, "end": 806972, "audio": 1}, {"filename": "/data/sound/experiments/cs/bank-m-labolator2.ogg", "start": 806972, "end": 834583, "audio": 1}, {"filename": "/data/sound/experiments/cs/bank-m-labolator3.ogg", "start": 834583, "end": 852112, "audio": 1}, {"filename": "/data/sound/experiments/cs/bank-m-mrtvolka.ogg", "start": 852112, "end": 869525, "audio": 1}, {"filename": "/data/sound/experiments/cs/bank-m-nerus.ogg", "start": 869525, "end": 889084, "audio": 1}, {"filename": "/data/sound/experiments/cs/bank-m-nervozni.ogg", "start": 889084, "end": 907062, "audio": 1}, {"filename": "/data/sound/experiments/cs/bank-m-nesetkala.ogg", "start": 907062, "end": 928517, "audio": 1}, {"filename": "/data/sound/experiments/cs/bank-m-ocicka.ogg", "start": 928517, "end": 942157, "audio": 1}, {"filename": "/data/sound/experiments/cs/bank-m-organismy.ogg", "start": 942157, "end": 973104, "audio": 1}, {"filename": "/data/sound/experiments/cs/bank-m-prehnal1.ogg", "start": 973104, "end": 987470, "audio": 1}, {"filename": "/data/sound/experiments/cs/bank-m-prehnal2.ogg", "start": 987470, "end": 1007038, "audio": 1}, {"filename": "/data/sound/experiments/cs/bank-m-prohlednout.ogg", "start": 1007038, "end": 1025727, "audio": 1}, {"filename": "/data/sound/experiments/cs/bank-m-rozbila.ogg", "start": 1025727, "end": 1044176, "audio": 1}, {"filename": "/data/sound/experiments/cs/bank-m-tvorove.ogg", "start": 1044176, "end": 1077553, "audio": 1}, {"filename": "/data/sound/experiments/cs/bank-m-zkumavka.ogg", "start": 1077553, "end": 1094749, "audio": 1}, {"filename": "/data/sound/experiments/cs/bank-v-flaska.ogg", "start": 1094749, "end": 1111466, "audio": 1}, {"filename": "/data/sound/experiments/cs/bank-v-jeste.ogg", "start": 1111466, "end": 1121777, "audio": 1}, {"filename": "/data/sound/experiments/cs/bank-v-mnozeni.ogg", "start": 1121777, "end": 1142034, "audio": 1}, {"filename": "/data/sound/experiments/cs/bank-v-nahazet.ogg", "start": 1142034, "end": 1164481, "audio": 1}, {"filename": "/data/sound/experiments/cs/bank-v-neproplavu1.ogg", "start": 1164481, "end": 1189383, "audio": 1}, {"filename": "/data/sound/experiments/cs/bank-v-neproplavu2.ogg", "start": 1189383, "end": 1211737, "audio": 1}, {"filename": "/data/sound/experiments/cs/bank-v-pokusy1.ogg", "start": 1211737, "end": 1237866, "audio": 1}, {"filename": "/data/sound/experiments/cs/bank-v-pokusy2.ogg", "start": 1237866, "end": 1262315, "audio": 1}, {"filename": "/data/sound/experiments/cs/bank-v-pomoc.ogg", "start": 1262315, "end": 1283746, "audio": 1}, {"filename": "/data/sound/experiments/cs/bank-v-potvory.ogg", "start": 1283746, "end": 1308226, "audio": 1}, {"filename": "/data/sound/experiments/cs/bank-v-vypad1.ogg", "start": 1308226, "end": 1325670, "audio": 1}, {"filename": "/data/sound/experiments/cs/bank-v-vypad2.ogg", "start": 1325670, "end": 1343207, "audio": 1}, {"filename": "/data/sound/experiments/cs/bank-v-zije.ogg", "start": 1343207, "end": 1357016, "audio": 1}, {"filename": "/data/sound/experiments/nl/bank-m-bojim.ogg", "start": 1357016, "end": 1382350, "audio": 1}, {"filename": "/data/sound/experiments/nl/bank-m-fuj.ogg", "start": 1382350, "end": 1395777, "audio": 1}, {"filename": "/data/sound/experiments/nl/bank-m-hlavakolem.ogg", "start": 1395777, "end": 1415381, "audio": 1}, {"filename": "/data/sound/experiments/nl/bank-m-jejda.ogg", "start": 1415381, "end": 1436231, "audio": 1}, {"filename": "/data/sound/experiments/nl/bank-m-kouka.ogg", "start": 1436231, "end": 1457172, "audio": 1}, {"filename": "/data/sound/experiments/nl/bank-m-labolator1.ogg", "start": 1457172, "end": 1479199, "audio": 1}, {"filename": "/data/sound/experiments/nl/bank-m-labolator2.ogg", "start": 1479199, "end": 1505831, "audio": 1}, {"filename": "/data/sound/experiments/nl/bank-m-labolator3.ogg", "start": 1505831, "end": 1525835, "audio": 1}, {"filename": "/data/sound/experiments/nl/bank-m-mrtvolka.ogg", "start": 1525835, "end": 1545664, "audio": 1}, {"filename": "/data/sound/experiments/nl/bank-m-nerus.ogg", "start": 1545664, "end": 1566437, "audio": 1}, {"filename": "/data/sound/experiments/nl/bank-m-nervozni.ogg", "start": 1566437, "end": 1585939, "audio": 1}, {"filename": "/data/sound/experiments/nl/bank-m-nesetkala.ogg", "start": 1585939, "end": 1609183, "audio": 1}, {"filename": "/data/sound/experiments/nl/bank-m-ocicka.ogg", "start": 1609183, "end": 1630222, "audio": 1}, {"filename": "/data/sound/experiments/nl/bank-m-organismy.ogg", "start": 1630222, "end": 1664381, "audio": 1}, {"filename": "/data/sound/experiments/nl/bank-m-prehnal1.ogg", "start": 1664381, "end": 1683135, "audio": 1}, {"filename": "/data/sound/experiments/nl/bank-m-prehnal2.ogg", "start": 1683135, "end": 1702141, "audio": 1}, {"filename": "/data/sound/experiments/nl/bank-m-prohlednout.ogg", "start": 1702141, "end": 1723235, "audio": 1}, {"filename": "/data/sound/experiments/nl/bank-m-rozbila.ogg", "start": 1723235, "end": 1742562, "audio": 1}, {"filename": "/data/sound/experiments/nl/bank-m-tvorove.ogg", "start": 1742562, "end": 1774859, "audio": 1}, {"filename": "/data/sound/experiments/nl/bank-m-zkumavka.ogg", "start": 1774859, "end": 1799928, "audio": 1}, {"filename": "/data/sound/experiments/nl/bank-v-flaska.ogg", "start": 1799928, "end": 1821235, "audio": 1}, {"filename": "/data/sound/experiments/nl/bank-v-jeste.ogg", "start": 1821235, "end": 1833568, "audio": 1}, {"filename": "/data/sound/experiments/nl/bank-v-mnozeni.ogg", "start": 1833568, "end": 1856796, "audio": 1}, {"filename": "/data/sound/experiments/nl/bank-v-nahazet.ogg", "start": 1856796, "end": 1879805, "audio": 1}, {"filename": "/data/sound/experiments/nl/bank-v-neproplavu1.ogg", "start": 1879805, "end": 1908230, "audio": 1}, {"filename": "/data/sound/experiments/nl/bank-v-neproplavu2.ogg", "start": 1908230, "end": 1935840, "audio": 1}, {"filename": "/data/sound/experiments/nl/bank-v-pokusy1.ogg", "start": 1935840, "end": 1961170, "audio": 1}, {"filename": "/data/sound/experiments/nl/bank-v-pokusy2.ogg", "start": 1961170, "end": 1987318, "audio": 1}, {"filename": "/data/sound/experiments/nl/bank-v-pomoc.ogg", "start": 1987318, "end": 2012454, "audio": 1}, {"filename": "/data/sound/experiments/nl/bank-v-potvory.ogg", "start": 2012454, "end": 2037213, "audio": 1}, {"filename": "/data/sound/experiments/nl/bank-v-vypad1.ogg", "start": 2037213, "end": 2051587, "audio": 1}, {"filename": "/data/sound/experiments/nl/bank-v-vypad2.ogg", "start": 2051587, "end": 2071144, "audio": 1}, {"filename": "/data/sound/experiments/nl/bank-v-zije.ogg", "start": 2071144, "end": 2088214, "audio": 1}], "remote_package_size": 2088214, "package_uuid": "10f23133-f909-498b-ac66-c84eb7c7a129"});

})();
