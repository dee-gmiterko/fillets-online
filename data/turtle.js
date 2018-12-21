
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
    var PACKAGE_NAME = 'web/data/turtle.data';
    var REMOTE_PACKAGE_BASE = 'data/turtle.data';
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
Module['FS_createPath']('/data/images', 'turtle', true, true);
Module['FS_createPath']('/data', 'script', true, true);
Module['FS_createPath']('/data/script', 'turtle', true, true);
Module['FS_createPath']('/data', 'sound', true, true);
Module['FS_createPath']('/data/sound', 'turtle', true, true);
Module['FS_createPath']('/data/sound/turtle', 'cs', true, true);
Module['FS_createPath']('/data/sound/turtle', 'nl', true, true);

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
              Module['removeRunDependency']('datafile_web/data/turtle.data');

    };
    Module['addRunDependency']('datafile_web/data/turtle.data');
  
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
 loadPackage({"files": [{"filename": "/data/images/turtle/14-ocel.png", "start": 0, "end": 696, "audio": 0}, {"filename": "/data/images/turtle/15-ocel.png", "start": 696, "end": 1563, "audio": 0}, {"filename": "/data/images/turtle/16-ocel.png", "start": 1563, "end": 2483, "audio": 0}, {"filename": "/data/images/turtle/17-ocel.png", "start": 2483, "end": 3974, "audio": 0}, {"filename": "/data/images/turtle/20-ocel.png", "start": 3974, "end": 6416, "audio": 0}, {"filename": "/data/images/turtle/24-ocel.png", "start": 6416, "end": 8271, "audio": 0}, {"filename": "/data/images/turtle/25-ocel.png", "start": 8271, "end": 8967, "audio": 0}, {"filename": "/data/images/turtle/3-ocel.png", "start": 8967, "end": 11958, "audio": 0}, {"filename": "/data/images/turtle/5-ocel.png", "start": 11958, "end": 13700, "audio": 0}, {"filename": "/data/images/turtle/koral10.png", "start": 13700, "end": 24657, "audio": 0}, {"filename": "/data/images/turtle/koral1.png", "start": 24657, "end": 34503, "audio": 0}, {"filename": "/data/images/turtle/koral2.png", "start": 34503, "end": 41621, "audio": 0}, {"filename": "/data/images/turtle/koral3.png", "start": 41621, "end": 44672, "audio": 0}, {"filename": "/data/images/turtle/koral4.png", "start": 44672, "end": 50477, "audio": 0}, {"filename": "/data/images/turtle/koral5.png", "start": 50477, "end": 56783, "audio": 0}, {"filename": "/data/images/turtle/koral6.png", "start": 56783, "end": 65338, "audio": 0}, {"filename": "/data/images/turtle/koral7.png", "start": 65338, "end": 68092, "audio": 0}, {"filename": "/data/images/turtle/koral8.png", "start": 68092, "end": 71594, "audio": 0}, {"filename": "/data/images/turtle/koral9.png", "start": 71594, "end": 76598, "audio": 0}, {"filename": "/data/images/turtle/musle_troj.png", "start": 76598, "end": 78142, "audio": 0}, {"filename": "/data/images/turtle/perla_00.png", "start": 78142, "end": 78682, "audio": 0}, {"filename": "/data/images/turtle/perla_01.png", "start": 78682, "end": 79237, "audio": 0}, {"filename": "/data/images/turtle/perla_02.png", "start": 79237, "end": 79792, "audio": 0}, {"filename": "/data/images/turtle/perla_03.png", "start": 79792, "end": 80346, "audio": 0}, {"filename": "/data/images/turtle/poster.png", "start": 80346, "end": 211390, "audio": 0}, {"filename": "/data/images/turtle/rybicka_h_00.png", "start": 211390, "end": 212536, "audio": 0}, {"filename": "/data/images/turtle/rybicka_h_01.png", "start": 212536, "end": 213696, "audio": 0}, {"filename": "/data/images/turtle/rybicka_h_02.png", "start": 213696, "end": 214847, "audio": 0}, {"filename": "/data/images/turtle/rybicka_h_03.png", "start": 214847, "end": 215973, "audio": 0}, {"filename": "/data/images/turtle/z-_00.png", "start": 215973, "end": 223482, "audio": 0}, {"filename": "/data/images/turtle/z-_01.png", "start": 223482, "end": 230904, "audio": 0}, {"filename": "/data/images/turtle/z-_02.png", "start": 230904, "end": 238436, "audio": 0}, {"filename": "/data/images/turtle/z-_03.png", "start": 238436, "end": 245885, "audio": 0}, {"filename": "/data/images/turtle/z-_04.png", "start": 245885, "end": 253408, "audio": 0}, {"filename": "/data/images/turtle/z-_05.png", "start": 253408, "end": 260845, "audio": 0}, {"filename": "/data/images/turtle/z-_06.png", "start": 260845, "end": 268405, "audio": 0}, {"filename": "/data/images/turtle/z-_07.png", "start": 268405, "end": 275885, "audio": 0}, {"filename": "/data/images/turtle/z-_08.png", "start": 275885, "end": 283636, "audio": 0}, {"filename": "/data/images/turtle/z-_09.png", "start": 283636, "end": 291382, "audio": 0}, {"filename": "/data/images/turtle/z-_10.png", "start": 291382, "end": 299136, "audio": 0}, {"filename": "/data/images/turtle/z-_11.png", "start": 299136, "end": 306887, "audio": 0}, {"filename": "/data/images/turtle/z-_12.png", "start": 306887, "end": 314455, "audio": 0}, {"filename": "/data/images/turtle/z-_13.png", "start": 314455, "end": 321782, "audio": 0}, {"filename": "/data/images/turtle/z-_14.png", "start": 321782, "end": 329118, "audio": 0}, {"filename": "/data/images/turtle/z-_15.png", "start": 329118, "end": 336401, "audio": 0}, {"filename": "/data/images/turtle/z-_16.png", "start": 336401, "end": 343796, "audio": 0}, {"filename": "/data/images/turtle/z-_17.png", "start": 343796, "end": 351140, "audio": 0}, {"filename": "/data/images/turtle/z-_18.png", "start": 351140, "end": 358536, "audio": 0}, {"filename": "/data/images/turtle/z-_19.png", "start": 358536, "end": 365846, "audio": 0}, {"filename": "/data/images/turtle/z-_20.png", "start": 365846, "end": 373135, "audio": 0}, {"filename": "/data/images/turtle/z-_21.png", "start": 373135, "end": 380488, "audio": 0}, {"filename": "/data/images/turtle/z-_22.png", "start": 380488, "end": 387812, "audio": 0}, {"filename": "/data/images/turtle/z-_23.png", "start": 387812, "end": 395242, "audio": 0}, {"filename": "/data/images/turtle/z-_24.png", "start": 395242, "end": 402617, "audio": 0}, {"filename": "/data/images/turtle/z-_25.png", "start": 402617, "end": 409949, "audio": 0}, {"filename": "/data/images/turtle/z-_26.png", "start": 409949, "end": 417252, "audio": 0}, {"filename": "/data/images/turtle/z-_27.png", "start": 417252, "end": 424673, "audio": 0}, {"filename": "/data/images/turtle/z-_28.png", "start": 424673, "end": 432035, "audio": 0}, {"filename": "/data/images/turtle/z-_29.png", "start": 432035, "end": 439514, "audio": 0}, {"filename": "/data/images/turtle/z-_30.png", "start": 439514, "end": 446930, "audio": 0}, {"filename": "/data/images/turtle/z-_31.png", "start": 446930, "end": 454436, "audio": 0}, {"filename": "/data/images/turtle/z-_32.png", "start": 454436, "end": 461930, "audio": 0}, {"filename": "/data/images/turtle/z-_33.png", "start": 461930, "end": 469458, "audio": 0}, {"filename": "/data/images/turtle/z-_34.png", "start": 469458, "end": 476979, "audio": 0}, {"filename": "/data/images/turtle/z-_35.png", "start": 476979, "end": 484397, "audio": 0}, {"filename": "/data/images/turtle/z-_36.png", "start": 484397, "end": 491706, "audio": 0}, {"filename": "/data/images/turtle/z-_37.png", "start": 491706, "end": 499064, "audio": 0}, {"filename": "/data/images/turtle/z-_38.png", "start": 499064, "end": 506385, "audio": 0}, {"filename": "/data/images/turtle/z-_39.png", "start": 506385, "end": 513653, "audio": 0}, {"filename": "/data/images/turtle/z-_40.png", "start": 513653, "end": 520981, "audio": 0}, {"filename": "/data/images/turtle/z-_41.png", "start": 520981, "end": 528346, "audio": 0}, {"filename": "/data/images/turtle/z-_42.png", "start": 528346, "end": 535689, "audio": 0}, {"filename": "/data/images/turtle/z-_43.png", "start": 535689, "end": 542994, "audio": 0}, {"filename": "/data/images/turtle/z-_44.png", "start": 542994, "end": 550304, "audio": 0}, {"filename": "/data/images/turtle/z-_45.png", "start": 550304, "end": 557694, "audio": 0}, {"filename": "/data/images/turtle/zelva-p.png", "start": 557694, "end": 725896, "audio": 0}, {"filename": "/data/images/turtle/zelva-w.png", "start": 725896, "end": 905519, "audio": 0}, {"filename": "/data/script/turtle/code.lua", "start": 905519, "end": 928303, "audio": 0}, {"filename": "/data/script/turtle/demo_dialogs_bg.lua", "start": 928303, "end": 929428, "audio": 0}, {"filename": "/data/script/turtle/demo_dialogs_cs.lua", "start": 929428, "end": 929957, "audio": 0}, {"filename": "/data/script/turtle/demo_dialogs_de_CH.lua", "start": 929957, "end": 930238, "audio": 0}, {"filename": "/data/script/turtle/demo_dialogs_de.lua", "start": 930238, "end": 931185, "audio": 0}, {"filename": "/data/script/turtle/demo_dialogs_en.lua", "start": 931185, "end": 931669, "audio": 0}, {"filename": "/data/script/turtle/demo_dialogs_es.lua", "start": 931669, "end": 932613, "audio": 0}, {"filename": "/data/script/turtle/demo_dialogs_fr.lua", "start": 932613, "end": 933590, "audio": 0}, {"filename": "/data/script/turtle/demo_dialogs_it.lua", "start": 933590, "end": 934492, "audio": 0}, {"filename": "/data/script/turtle/demo_dialogs_nl.lua", "start": 934492, "end": 935379, "audio": 0}, {"filename": "/data/script/turtle/demo_dialogs_pl.lua", "start": 935379, "end": 936340, "audio": 0}, {"filename": "/data/script/turtle/demo_dialogs_ru.lua", "start": 936340, "end": 937494, "audio": 0}, {"filename": "/data/script/turtle/demo_dialogs_sv.lua", "start": 937494, "end": 938384, "audio": 0}, {"filename": "/data/script/turtle/demo_poster.lua", "start": 938384, "end": 938764, "audio": 0}, {"filename": "/data/script/turtle/dialogs_bg.lua", "start": 938764, "end": 943416, "audio": 0}, {"filename": "/data/script/turtle/dialogs_cs.lua", "start": 943416, "end": 947380, "audio": 0}, {"filename": "/data/script/turtle/dialogs_de_CH.lua", "start": 947380, "end": 947911, "audio": 0}, {"filename": "/data/script/turtle/dialogs_de.lua", "start": 947911, "end": 951985, "audio": 0}, {"filename": "/data/script/turtle/dialogs_en.lua", "start": 951985, "end": 954411, "audio": 0}, {"filename": "/data/script/turtle/dialogs_es.lua", "start": 954411, "end": 958441, "audio": 0}, {"filename": "/data/script/turtle/dialogs_fr.lua", "start": 958441, "end": 962633, "audio": 0}, {"filename": "/data/script/turtle/dialogs_it.lua", "start": 962633, "end": 966596, "audio": 0}, {"filename": "/data/script/turtle/dialogs.lua", "start": 966596, "end": 966634, "audio": 0}, {"filename": "/data/script/turtle/dialogs_nl.lua", "start": 966634, "end": 970712, "audio": 0}, {"filename": "/data/script/turtle/dialogs_pl.lua", "start": 970712, "end": 974690, "audio": 0}, {"filename": "/data/script/turtle/dialogs_ru.lua", "start": 974690, "end": 979298, "audio": 0}, {"filename": "/data/script/turtle/dialogs_sv.lua", "start": 979298, "end": 983281, "audio": 0}, {"filename": "/data/script/turtle/init.lua", "start": 983281, "end": 983926, "audio": 0}, {"filename": "/data/script/turtle/models.lua", "start": 983926, "end": 989505, "audio": 0}, {"filename": "/data/sound/turtle/cs/zel-m-cimtoje.ogg", "start": 989505, "end": 1006870, "audio": 1}, {"filename": "/data/sound/turtle/cs/zel-m-coto0.ogg", "start": 1006870, "end": 1020970, "audio": 1}, {"filename": "/data/sound/turtle/cs/zel-m-coto1.ogg", "start": 1020970, "end": 1035058, "audio": 1}, {"filename": "/data/sound/turtle/cs/zel-m-coto2.ogg", "start": 1035058, "end": 1048379, "audio": 1}, {"filename": "/data/sound/turtle/cs/zel-m-fotky0.ogg", "start": 1048379, "end": 1071959, "audio": 1}, {"filename": "/data/sound/turtle/cs/zel-m-fotky1.ogg", "start": 1071959, "end": 1098736, "audio": 1}, {"filename": "/data/sound/turtle/cs/zel-m-jasne.ogg", "start": 1098736, "end": 1128449, "audio": 1}, {"filename": "/data/sound/turtle/cs/zel-m-jednoduse.ogg", "start": 1128449, "end": 1165610, "audio": 1}, {"filename": "/data/sound/turtle/cs/zel-m-nevim0.ogg", "start": 1165610, "end": 1177448, "audio": 1}, {"filename": "/data/sound/turtle/cs/zel-m-nevim1.ogg", "start": 1177448, "end": 1193440, "audio": 1}, {"filename": "/data/sound/turtle/cs/zel-m-potvora0.ogg", "start": 1193440, "end": 1205712, "audio": 1}, {"filename": "/data/sound/turtle/cs/zel-m-potvora1.ogg", "start": 1205712, "end": 1220210, "audio": 1}, {"filename": "/data/sound/turtle/cs/zel-m-priroda.ogg", "start": 1220210, "end": 1240388, "audio": 1}, {"filename": "/data/sound/turtle/cs/zel-m-tazelva.ogg", "start": 1240388, "end": 1253989, "audio": 1}, {"filename": "/data/sound/turtle/cs/zel-v-bizarni.ogg", "start": 1253989, "end": 1281241, "audio": 1}, {"filename": "/data/sound/turtle/cs/zel-v-cosedeje.ogg", "start": 1281241, "end": 1296977, "audio": 1}, {"filename": "/data/sound/turtle/cs/zel-v-coto0.ogg", "start": 1296977, "end": 1308562, "audio": 1}, {"filename": "/data/sound/turtle/cs/zel-v-coto1.ogg", "start": 1308562, "end": 1322319, "audio": 1}, {"filename": "/data/sound/turtle/cs/zel-v-coto2.ogg", "start": 1322319, "end": 1335759, "audio": 1}, {"filename": "/data/sound/turtle/cs/zel-v-nevim0.ogg", "start": 1335759, "end": 1351602, "audio": 1}, {"filename": "/data/sound/turtle/cs/zel-v-nevim1.ogg", "start": 1351602, "end": 1366824, "audio": 1}, {"filename": "/data/sound/turtle/cs/zel-v-pochyby.ogg", "start": 1366824, "end": 1387647, "audio": 1}, {"filename": "/data/sound/turtle/cs/zel-v-stacit0.ogg", "start": 1387647, "end": 1403926, "audio": 1}, {"filename": "/data/sound/turtle/cs/zel-v-stacit1.ogg", "start": 1403926, "end": 1416855, "audio": 1}, {"filename": "/data/sound/turtle/cs/zel-v-tazelva.ogg", "start": 1416855, "end": 1429636, "audio": 1}, {"filename": "/data/sound/turtle/cs/zel-v-tvary.ogg", "start": 1429636, "end": 1451503, "audio": 1}, {"filename": "/data/sound/turtle/cs/zel-v-ukol.ogg", "start": 1451503, "end": 1473602, "audio": 1}, {"filename": "/data/sound/turtle/cs/zel-v-zelva0.ogg", "start": 1473602, "end": 1502239, "audio": 1}, {"filename": "/data/sound/turtle/cs/zel-v-zelva1.ogg", "start": 1502239, "end": 1528598, "audio": 1}, {"filename": "/data/sound/turtle/cs/zel-v-zmistnosti0.ogg", "start": 1528598, "end": 1547532, "audio": 1}, {"filename": "/data/sound/turtle/cs/zel-v-zmistnosti1.ogg", "start": 1547532, "end": 1564994, "audio": 1}, {"filename": "/data/sound/turtle/nl/zel-m-cimtoje.ogg", "start": 1564994, "end": 1583744, "audio": 1}, {"filename": "/data/sound/turtle/nl/zel-m-coto0.ogg", "start": 1583744, "end": 1598826, "audio": 1}, {"filename": "/data/sound/turtle/nl/zel-m-coto1.ogg", "start": 1598826, "end": 1614768, "audio": 1}, {"filename": "/data/sound/turtle/nl/zel-m-coto2.ogg", "start": 1614768, "end": 1631339, "audio": 1}, {"filename": "/data/sound/turtle/nl/zel-m-fotky0.ogg", "start": 1631339, "end": 1659490, "audio": 1}, {"filename": "/data/sound/turtle/nl/zel-m-fotky1.ogg", "start": 1659490, "end": 1685516, "audio": 1}, {"filename": "/data/sound/turtle/nl/zel-m-jasne.ogg", "start": 1685516, "end": 1713967, "audio": 1}, {"filename": "/data/sound/turtle/nl/zel-m-jednoduse.ogg", "start": 1713967, "end": 1749248, "audio": 1}, {"filename": "/data/sound/turtle/nl/zel-m-nevim0.ogg", "start": 1749248, "end": 1762174, "audio": 1}, {"filename": "/data/sound/turtle/nl/zel-m-nevim1.ogg", "start": 1762174, "end": 1778115, "audio": 1}, {"filename": "/data/sound/turtle/nl/zel-m-potvora0.ogg", "start": 1778115, "end": 1794113, "audio": 1}, {"filename": "/data/sound/turtle/nl/zel-m-potvora1.ogg", "start": 1794113, "end": 1810937, "audio": 1}, {"filename": "/data/sound/turtle/nl/zel-m-priroda.ogg", "start": 1810937, "end": 1831421, "audio": 1}, {"filename": "/data/sound/turtle/nl/zel-m-tazelva.ogg", "start": 1831421, "end": 1849186, "audio": 1}, {"filename": "/data/sound/turtle/nl/zel-v-bizarni.ogg", "start": 1849186, "end": 1873473, "audio": 1}, {"filename": "/data/sound/turtle/nl/zel-v-cosedeje.ogg", "start": 1873473, "end": 1892853, "audio": 1}, {"filename": "/data/sound/turtle/nl/zel-v-coto0.ogg", "start": 1892853, "end": 1910820, "audio": 1}, {"filename": "/data/sound/turtle/nl/zel-v-coto1.ogg", "start": 1910820, "end": 1927742, "audio": 1}, {"filename": "/data/sound/turtle/nl/zel-v-coto2.ogg", "start": 1927742, "end": 1945936, "audio": 1}, {"filename": "/data/sound/turtle/nl/zel-v-nevim0.ogg", "start": 1945936, "end": 1967337, "audio": 1}, {"filename": "/data/sound/turtle/nl/zel-v-nevim1.ogg", "start": 1967337, "end": 1984586, "audio": 1}, {"filename": "/data/sound/turtle/nl/zel-v-pochyby.ogg", "start": 1984586, "end": 2011041, "audio": 1}, {"filename": "/data/sound/turtle/nl/zel-v-stacit0.ogg", "start": 2011041, "end": 2029446, "audio": 1}, {"filename": "/data/sound/turtle/nl/zel-v-stacit1.ogg", "start": 2029446, "end": 2047055, "audio": 1}, {"filename": "/data/sound/turtle/nl/zel-v-tazelva.ogg", "start": 2047055, "end": 2068245, "audio": 1}, {"filename": "/data/sound/turtle/nl/zel-v-tvary.ogg", "start": 2068245, "end": 2090410, "audio": 1}, {"filename": "/data/sound/turtle/nl/zel-v-ukol.ogg", "start": 2090410, "end": 2119177, "audio": 1}, {"filename": "/data/sound/turtle/nl/zel-v-zelva0.ogg", "start": 2119177, "end": 2145006, "audio": 1}, {"filename": "/data/sound/turtle/nl/zel-v-zelva1.ogg", "start": 2145006, "end": 2171448, "audio": 1}, {"filename": "/data/sound/turtle/nl/zel-v-zmistnosti0.ogg", "start": 2171448, "end": 2193355, "audio": 1}, {"filename": "/data/sound/turtle/nl/zel-v-zmistnosti1.ogg", "start": 2193355, "end": 2212256, "audio": 1}], "remote_package_size": 2212256, "package_uuid": "ec7edcfa-6d1a-47ca-ac2e-23e40c1502b5"});

})();
