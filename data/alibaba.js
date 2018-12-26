
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
    var PACKAGE_NAME = 'web/data/alibaba.data';
    var REMOTE_PACKAGE_BASE = 'data/alibaba.data';
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
Module['FS_createPath']('/data/images', 'alibaba', true, true);
Module['FS_createPath']('/data', 'script', true, true);
Module['FS_createPath']('/data/script', 'alibaba', true, true);
Module['FS_createPath']('/data', 'sound', true, true);
Module['FS_createPath']('/data/sound', 'alibaba', true, true);
Module['FS_createPath']('/data/sound/alibaba', 'cs', true, true);
Module['FS_createPath']('/data/sound/alibaba', 'nl', true, true);

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
              Module['removeRunDependency']('datafile_web/data/alibaba.data');

    };
    Module['addRunDependency']('datafile_web/data/alibaba.data');
  
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
 loadPackage({"files": [{"filename": "/data/images/alibaba/3-ocel.png", "start": 0, "end": 877, "audio": 0}, {"filename": "/data/images/alibaba/7-ocel.png", "start": 877, "end": 1808, "audio": 0}, {"filename": "/data/images/alibaba/amfora-a.png", "start": 1808, "end": 2871, "audio": 0}, {"filename": "/data/images/alibaba/amfora_cervena-a.png", "start": 2871, "end": 3912, "audio": 0}, {"filename": "/data/images/alibaba/amfora.png", "start": 3912, "end": 4953, "audio": 0}, {"filename": "/data/images/alibaba/amfora_zelena-a.png", "start": 4953, "end": 5890, "audio": 0}, {"filename": "/data/images/alibaba/amfora_zelena.png", "start": 5890, "end": 6790, "audio": 0}, {"filename": "/data/images/alibaba/drahokam_00.png", "start": 6790, "end": 7965, "audio": 0}, {"filename": "/data/images/alibaba/drahokam_01.png", "start": 7965, "end": 9131, "audio": 0}, {"filename": "/data/images/alibaba/drahokam_02.png", "start": 9131, "end": 10280, "audio": 0}, {"filename": "/data/images/alibaba/drahokam_03.png", "start": 10280, "end": 11407, "audio": 0}, {"filename": "/data/images/alibaba/drahokam_04.png", "start": 11407, "end": 12574, "audio": 0}, {"filename": "/data/images/alibaba/drahokam_05.png", "start": 12574, "end": 13724, "audio": 0}, {"filename": "/data/images/alibaba/drahokam_b_00.png", "start": 13724, "end": 14996, "audio": 0}, {"filename": "/data/images/alibaba/drahokam_b_01.png", "start": 14996, "end": 16256, "audio": 0}, {"filename": "/data/images/alibaba/knihovna-zed1.png", "start": 16256, "end": 252398, "audio": 0}, {"filename": "/data/images/alibaba/koruna_00.png", "start": 252398, "end": 254456, "audio": 0}, {"filename": "/data/images/alibaba/koruna_01.png", "start": 254456, "end": 256517, "audio": 0}, {"filename": "/data/images/alibaba/koruna_02.png", "start": 256517, "end": 258573, "audio": 0}, {"filename": "/data/images/alibaba/koruna_03.png", "start": 258573, "end": 260616, "audio": 0}, {"filename": "/data/images/alibaba/koruna_04.png", "start": 260616, "end": 262683, "audio": 0}, {"filename": "/data/images/alibaba/koruna_05.png", "start": 262683, "end": 264753, "audio": 0}, {"filename": "/data/images/alibaba/krystal_00.png", "start": 264753, "end": 265365, "audio": 0}, {"filename": "/data/images/alibaba/krystal_01.png", "start": 265365, "end": 265971, "audio": 0}, {"filename": "/data/images/alibaba/krystal_02.png", "start": 265971, "end": 266567, "audio": 0}, {"filename": "/data/images/alibaba/krystal_03.png", "start": 266567, "end": 267143, "audio": 0}, {"filename": "/data/images/alibaba/krystal_04.png", "start": 267143, "end": 267809, "audio": 0}, {"filename": "/data/images/alibaba/krystal_05.png", "start": 267809, "end": 268478, "audio": 0}, {"filename": "/data/images/alibaba/krystal_06.png", "start": 268478, "end": 269154, "audio": 0}, {"filename": "/data/images/alibaba/krystal_07.png", "start": 269154, "end": 269765, "audio": 0}, {"filename": "/data/images/alibaba/krystal_08.png", "start": 269765, "end": 270403, "audio": 0}, {"filename": "/data/images/alibaba/krystal_09.png", "start": 270403, "end": 271040, "audio": 0}, {"filename": "/data/images/alibaba/krystal_10.png", "start": 271040, "end": 271658, "audio": 0}, {"filename": "/data/images/alibaba/krystal_11.png", "start": 271658, "end": 272259, "audio": 0}, {"filename": "/data/images/alibaba/krystal_12.png", "start": 272259, "end": 272927, "audio": 0}, {"filename": "/data/images/alibaba/krystal_13.png", "start": 272927, "end": 273593, "audio": 0}, {"filename": "/data/images/alibaba/krystal_14.png", "start": 273593, "end": 274250, "audio": 0}, {"filename": "/data/images/alibaba/krystal_15.png", "start": 274250, "end": 274873, "audio": 0}, {"filename": "/data/images/alibaba/krystal_16.png", "start": 274873, "end": 275488, "audio": 0}, {"filename": "/data/images/alibaba/krystal_17.png", "start": 275488, "end": 276087, "audio": 0}, {"filename": "/data/images/alibaba/krystal_18.png", "start": 276087, "end": 276659, "audio": 0}, {"filename": "/data/images/alibaba/krystal_19.png", "start": 276659, "end": 277198, "audio": 0}, {"filename": "/data/images/alibaba/krystal_20.png", "start": 277198, "end": 277837, "audio": 0}, {"filename": "/data/images/alibaba/krystal_21.png", "start": 277837, "end": 278475, "audio": 0}, {"filename": "/data/images/alibaba/krystal_22.png", "start": 278475, "end": 279101, "audio": 0}, {"filename": "/data/images/alibaba/krystal_23.png", "start": 279101, "end": 279710, "audio": 0}, {"filename": "/data/images/alibaba/krystal_24.png", "start": 279710, "end": 280334, "audio": 0}, {"filename": "/data/images/alibaba/krystal_25.png", "start": 280334, "end": 280958, "audio": 0}, {"filename": "/data/images/alibaba/krystal_26.png", "start": 280958, "end": 281563, "audio": 0}, {"filename": "/data/images/alibaba/krystal_27.png", "start": 281563, "end": 282155, "audio": 0}, {"filename": "/data/images/alibaba/pohar-a.png", "start": 282155, "end": 283223, "audio": 0}, {"filename": "/data/images/alibaba/pohar.png", "start": 283223, "end": 284303, "audio": 0}, {"filename": "/data/images/alibaba/pozadi.png", "start": 284303, "end": 588915, "audio": 0}, {"filename": "/data/images/alibaba/prsten-_00.png", "start": 588915, "end": 590222, "audio": 0}, {"filename": "/data/images/alibaba/prsten-_01.png", "start": 590222, "end": 591543, "audio": 0}, {"filename": "/data/images/alibaba/prsten-2_00.png", "start": 591543, "end": 592852, "audio": 0}, {"filename": "/data/images/alibaba/prsten-2_01.png", "start": 592852, "end": 594142, "audio": 0}, {"filename": "/data/images/alibaba/prsten-2_02.png", "start": 594142, "end": 595404, "audio": 0}, {"filename": "/data/images/alibaba/prsten-2_03.png", "start": 595404, "end": 596715, "audio": 0}, {"filename": "/data/images/alibaba/prsten-2_04.png", "start": 596715, "end": 598009, "audio": 0}, {"filename": "/data/images/alibaba/prsten-2_05.png", "start": 598009, "end": 599291, "audio": 0}, {"filename": "/data/images/alibaba/prsten-3_00.png", "start": 599291, "end": 600576, "audio": 0}, {"filename": "/data/images/alibaba/prsten-3_01.png", "start": 600576, "end": 601839, "audio": 0}, {"filename": "/data/images/alibaba/prsten-3_02.png", "start": 601839, "end": 603076, "audio": 0}, {"filename": "/data/images/alibaba/prsten-3_03.png", "start": 603076, "end": 604355, "audio": 0}, {"filename": "/data/images/alibaba/prsten-3_04.png", "start": 604355, "end": 605624, "audio": 0}, {"filename": "/data/images/alibaba/prsten-3_05.png", "start": 605624, "end": 606909, "audio": 0}, {"filename": "/data/images/alibaba/prsten-4.png", "start": 606909, "end": 608219, "audio": 0}, {"filename": "/data/images/alibaba/svicen.png", "start": 608219, "end": 609408, "audio": 0}, {"filename": "/data/images/alibaba/vaza_cervena-a.png", "start": 609408, "end": 610264, "audio": 0}, {"filename": "/data/images/alibaba/vaza_cervena.png", "start": 610264, "end": 611115, "audio": 0}, {"filename": "/data/images/alibaba/vazav1.png", "start": 611115, "end": 612330, "audio": 0}, {"filename": "/data/images/alibaba/vazav.png", "start": 612330, "end": 613564, "audio": 0}, {"filename": "/data/script/alibaba/code.lua", "start": 613564, "end": 623448, "audio": 0}, {"filename": "/data/script/alibaba/dialogs_bg.lua", "start": 623448, "end": 626215, "audio": 0}, {"filename": "/data/script/alibaba/dialogs_cs.lua", "start": 626215, "end": 628485, "audio": 0}, {"filename": "/data/script/alibaba/dialogs_de_CH.lua", "start": 628485, "end": 628992, "audio": 0}, {"filename": "/data/script/alibaba/dialogs_de.lua", "start": 628992, "end": 631260, "audio": 0}, {"filename": "/data/script/alibaba/dialogs_en.lua", "start": 631260, "end": 632606, "audio": 0}, {"filename": "/data/script/alibaba/dialogs_es.lua", "start": 632606, "end": 634923, "audio": 0}, {"filename": "/data/script/alibaba/dialogs_fr.lua", "start": 634923, "end": 637244, "audio": 0}, {"filename": "/data/script/alibaba/dialogs_it.lua", "start": 637244, "end": 639459, "audio": 0}, {"filename": "/data/script/alibaba/dialogs.lua", "start": 639459, "end": 639497, "audio": 0}, {"filename": "/data/script/alibaba/dialogs_nl.lua", "start": 639497, "end": 641757, "audio": 0}, {"filename": "/data/script/alibaba/dialogs_pl.lua", "start": 641757, "end": 643977, "audio": 0}, {"filename": "/data/script/alibaba/dialogs_ru.lua", "start": 643977, "end": 646798, "audio": 0}, {"filename": "/data/script/alibaba/dialogs_sv.lua", "start": 646798, "end": 649055, "audio": 0}, {"filename": "/data/script/alibaba/init.lua", "start": 649055, "end": 649701, "audio": 0}, {"filename": "/data/script/alibaba/models.lua", "start": 649701, "end": 656872, "audio": 0}, {"filename": "/data/sound/alibaba/cs/kni-m-amfornictvi.ogg", "start": 656872, "end": 675633, "audio": 1}, {"filename": "/data/sound/alibaba/cs/kni-m-cetky.ogg", "start": 675633, "end": 701232, "audio": 1}, {"filename": "/data/sound/alibaba/cs/kni-m-hrncirstvi.ogg", "start": 701232, "end": 719983, "audio": 1}, {"filename": "/data/sound/alibaba/cs/kni-m-hromado.ogg", "start": 719983, "end": 752619, "audio": 1}, {"filename": "/data/sound/alibaba/cs/kni-m-kramy.ogg", "start": 752619, "end": 769889, "audio": 1}, {"filename": "/data/sound/alibaba/cs/kni-m-mise.ogg", "start": 769889, "end": 799298, "audio": 1}, {"filename": "/data/sound/alibaba/cs/kni-m-svicny.ogg", "start": 799298, "end": 826234, "audio": 1}, {"filename": "/data/sound/alibaba/cs/kni-m-tloustka.ogg", "start": 826234, "end": 851493, "audio": 1}, {"filename": "/data/sound/alibaba/cs/kni-v-amforstvi.ogg", "start": 851493, "end": 867999, "audio": 1}, {"filename": "/data/sound/alibaba/cs/kni-v-ber.ogg", "start": 867999, "end": 901481, "audio": 1}, {"filename": "/data/sound/alibaba/cs/kni-v-padavko.ogg", "start": 901481, "end": 920053, "audio": 1}, {"filename": "/data/sound/alibaba/cs/kni-v-proc.ogg", "start": 920053, "end": 930598, "audio": 1}, {"filename": "/data/sound/alibaba/cs/kni-v-prolezt.ogg", "start": 930598, "end": 957095, "audio": 1}, {"filename": "/data/sound/alibaba/cs/kni-v-vypni.ogg", "start": 957095, "end": 988768, "audio": 1}, {"filename": "/data/sound/alibaba/nl/kni-m-amfornictvi.ogg", "start": 988768, "end": 1011309, "audio": 1}, {"filename": "/data/sound/alibaba/nl/kni-m-cetky.ogg", "start": 1011309, "end": 1040168, "audio": 1}, {"filename": "/data/sound/alibaba/nl/kni-m-hrncirstvi.ogg", "start": 1040168, "end": 1062770, "audio": 1}, {"filename": "/data/sound/alibaba/nl/kni-m-hromado.ogg", "start": 1062770, "end": 1088068, "audio": 1}, {"filename": "/data/sound/alibaba/nl/kni-m-kramy.ogg", "start": 1088068, "end": 1107850, "audio": 1}, {"filename": "/data/sound/alibaba/nl/kni-m-mise.ogg", "start": 1107850, "end": 1136365, "audio": 1}, {"filename": "/data/sound/alibaba/nl/kni-m-svicny.ogg", "start": 1136365, "end": 1166385, "audio": 1}, {"filename": "/data/sound/alibaba/nl/kni-m-tloustka.ogg", "start": 1166385, "end": 1188344, "audio": 1}, {"filename": "/data/sound/alibaba/nl/kni-v-amforstvi.ogg", "start": 1188344, "end": 1211730, "audio": 1}, {"filename": "/data/sound/alibaba/nl/kni-v-ber.ogg", "start": 1211730, "end": 1244883, "audio": 1}, {"filename": "/data/sound/alibaba/nl/kni-v-padavko.ogg", "start": 1244883, "end": 1271523, "audio": 1}, {"filename": "/data/sound/alibaba/nl/kni-v-proc.ogg", "start": 1271523, "end": 1286984, "audio": 1}, {"filename": "/data/sound/alibaba/nl/kni-v-prolezt.ogg", "start": 1286984, "end": 1315703, "audio": 1}, {"filename": "/data/sound/alibaba/nl/kni-v-vypni.ogg", "start": 1315703, "end": 1345314, "audio": 1}], "remote_package_size": 1345314, "package_uuid": "aeddd649-a395-427c-94d8-2883cb813d31"});

})();
