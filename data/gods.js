
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
    var PACKAGE_NAME = 'web/data/gods.data';
    var REMOTE_PACKAGE_BASE = 'data/gods.data';
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
Module['FS_createPath']('/data/images', 'gods', true, true);
Module['FS_createPath']('/data', 'script', true, true);
Module['FS_createPath']('/data/script', 'gods', true, true);
Module['FS_createPath']('/data', 'sound', true, true);
Module['FS_createPath']('/data/sound', 'gods', true, true);
Module['FS_createPath']('/data/sound/gods', 'cs', true, true);
Module['FS_createPath']('/data/sound/gods', 'nl', true, true);

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
              Module['removeRunDependency']('datafile_web/data/gods.data');

    };
    Module['addRunDependency']('datafile_web/data/gods.data');
  
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
 loadPackage({"files": [{"filename": "/data/images/gods/3-ocel.png", "start": 0, "end": 1583, "audio": 0}, {"filename": "/data/images/gods/4-ocel.png", "start": 1583, "end": 2081, "audio": 0}, {"filename": "/data/images/gods/5-ocel.png", "start": 2081, "end": 3867, "audio": 0}, {"filename": "/data/images/gods/bota.png", "start": 3867, "end": 5478, "audio": 0}, {"filename": "/data/images/gods/domino.png", "start": 5478, "end": 6389, "audio": 0}, {"filename": "/data/images/gods/hul.png", "start": 6389, "end": 10065, "audio": 0}, {"filename": "/data/images/gods/kuzelka.png", "start": 10065, "end": 11604, "audio": 0}, {"filename": "/data/images/gods/lode-w.png", "start": 11604, "end": 356650, "audio": 0}, {"filename": "/data/images/gods/neptun_00.png", "start": 356650, "end": 368980, "audio": 0}, {"filename": "/data/images/gods/neptun_01.png", "start": 368980, "end": 381307, "audio": 0}, {"filename": "/data/images/gods/neptun_02.png", "start": 381307, "end": 393655, "audio": 0}, {"filename": "/data/images/gods/neptun_03.png", "start": 393655, "end": 406014, "audio": 0}, {"filename": "/data/images/gods/neptun_04.png", "start": 406014, "end": 418456, "audio": 0}, {"filename": "/data/images/gods/neptun_05.png", "start": 418456, "end": 430897, "audio": 0}, {"filename": "/data/images/gods/neptun_06.png", "start": 430897, "end": 443324, "audio": 0}, {"filename": "/data/images/gods/neptun_07.png", "start": 443324, "end": 455742, "audio": 0}, {"filename": "/data/images/gods/neptun_08.png", "start": 455742, "end": 468285, "audio": 0}, {"filename": "/data/images/gods/neptun_09.png", "start": 468285, "end": 480740, "audio": 0}, {"filename": "/data/images/gods/neptun_10.png", "start": 480740, "end": 492941, "audio": 0}, {"filename": "/data/images/gods/neptun_11.png", "start": 492941, "end": 505139, "audio": 0}, {"filename": "/data/images/gods/neptun_12.png", "start": 505139, "end": 517342, "audio": 0}, {"filename": "/data/images/gods/neptun_13.png", "start": 517342, "end": 529564, "audio": 0}, {"filename": "/data/images/gods/neptun_14.png", "start": 529564, "end": 541873, "audio": 0}, {"filename": "/data/images/gods/neptun_15.png", "start": 541873, "end": 554163, "audio": 0}, {"filename": "/data/images/gods/neptun_16.png", "start": 554163, "end": 566457, "audio": 0}, {"filename": "/data/images/gods/neptun_17.png", "start": 566457, "end": 578732, "audio": 0}, {"filename": "/data/images/gods/neptun_18.png", "start": 578732, "end": 591132, "audio": 0}, {"filename": "/data/images/gods/neptun_19.png", "start": 591132, "end": 603459, "audio": 0}, {"filename": "/data/images/gods/neptun_20.png", "start": 603459, "end": 615700, "audio": 0}, {"filename": "/data/images/gods/neptun_21.png", "start": 615700, "end": 627938, "audio": 0}, {"filename": "/data/images/gods/neptun_22.png", "start": 627938, "end": 640190, "audio": 0}, {"filename": "/data/images/gods/neptun_23.png", "start": 640190, "end": 652461, "audio": 0}, {"filename": "/data/images/gods/neptun_24.png", "start": 652461, "end": 664821, "audio": 0}, {"filename": "/data/images/gods/neptun_25.png", "start": 664821, "end": 677159, "audio": 0}, {"filename": "/data/images/gods/neptun_26.png", "start": 677159, "end": 689497, "audio": 0}, {"filename": "/data/images/gods/neptun_27.png", "start": 689497, "end": 701823, "audio": 0}, {"filename": "/data/images/gods/neptun_28.png", "start": 701823, "end": 714275, "audio": 0}, {"filename": "/data/images/gods/neptun_29.png", "start": 714275, "end": 726644, "audio": 0}, {"filename": "/data/images/gods/neptun_30.png", "start": 726644, "end": 738838, "audio": 0}, {"filename": "/data/images/gods/neptun_31.png", "start": 738838, "end": 751031, "audio": 0}, {"filename": "/data/images/gods/neptun_32.png", "start": 751031, "end": 763230, "audio": 0}, {"filename": "/data/images/gods/neptun_33.png", "start": 763230, "end": 775435, "audio": 0}, {"filename": "/data/images/gods/neptun_34.png", "start": 775435, "end": 787731, "audio": 0}, {"filename": "/data/images/gods/neptun_35.png", "start": 787731, "end": 800011, "audio": 0}, {"filename": "/data/images/gods/neptun_36.png", "start": 800011, "end": 812293, "audio": 0}, {"filename": "/data/images/gods/neptun_37.png", "start": 812293, "end": 824548, "audio": 0}, {"filename": "/data/images/gods/neptun_38.png", "start": 824548, "end": 836930, "audio": 0}, {"filename": "/data/images/gods/neptun_39.png", "start": 836930, "end": 849252, "audio": 0}, {"filename": "/data/images/gods/neptun_40.png", "start": 849252, "end": 861353, "audio": 0}, {"filename": "/data/images/gods/neptun_41.png", "start": 861353, "end": 873552, "audio": 0}, {"filename": "/data/images/gods/neptun_42.png", "start": 873552, "end": 885780, "audio": 0}, {"filename": "/data/images/gods/neptun_43.png", "start": 885780, "end": 898263, "audio": 0}, {"filename": "/data/images/gods/neptun_44.png", "start": 898263, "end": 910845, "audio": 0}, {"filename": "/data/images/gods/neptun_45.png", "start": 910845, "end": 923459, "audio": 0}, {"filename": "/data/images/gods/palka.png", "start": 923459, "end": 925295, "audio": 0}, {"filename": "/data/images/gods/ping.png", "start": 925295, "end": 925916, "audio": 0}, {"filename": "/data/images/gods/poseidon_00.png", "start": 925916, "end": 938420, "audio": 0}, {"filename": "/data/images/gods/poseidon_01.png", "start": 938420, "end": 950973, "audio": 0}, {"filename": "/data/images/gods/poseidon_02.png", "start": 950973, "end": 963499, "audio": 0}, {"filename": "/data/images/gods/poseidon_03.png", "start": 963499, "end": 976009, "audio": 0}, {"filename": "/data/images/gods/poseidon_04.png", "start": 976009, "end": 988616, "audio": 0}, {"filename": "/data/images/gods/poseidon_05.png", "start": 988616, "end": 1001273, "audio": 0}, {"filename": "/data/images/gods/poseidon_06.png", "start": 1001273, "end": 1013902, "audio": 0}, {"filename": "/data/images/gods/poseidon_07.png", "start": 1013902, "end": 1026515, "audio": 0}, {"filename": "/data/images/gods/poseidon_08.png", "start": 1026515, "end": 1039054, "audio": 0}, {"filename": "/data/images/gods/poseidon_09.png", "start": 1039054, "end": 1051638, "audio": 0}, {"filename": "/data/images/gods/poseidon_10.png", "start": 1051638, "end": 1064197, "audio": 0}, {"filename": "/data/images/gods/poseidon_11.png", "start": 1064197, "end": 1076734, "audio": 0}, {"filename": "/data/images/gods/poseidon_12.png", "start": 1076734, "end": 1089282, "audio": 0}, {"filename": "/data/images/gods/poseidon_13.png", "start": 1089282, "end": 1101854, "audio": 0}, {"filename": "/data/images/gods/poseidon_14.png", "start": 1101854, "end": 1114428, "audio": 0}, {"filename": "/data/images/gods/poseidon_15.png", "start": 1114428, "end": 1126952, "audio": 0}, {"filename": "/data/images/gods/poseidon_16.png", "start": 1126952, "end": 1139604, "audio": 0}, {"filename": "/data/images/gods/poseidon_17.png", "start": 1139604, "end": 1152278, "audio": 0}, {"filename": "/data/images/gods/poseidon_18.png", "start": 1152278, "end": 1164948, "audio": 0}, {"filename": "/data/images/gods/poseidon_19.png", "start": 1164948, "end": 1177577, "audio": 0}, {"filename": "/data/images/gods/poseidon_20.png", "start": 1177577, "end": 1190155, "audio": 0}, {"filename": "/data/images/gods/poseidon_21.png", "start": 1190155, "end": 1202760, "audio": 0}, {"filename": "/data/images/gods/poseidon_22.png", "start": 1202760, "end": 1215364, "audio": 0}, {"filename": "/data/images/gods/poseidon_23.png", "start": 1215364, "end": 1227917, "audio": 0}, {"filename": "/data/images/gods/poseidon_24.png", "start": 1227917, "end": 1240416, "audio": 0}, {"filename": "/data/images/gods/poseidon_25.png", "start": 1240416, "end": 1252966, "audio": 0}, {"filename": "/data/images/gods/poseidon_26.png", "start": 1252966, "end": 1265494, "audio": 0}, {"filename": "/data/images/gods/poseidon_27.png", "start": 1265494, "end": 1278029, "audio": 0}, {"filename": "/data/images/gods/poseidon_28.png", "start": 1278029, "end": 1290637, "audio": 0}, {"filename": "/data/images/gods/poseidon_29.png", "start": 1290637, "end": 1303288, "audio": 0}, {"filename": "/data/images/gods/poseidon_30.png", "start": 1303288, "end": 1315922, "audio": 0}, {"filename": "/data/images/gods/poseidon_31.png", "start": 1315922, "end": 1328560, "audio": 0}, {"filename": "/data/images/gods/poseidon_32.png", "start": 1328560, "end": 1341098, "audio": 0}, {"filename": "/data/images/gods/poseidon_33.png", "start": 1341098, "end": 1353679, "audio": 0}, {"filename": "/data/images/gods/poseidon_34.png", "start": 1353679, "end": 1366240, "audio": 0}, {"filename": "/data/images/gods/poseidon_35.png", "start": 1366240, "end": 1378806, "audio": 0}, {"filename": "/data/images/gods/poseidon_36.png", "start": 1378806, "end": 1391437, "audio": 0}, {"filename": "/data/images/gods/poseidon_37.png", "start": 1391437, "end": 1404113, "audio": 0}, {"filename": "/data/images/gods/poseidon_38.png", "start": 1404113, "end": 1416773, "audio": 0}, {"filename": "/data/images/gods/poseidon_39.png", "start": 1416773, "end": 1429340, "audio": 0}, {"filename": "/data/images/gods/poseidon_40.png", "start": 1429340, "end": 1442072, "audio": 0}, {"filename": "/data/images/gods/poseidon_41.png", "start": 1442072, "end": 1454855, "audio": 0}, {"filename": "/data/images/gods/poseidon_42.png", "start": 1454855, "end": 1467622, "audio": 0}, {"filename": "/data/images/gods/poseidon_43.png", "start": 1467622, "end": 1480288, "audio": 0}, {"filename": "/data/images/gods/poseidon_44.png", "start": 1480288, "end": 1492945, "audio": 0}, {"filename": "/data/images/gods/poseidon_45.png", "start": 1492945, "end": 1505653, "audio": 0}, {"filename": "/data/images/gods/poseidon_46.png", "start": 1505653, "end": 1518349, "audio": 0}, {"filename": "/data/images/gods/poseidon_47.png", "start": 1518349, "end": 1530944, "audio": 0}, {"filename": "/data/images/gods/poseidon_48.png", "start": 1530944, "end": 1543535, "audio": 0}, {"filename": "/data/images/gods/poster.png", "start": 1543535, "end": 1718872, "audio": 0}, {"filename": "/data/images/gods/potop_00.png", "start": 1718872, "end": 1727234, "audio": 0}, {"filename": "/data/images/gods/potop_01.png", "start": 1727234, "end": 1732491, "audio": 0}, {"filename": "/data/images/gods/potop_02.png", "start": 1732491, "end": 1753648, "audio": 0}, {"filename": "/data/images/gods/potop_03.png", "start": 1753648, "end": 1761854, "audio": 0}, {"filename": "/data/images/gods/potop_04.png", "start": 1761854, "end": 1770599, "audio": 0}, {"filename": "/data/images/gods/pozadi.png", "start": 1770599, "end": 2019677, "audio": 0}, {"filename": "/data/images/gods/tenisak.png", "start": 2019677, "end": 2020396, "audio": 0}, {"filename": "/data/script/gods/code.lua", "start": 2020396, "end": 2046253, "audio": 0}, {"filename": "/data/script/gods/demo_dialogs_bg.lua", "start": 2046253, "end": 2047918, "audio": 0}, {"filename": "/data/script/gods/demo_dialogs_cs.lua", "start": 2047918, "end": 2048613, "audio": 0}, {"filename": "/data/script/gods/demo_dialogs_de_CH.lua", "start": 2048613, "end": 2049311, "audio": 0}, {"filename": "/data/script/gods/demo_dialogs_de.lua", "start": 2049311, "end": 2050559, "audio": 0}, {"filename": "/data/script/gods/demo_dialogs_en.lua", "start": 2050559, "end": 2051209, "audio": 0}, {"filename": "/data/script/gods/demo_dialogs_es.lua", "start": 2051209, "end": 2052504, "audio": 0}, {"filename": "/data/script/gods/demo_dialogs_fr.lua", "start": 2052504, "end": 2053750, "audio": 0}, {"filename": "/data/script/gods/demo_dialogs_it.lua", "start": 2053750, "end": 2055046, "audio": 0}, {"filename": "/data/script/gods/demo_dialogs_nl.lua", "start": 2055046, "end": 2056338, "audio": 0}, {"filename": "/data/script/gods/demo_dialogs_pl.lua", "start": 2056338, "end": 2057562, "audio": 0}, {"filename": "/data/script/gods/demo_dialogs_ru.lua", "start": 2057562, "end": 2059196, "audio": 0}, {"filename": "/data/script/gods/demo_dialogs_sl.lua", "start": 2059196, "end": 2060340, "audio": 0}, {"filename": "/data/script/gods/demo_dialogs_sv.lua", "start": 2060340, "end": 2061522, "audio": 0}, {"filename": "/data/script/gods/demo_poster.lua", "start": 2061522, "end": 2061888, "audio": 0}, {"filename": "/data/script/gods/dialogs_bg.lua", "start": 2061888, "end": 2072497, "audio": 0}, {"filename": "/data/script/gods/dialogs_cs.lua", "start": 2072497, "end": 2081964, "audio": 0}, {"filename": "/data/script/gods/dialogs_de_CH.lua", "start": 2081964, "end": 2082040, "audio": 0}, {"filename": "/data/script/gods/dialogs_de.lua", "start": 2082040, "end": 2089714, "audio": 0}, {"filename": "/data/script/gods/dialogs_en.lua", "start": 2089714, "end": 2095641, "audio": 0}, {"filename": "/data/script/gods/dialogs_es.lua", "start": 2095641, "end": 2103275, "audio": 0}, {"filename": "/data/script/gods/dialogs_fr.lua", "start": 2103275, "end": 2110863, "audio": 0}, {"filename": "/data/script/gods/dialogs_it.lua", "start": 2110863, "end": 2120355, "audio": 0}, {"filename": "/data/script/gods/dialogs.lua", "start": 2120355, "end": 2120393, "audio": 0}, {"filename": "/data/script/gods/dialogs_nl.lua", "start": 2120393, "end": 2128004, "audio": 0}, {"filename": "/data/script/gods/dialogs_pl.lua", "start": 2128004, "end": 2137552, "audio": 0}, {"filename": "/data/script/gods/dialogs_ru.lua", "start": 2137552, "end": 2148282, "audio": 0}, {"filename": "/data/script/gods/dialogs_sl.lua", "start": 2148282, "end": 2157599, "audio": 0}, {"filename": "/data/script/gods/dialogs_sv.lua", "start": 2157599, "end": 2165066, "audio": 0}, {"filename": "/data/script/gods/init.lua", "start": 2165066, "end": 2165709, "audio": 0}, {"filename": "/data/script/gods/models.lua", "start": 2165709, "end": 2169538, "audio": 0}, {"filename": "/data/script/gods/prog_ships.lua", "start": 2169538, "end": 2180822, "audio": 0}, {"filename": "/data/sound/gods/cs/b1-10.ogg", "start": 2180822, "end": 2194573, "audio": 1}, {"filename": "/data/sound/gods/cs/b1-1.ogg", "start": 2194573, "end": 2205471, "audio": 1}, {"filename": "/data/sound/gods/cs/b1-2.ogg", "start": 2205471, "end": 2219503, "audio": 1}, {"filename": "/data/sound/gods/cs/b1-3.ogg", "start": 2219503, "end": 2232366, "audio": 1}, {"filename": "/data/sound/gods/cs/b1-4.ogg", "start": 2232366, "end": 2246365, "audio": 1}, {"filename": "/data/sound/gods/cs/b1-5.ogg", "start": 2246365, "end": 2258916, "audio": 1}, {"filename": "/data/sound/gods/cs/b1-6.ogg", "start": 2258916, "end": 2271163, "audio": 1}, {"filename": "/data/sound/gods/cs/b1-7.ogg", "start": 2271163, "end": 2284226, "audio": 1}, {"filename": "/data/sound/gods/cs/b1-8.ogg", "start": 2284226, "end": 2297904, "audio": 1}, {"filename": "/data/sound/gods/cs/b1-9.ogg", "start": 2297904, "end": 2311012, "audio": 1}, {"filename": "/data/sound/gods/cs/b1-a.ogg", "start": 2311012, "end": 2325496, "audio": 1}, {"filename": "/data/sound/gods/cs/b1-b.ogg", "start": 2325496, "end": 2338889, "audio": 1}, {"filename": "/data/sound/gods/cs/b1-c.ogg", "start": 2338889, "end": 2354154, "audio": 1}, {"filename": "/data/sound/gods/cs/b1-dobre.ogg", "start": 2354154, "end": 2364927, "audio": 1}, {"filename": "/data/sound/gods/cs/b1-d.ogg", "start": 2364927, "end": 2378490, "audio": 1}, {"filename": "/data/sound/gods/cs/b1-e.ogg", "start": 2378490, "end": 2391373, "audio": 1}, {"filename": "/data/sound/gods/cs/b1-f.ogg", "start": 2391373, "end": 2402082, "audio": 1}, {"filename": "/data/sound/gods/cs/b1-g.ogg", "start": 2402082, "end": 2414504, "audio": 1}, {"filename": "/data/sound/gods/cs/b1-h.ogg", "start": 2414504, "end": 2427928, "audio": 1}, {"filename": "/data/sound/gods/cs/b1-i.ogg", "start": 2427928, "end": 2438503, "audio": 1}, {"filename": "/data/sound/gods/cs/b1-j.ogg", "start": 2438503, "end": 2453095, "audio": 1}, {"filename": "/data/sound/gods/cs/b1-nepodvadim.ogg", "start": 2453095, "end": 2468446, "audio": 1}, {"filename": "/data/sound/gods/cs/b1-potop1.ogg", "start": 2468446, "end": 2480932, "audio": 1}, {"filename": "/data/sound/gods/cs/b1-potop2.ogg", "start": 2480932, "end": 2492945, "audio": 1}, {"filename": "/data/sound/gods/cs/b1-potop3.ogg", "start": 2492945, "end": 2506395, "audio": 1}, {"filename": "/data/sound/gods/cs/b1-spletl.ogg", "start": 2506395, "end": 2520102, "audio": 1}, {"filename": "/data/sound/gods/cs/b1-voda1.ogg", "start": 2520102, "end": 2530121, "audio": 1}, {"filename": "/data/sound/gods/cs/b1-voda2.ogg", "start": 2530121, "end": 2545116, "audio": 1}, {"filename": "/data/sound/gods/cs/b1-voda3.ogg", "start": 2545116, "end": 2561468, "audio": 1}, {"filename": "/data/sound/gods/cs/b1-voda4.ogg", "start": 2561468, "end": 2572561, "audio": 1}, {"filename": "/data/sound/gods/cs/b1-voda5.ogg", "start": 2572561, "end": 2584510, "audio": 1}, {"filename": "/data/sound/gods/cs/b1-vyhral.ogg", "start": 2584510, "end": 2606256, "audio": 1}, {"filename": "/data/sound/gods/cs/b1-zacinam.ogg", "start": 2606256, "end": 2620712, "audio": 1}, {"filename": "/data/sound/gods/cs/b1-zasah1.ogg", "start": 2620712, "end": 2631957, "audio": 1}, {"filename": "/data/sound/gods/cs/b1-zasah2.ogg", "start": 2631957, "end": 2644499, "audio": 1}, {"filename": "/data/sound/gods/cs/b1-zasah3.ogg", "start": 2644499, "end": 2657192, "audio": 1}, {"filename": "/data/sound/gods/cs/b1-zasah4.ogg", "start": 2657192, "end": 2671733, "audio": 1}, {"filename": "/data/sound/gods/cs/b1-znovu.ogg", "start": 2671733, "end": 2688923, "audio": 1}, {"filename": "/data/sound/gods/cs/b2-10.ogg", "start": 2688923, "end": 2699206, "audio": 1}, {"filename": "/data/sound/gods/cs/b2-1.ogg", "start": 2699206, "end": 2711832, "audio": 1}, {"filename": "/data/sound/gods/cs/b2-2.ogg", "start": 2711832, "end": 2723130, "audio": 1}, {"filename": "/data/sound/gods/cs/b2-3.ogg", "start": 2723130, "end": 2734013, "audio": 1}, {"filename": "/data/sound/gods/cs/b2-4.ogg", "start": 2734013, "end": 2745950, "audio": 1}, {"filename": "/data/sound/gods/cs/b2-5.ogg", "start": 2745950, "end": 2757596, "audio": 1}, {"filename": "/data/sound/gods/cs/b2-6.ogg", "start": 2757596, "end": 2770093, "audio": 1}, {"filename": "/data/sound/gods/cs/b2-7.ogg", "start": 2770093, "end": 2781823, "audio": 1}, {"filename": "/data/sound/gods/cs/b2-8.ogg", "start": 2781823, "end": 2793703, "audio": 1}, {"filename": "/data/sound/gods/cs/b2-9.ogg", "start": 2793703, "end": 2805596, "audio": 1}, {"filename": "/data/sound/gods/cs/b2-a.ogg", "start": 2805596, "end": 2818782, "audio": 1}, {"filename": "/data/sound/gods/cs/b2-b.ogg", "start": 2818782, "end": 2831981, "audio": 1}, {"filename": "/data/sound/gods/cs/b2-c.ogg", "start": 2831981, "end": 2846672, "audio": 1}, {"filename": "/data/sound/gods/cs/b2-dobre.ogg", "start": 2846672, "end": 2860034, "audio": 1}, {"filename": "/data/sound/gods/cs/b2-d.ogg", "start": 2860034, "end": 2874510, "audio": 1}, {"filename": "/data/sound/gods/cs/b2-e.ogg", "start": 2874510, "end": 2886949, "audio": 1}, {"filename": "/data/sound/gods/cs/b2-f.ogg", "start": 2886949, "end": 2898711, "audio": 1}, {"filename": "/data/sound/gods/cs/b2-g.ogg", "start": 2898711, "end": 2911744, "audio": 1}, {"filename": "/data/sound/gods/cs/b2-h.ogg", "start": 2911744, "end": 2926124, "audio": 1}, {"filename": "/data/sound/gods/cs/b2-i.ogg", "start": 2926124, "end": 2937969, "audio": 1}, {"filename": "/data/sound/gods/cs/b2-j.ogg", "start": 2937969, "end": 2952161, "audio": 1}, {"filename": "/data/sound/gods/cs/b2-nemuze.ogg", "start": 2952161, "end": 2979331, "audio": 1}, {"filename": "/data/sound/gods/cs/b2-podvadis.ogg", "start": 2979331, "end": 2994857, "audio": 1}, {"filename": "/data/sound/gods/cs/b2-potop1.ogg", "start": 2994857, "end": 3008106, "audio": 1}, {"filename": "/data/sound/gods/cs/b2-potop2.ogg", "start": 3008106, "end": 3024233, "audio": 1}, {"filename": "/data/sound/gods/cs/b2-potop3.ogg", "start": 3024233, "end": 3036363, "audio": 1}, {"filename": "/data/sound/gods/cs/b2-rikal1.ogg", "start": 3036363, "end": 3052257, "audio": 1}, {"filename": "/data/sound/gods/cs/b2-rikal2.ogg", "start": 3052257, "end": 3070047, "audio": 1}, {"filename": "/data/sound/gods/cs/b2-spatne.ogg", "start": 3070047, "end": 3096229, "audio": 1}, {"filename": "/data/sound/gods/cs/b2-voda1.ogg", "start": 3096229, "end": 3108685, "audio": 1}, {"filename": "/data/sound/gods/cs/b2-voda2.ogg", "start": 3108685, "end": 3120511, "audio": 1}, {"filename": "/data/sound/gods/cs/b2-voda3.ogg", "start": 3120511, "end": 3135730, "audio": 1}, {"filename": "/data/sound/gods/cs/b2-voda4.ogg", "start": 3135730, "end": 3150009, "audio": 1}, {"filename": "/data/sound/gods/cs/b2-voda5.ogg", "start": 3150009, "end": 3163910, "audio": 1}, {"filename": "/data/sound/gods/cs/b2-vyhral.ogg", "start": 3163910, "end": 3189440, "audio": 1}, {"filename": "/data/sound/gods/cs/b2-zasah1.ogg", "start": 3189440, "end": 3206511, "audio": 1}, {"filename": "/data/sound/gods/cs/b2-zasah2.ogg", "start": 3206511, "end": 3217921, "audio": 1}, {"filename": "/data/sound/gods/cs/b2-zasah3.ogg", "start": 3217921, "end": 3230303, "audio": 1}, {"filename": "/data/sound/gods/cs/b2-zasah4.ogg", "start": 3230303, "end": 3247038, "audio": 1}, {"filename": "/data/sound/gods/cs/b2-znovu.ogg", "start": 3247038, "end": 3265196, "audio": 1}, {"filename": "/data/sound/gods/cs/lod-m-bohove.ogg", "start": 3265196, "end": 3297740, "audio": 1}, {"filename": "/data/sound/gods/cs/lod-m-co.ogg", "start": 3297740, "end": 3310774, "audio": 1}, {"filename": "/data/sound/gods/cs/lod-m-costim.ogg", "start": 3310774, "end": 3324495, "audio": 1}, {"filename": "/data/sound/gods/cs/lod-m-hrac.ogg", "start": 3324495, "end": 3338999, "audio": 1}, {"filename": "/data/sound/gods/cs/lod-m-jednoho.ogg", "start": 3338999, "end": 3382741, "audio": 1}, {"filename": "/data/sound/gods/cs/lod-m-micek.ogg", "start": 3382741, "end": 3406004, "audio": 1}, {"filename": "/data/sound/gods/cs/lod-m-modry.ogg", "start": 3406004, "end": 3418073, "audio": 1}, {"filename": "/data/sound/gods/cs/lod-m-oba.ogg", "start": 3418073, "end": 3437834, "audio": 1}, {"filename": "/data/sound/gods/cs/lod-m-ozizlana.ogg", "start": 3437834, "end": 3453424, "audio": 1}, {"filename": "/data/sound/gods/cs/lod-m-palka.ogg", "start": 3453424, "end": 3489171, "audio": 1}, {"filename": "/data/sound/gods/cs/lod-m-pravda0.ogg", "start": 3489171, "end": 3509057, "audio": 1}, {"filename": "/data/sound/gods/cs/lod-m-pravda1.ogg", "start": 3509057, "end": 3527134, "audio": 1}, {"filename": "/data/sound/gods/cs/lod-m-pravda2.ogg", "start": 3527134, "end": 3541807, "audio": 1}, {"filename": "/data/sound/gods/cs/lod-m-vyznam.ogg", "start": 3541807, "end": 3560479, "audio": 1}, {"filename": "/data/sound/gods/cs/lod-m-zluty.ogg", "start": 3560479, "end": 3573019, "audio": 1}, {"filename": "/data/sound/gods/cs/lod-v-cvok.ogg", "start": 3573019, "end": 3609610, "audio": 1}, {"filename": "/data/sound/gods/cs/lod-v-golf.ogg", "start": 3609610, "end": 3653081, "audio": 1}, {"filename": "/data/sound/gods/cs/lod-v-hrac.ogg", "start": 3653081, "end": 3667167, "audio": 1}, {"filename": "/data/sound/gods/cs/lod-v-hravost.ogg", "start": 3667167, "end": 3693500, "audio": 1}, {"filename": "/data/sound/gods/cs/lod-v-hul.ogg", "start": 3693500, "end": 3722596, "audio": 1}, {"filename": "/data/sound/gods/cs/lod-v-internovat.ogg", "start": 3722596, "end": 3746756, "audio": 1}, {"filename": "/data/sound/gods/cs/lod-v-kdovi.ogg", "start": 3746756, "end": 3757429, "audio": 1}, {"filename": "/data/sound/gods/cs/lod-v-koho.ogg", "start": 3757429, "end": 3771799, "audio": 1}, {"filename": "/data/sound/gods/cs/lod-v-micky.ogg", "start": 3771799, "end": 3813613, "audio": 1}, {"filename": "/data/sound/gods/cs/lod-v-modry.ogg", "start": 3813613, "end": 3824780, "audio": 1}, {"filename": "/data/sound/gods/cs/lod-v-rozliseni.ogg", "start": 3824780, "end": 3843608, "audio": 1}, {"filename": "/data/sound/gods/cs/lod-v-silenost0.ogg", "start": 3843608, "end": 3871556, "audio": 1}, {"filename": "/data/sound/gods/cs/lod-v-silenost1.ogg", "start": 3871556, "end": 3899008, "audio": 1}, {"filename": "/data/sound/gods/cs/lod-v-silenost2.ogg", "start": 3899008, "end": 3919351, "audio": 1}, {"filename": "/data/sound/gods/cs/lod-v-zluty.ogg", "start": 3919351, "end": 3931106, "audio": 1}, {"filename": "/data/sound/gods/nl/lod-m-bohove.ogg", "start": 3931106, "end": 3959640, "audio": 1}, {"filename": "/data/sound/gods/nl/lod-m-co.ogg", "start": 3959640, "end": 3978327, "audio": 1}, {"filename": "/data/sound/gods/nl/lod-m-costim.ogg", "start": 3978327, "end": 3994805, "audio": 1}, {"filename": "/data/sound/gods/nl/lod-m-hrac.ogg", "start": 3994805, "end": 4014646, "audio": 1}, {"filename": "/data/sound/gods/nl/lod-m-jednoho.ogg", "start": 4014646, "end": 4058744, "audio": 1}, {"filename": "/data/sound/gods/nl/lod-m-micek.ogg", "start": 4058744, "end": 4082243, "audio": 1}, {"filename": "/data/sound/gods/nl/lod-m-modry.ogg", "start": 4082243, "end": 4096587, "audio": 1}, {"filename": "/data/sound/gods/nl/lod-m-oba.ogg", "start": 4096587, "end": 4120828, "audio": 1}, {"filename": "/data/sound/gods/nl/lod-m-ozizlana.ogg", "start": 4120828, "end": 4147714, "audio": 1}, {"filename": "/data/sound/gods/nl/lod-m-palka.ogg", "start": 4147714, "end": 4181965, "audio": 1}, {"filename": "/data/sound/gods/nl/lod-m-pravda0.ogg", "start": 4181965, "end": 4199407, "audio": 1}, {"filename": "/data/sound/gods/nl/lod-m-pravda1.ogg", "start": 4199407, "end": 4217060, "audio": 1}, {"filename": "/data/sound/gods/nl/lod-m-pravda2.ogg", "start": 4217060, "end": 4236532, "audio": 1}, {"filename": "/data/sound/gods/nl/lod-m-vyznam.ogg", "start": 4236532, "end": 4258910, "audio": 1}, {"filename": "/data/sound/gods/nl/lod-m-zluty.ogg", "start": 4258910, "end": 4272836, "audio": 1}, {"filename": "/data/sound/gods/nl/lod-v-cvok.ogg", "start": 4272836, "end": 4309292, "audio": 1}, {"filename": "/data/sound/gods/nl/lod-v-golf.ogg", "start": 4309292, "end": 4361198, "audio": 1}, {"filename": "/data/sound/gods/nl/lod-v-hrac.ogg", "start": 4361198, "end": 4386054, "audio": 1}, {"filename": "/data/sound/gods/nl/lod-v-hravost.ogg", "start": 4386054, "end": 4418762, "audio": 1}, {"filename": "/data/sound/gods/nl/lod-v-hul.ogg", "start": 4418762, "end": 4448734, "audio": 1}, {"filename": "/data/sound/gods/nl/lod-v-internovat.ogg", "start": 4448734, "end": 4480474, "audio": 1}, {"filename": "/data/sound/gods/nl/lod-v-kdovi.ogg", "start": 4480474, "end": 4497232, "audio": 1}, {"filename": "/data/sound/gods/nl/lod-v-koho.ogg", "start": 4497232, "end": 4518643, "audio": 1}, {"filename": "/data/sound/gods/nl/lod-v-micky.ogg", "start": 4518643, "end": 4560196, "audio": 1}, {"filename": "/data/sound/gods/nl/lod-v-modry.ogg", "start": 4560196, "end": 4576334, "audio": 1}, {"filename": "/data/sound/gods/nl/lod-v-rozliseni.ogg", "start": 4576334, "end": 4600362, "audio": 1}, {"filename": "/data/sound/gods/nl/lod-v-silenost0.ogg", "start": 4600362, "end": 4628386, "audio": 1}, {"filename": "/data/sound/gods/nl/lod-v-silenost1.ogg", "start": 4628386, "end": 4656649, "audio": 1}, {"filename": "/data/sound/gods/nl/lod-v-silenost2.ogg", "start": 4656649, "end": 4683125, "audio": 1}, {"filename": "/data/sound/gods/nl/lod-v-zluty.ogg", "start": 4683125, "end": 4699907, "audio": 1}], "remote_package_size": 4699907, "package_uuid": "88d1eea5-af8b-4a94-9be8-1706504ea4ad"});

})();
