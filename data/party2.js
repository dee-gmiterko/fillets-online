
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
    var PACKAGE_NAME = 'web/data/party2.data';
    var REMOTE_PACKAGE_BASE = 'data/party2.data';
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
Module['FS_createPath']('/data/images', 'party2', true, true);
Module['FS_createPath']('/data', 'script', true, true);
Module['FS_createPath']('/data/script', 'party2', true, true);
Module['FS_createPath']('/data', 'sound', true, true);
Module['FS_createPath']('/data/sound', 'party2', true, true);
Module['FS_createPath']('/data/sound/party2', 'cs', true, true);
Module['FS_createPath']('/data/sound/party2', 'nl', true, true);

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
              Module['removeRunDependency']('datafile_web/data/party2.data');

    };
    Module['addRunDependency']('datafile_web/data/party2.data');
  
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
 loadPackage({"files": [{"filename": "/data/images/party2/14-ocel.png", "start": 0, "end": 867, "audio": 0}, {"filename": "/data/images/party2/1-ocel.png", "start": 867, "end": 3143, "audio": 0}, {"filename": "/data/images/party2/frk_00.png", "start": 3143, "end": 3545, "audio": 0}, {"filename": "/data/images/party2/frk_01.png", "start": 3545, "end": 3829, "audio": 0}, {"filename": "/data/images/party2/frkavec_00.png", "start": 3829, "end": 4306, "audio": 0}, {"filename": "/data/images/party2/frkavec_01.png", "start": 4306, "end": 5384, "audio": 0}, {"filename": "/data/images/party2/frkavec_02.png", "start": 5384, "end": 6652, "audio": 0}, {"filename": "/data/images/party2/frkavec_03.png", "start": 6652, "end": 7960, "audio": 0}, {"filename": "/data/images/party2/frkavec_04.png", "start": 7960, "end": 9267, "audio": 0}, {"filename": "/data/images/party2/frkavec_05.png", "start": 9267, "end": 10575, "audio": 0}, {"filename": "/data/images/party2/frkavec_06.png", "start": 10575, "end": 11758, "audio": 0}, {"filename": "/data/images/party2/hnat_00.png", "start": 11758, "end": 12186, "audio": 0}, {"filename": "/data/images/party2/hnat_01.png", "start": 12186, "end": 12755, "audio": 0}, {"filename": "/data/images/party2/hnat_02.png", "start": 12755, "end": 13443, "audio": 0}, {"filename": "/data/images/party2/hnat_03.png", "start": 13443, "end": 14201, "audio": 0}, {"filename": "/data/images/party2/hnat_04.png", "start": 14201, "end": 14982, "audio": 0}, {"filename": "/data/images/party2/hnat_05.png", "start": 14982, "end": 16070, "audio": 0}, {"filename": "/data/images/party2/hnat_06.png", "start": 16070, "end": 17228, "audio": 0}, {"filename": "/data/images/party2/hnat_07.png", "start": 17228, "end": 18441, "audio": 0}, {"filename": "/data/images/party2/hnat_08.png", "start": 18441, "end": 19730, "audio": 0}, {"filename": "/data/images/party2/hnat_09.png", "start": 19730, "end": 21038, "audio": 0}, {"filename": "/data/images/party2/hnat_10.png", "start": 21038, "end": 22352, "audio": 0}, {"filename": "/data/images/party2/hnat_11.png", "start": 22352, "end": 23716, "audio": 0}, {"filename": "/data/images/party2/hnat_12.png", "start": 23716, "end": 25121, "audio": 0}, {"filename": "/data/images/party2/hnat_13.png", "start": 25121, "end": 26463, "audio": 0}, {"filename": "/data/images/party2/hnat_14.png", "start": 26463, "end": 27777, "audio": 0}, {"filename": "/data/images/party2/hnat_15.png", "start": 27777, "end": 29033, "audio": 0}, {"filename": "/data/images/party2/hnat_16.png", "start": 29033, "end": 30127, "audio": 0}, {"filename": "/data/images/party2/hnat_17.png", "start": 30127, "end": 31018, "audio": 0}, {"filename": "/data/images/party2/hnat_18.png", "start": 31018, "end": 31840, "audio": 0}, {"filename": "/data/images/party2/hnat_19.png", "start": 31840, "end": 32573, "audio": 0}, {"filename": "/data/images/party2/hnat_20.png", "start": 32573, "end": 33212, "audio": 0}, {"filename": "/data/images/party2/hnat_21.png", "start": 33212, "end": 33701, "audio": 0}, {"filename": "/data/images/party2/kabina_okna.png", "start": 33701, "end": 36271, "audio": 0}, {"filename": "/data/images/party2/kabina_.png", "start": 36271, "end": 59715, "audio": 0}, {"filename": "/data/images/party2/kuk_00.png", "start": 59715, "end": 60521, "audio": 0}, {"filename": "/data/images/party2/kuk_01.png", "start": 60521, "end": 61472, "audio": 0}, {"filename": "/data/images/party2/kuk_02.png", "start": 61472, "end": 62531, "audio": 0}, {"filename": "/data/images/party2/kuk_03.png", "start": 62531, "end": 63595, "audio": 0}, {"filename": "/data/images/party2/kuk_04.png", "start": 63595, "end": 64659, "audio": 0}, {"filename": "/data/images/party2/kuk_05.png", "start": 64659, "end": 65723, "audio": 0}, {"filename": "/data/images/party2/kuk_06.png", "start": 65723, "end": 66334, "audio": 0}, {"filename": "/data/images/party2/kuk_07.png", "start": 66334, "end": 67269, "audio": 0}, {"filename": "/data/images/party2/kuk_08.png", "start": 67269, "end": 68312, "audio": 0}, {"filename": "/data/images/party2/kuk_09.png", "start": 68312, "end": 69377, "audio": 0}, {"filename": "/data/images/party2/kuk_10.png", "start": 69377, "end": 70441, "audio": 0}, {"filename": "/data/images/party2/kuk_11.png", "start": 70441, "end": 71846, "audio": 0}, {"filename": "/data/images/party2/kuk_12.png", "start": 71846, "end": 73379, "audio": 0}, {"filename": "/data/images/party2/kuk_13.png", "start": 73379, "end": 75013, "audio": 0}, {"filename": "/data/images/party2/kuk_14.png", "start": 75013, "end": 76676, "audio": 0}, {"filename": "/data/images/party2/kuk_15.png", "start": 76676, "end": 78335, "audio": 0}, {"filename": "/data/images/party2/kuk_16.png", "start": 78335, "end": 80012, "audio": 0}, {"filename": "/data/images/party2/kuk_17.png", "start": 80012, "end": 80970, "audio": 0}, {"filename": "/data/images/party2/kuk_18.png", "start": 80970, "end": 82161, "audio": 0}, {"filename": "/data/images/party2/kuk_19.png", "start": 82161, "end": 83583, "audio": 0}, {"filename": "/data/images/party2/kuk_20.png", "start": 83583, "end": 85197, "audio": 0}, {"filename": "/data/images/party2/kuk_21.png", "start": 85197, "end": 86858, "audio": 0}, {"filename": "/data/images/party2/kuk_22.png", "start": 86858, "end": 88517, "audio": 0}, {"filename": "/data/images/party2/kuk_23.png", "start": 88517, "end": 90179, "audio": 0}, {"filename": "/data/images/party2/lahev_00.png", "start": 90179, "end": 90762, "audio": 0}, {"filename": "/data/images/party2/lahev_01.png", "start": 90762, "end": 91499, "audio": 0}, {"filename": "/data/images/party2/lahev_02.png", "start": 91499, "end": 92429, "audio": 0}, {"filename": "/data/images/party2/lahev_03.png", "start": 92429, "end": 93561, "audio": 0}, {"filename": "/data/images/party2/lahev_04.png", "start": 93561, "end": 94723, "audio": 0}, {"filename": "/data/images/party2/lahev_05.png", "start": 94723, "end": 95884, "audio": 0}, {"filename": "/data/images/party2/lahev_06.png", "start": 95884, "end": 97043, "audio": 0}, {"filename": "/data/images/party2/lahev_07.png", "start": 97043, "end": 98202, "audio": 0}, {"filename": "/data/images/party2/lahev_08.png", "start": 98202, "end": 99226, "audio": 0}, {"filename": "/data/images/party2/lahev_09.png", "start": 99226, "end": 99972, "audio": 0}, {"filename": "/data/images/party2/lahev_10.png", "start": 99972, "end": 100870, "audio": 0}, {"filename": "/data/images/party2/lahev_11.png", "start": 100870, "end": 101659, "audio": 0}, {"filename": "/data/images/party2/lahev_12.png", "start": 101659, "end": 102435, "audio": 0}, {"filename": "/data/images/party2/lahev_13.png", "start": 102435, "end": 103219, "audio": 0}, {"filename": "/data/images/party2/lahev_14.png", "start": 103219, "end": 104008, "audio": 0}, {"filename": "/data/images/party2/party1-p.png", "start": 104008, "end": 291234, "audio": 0}, {"filename": "/data/images/party2/party2-w.png", "start": 291234, "end": 645372, "audio": 0}, {"filename": "/data/images/party2/ruka_00.png", "start": 645372, "end": 645842, "audio": 0}, {"filename": "/data/images/party2/ruka_01.png", "start": 645842, "end": 646419, "audio": 0}, {"filename": "/data/images/party2/ruka_02.png", "start": 646419, "end": 647069, "audio": 0}, {"filename": "/data/images/party2/ruka_03.png", "start": 647069, "end": 647759, "audio": 0}, {"filename": "/data/images/party2/ruka_04.png", "start": 647759, "end": 648496, "audio": 0}, {"filename": "/data/images/party2/ruka_05.png", "start": 648496, "end": 649283, "audio": 0}, {"filename": "/data/images/party2/ruka_06.png", "start": 649283, "end": 650062, "audio": 0}, {"filename": "/data/images/party2/sklenicka_00.png", "start": 650062, "end": 650652, "audio": 0}, {"filename": "/data/images/party2/sklenicka_01.png", "start": 650652, "end": 651204, "audio": 0}, {"filename": "/data/images/party2/sklenicka_02.png", "start": 651204, "end": 651780, "audio": 0}, {"filename": "/data/images/party2/sklenicka_lezici.png", "start": 651780, "end": 652190, "audio": 0}, {"filename": "/data/images/party2/sklenicka_pr.png", "start": 652190, "end": 652590, "audio": 0}, {"filename": "/data/images/party2/sklenicka_pr_roz.png", "start": 652590, "end": 652958, "audio": 0}, {"filename": "/data/images/party2/sklenicka_rozb.png", "start": 652958, "end": 653326, "audio": 0}, {"filename": "/data/images/party2/sklenicka_roz.png", "start": 653326, "end": 653731, "audio": 0}, {"filename": "/data/images/party2/tacek_00.png", "start": 653731, "end": 654564, "audio": 0}, {"filename": "/data/images/party2/tacek_01.png", "start": 654564, "end": 655409, "audio": 0}, {"filename": "/data/images/party2/tacek_02.png", "start": 655409, "end": 656241, "audio": 0}, {"filename": "/data/script/party2/code.lua", "start": 656241, "end": 679046, "audio": 0}, {"filename": "/data/script/party2/dialogs_bg.lua", "start": 679046, "end": 681294, "audio": 0}, {"filename": "/data/script/party2/dialogs_cs.lua", "start": 681294, "end": 683246, "audio": 0}, {"filename": "/data/script/party2/dialogs_de.lua", "start": 683246, "end": 685214, "audio": 0}, {"filename": "/data/script/party2/dialogs_en.lua", "start": 685214, "end": 686379, "audio": 0}, {"filename": "/data/script/party2/dialogs_es.lua", "start": 686379, "end": 688320, "audio": 0}, {"filename": "/data/script/party2/dialogs_fr.lua", "start": 688320, "end": 690352, "audio": 0}, {"filename": "/data/script/party2/dialogs_it.lua", "start": 690352, "end": 692262, "audio": 0}, {"filename": "/data/script/party2/dialogs.lua", "start": 692262, "end": 692300, "audio": 0}, {"filename": "/data/script/party2/dialogs_nl.lua", "start": 692300, "end": 694289, "audio": 0}, {"filename": "/data/script/party2/dialogs_pl.lua", "start": 694289, "end": 696218, "audio": 0}, {"filename": "/data/script/party2/dialogs_ru.lua", "start": 696218, "end": 698402, "audio": 0}, {"filename": "/data/script/party2/dialogs_sl.lua", "start": 698402, "end": 700264, "audio": 0}, {"filename": "/data/script/party2/dialogs_sv.lua", "start": 700264, "end": 702208, "audio": 0}, {"filename": "/data/script/party2/init.lua", "start": 702208, "end": 702853, "audio": 0}, {"filename": "/data/script/party2/models.lua", "start": 702853, "end": 707759, "audio": 0}, {"filename": "/data/sound/party2/cs/pt2-m-hrac.ogg", "start": 707759, "end": 741082, "audio": 1}, {"filename": "/data/sound/party2/cs/pt2-m-parnik.ogg", "start": 741082, "end": 760592, "audio": 1}, {"filename": "/data/sound/party2/cs/pt2-m-piknik0.ogg", "start": 760592, "end": 786102, "audio": 1}, {"filename": "/data/sound/party2/cs/pt2-m-piknik1.ogg", "start": 786102, "end": 800042, "audio": 1}, {"filename": "/data/sound/party2/cs/pt2-m-piknik2.ogg", "start": 800042, "end": 816483, "audio": 1}, {"filename": "/data/sound/party2/cs/pt2-m-piknik3.ogg", "start": 816483, "end": 834534, "audio": 1}, {"filename": "/data/sound/party2/cs/pt2-v-minule0.ogg", "start": 834534, "end": 851198, "audio": 1}, {"filename": "/data/sound/party2/cs/pt2-v-minule1.ogg", "start": 851198, "end": 869856, "audio": 1}, {"filename": "/data/sound/party2/cs/pt2-v-nemohou0.ogg", "start": 869856, "end": 896355, "audio": 1}, {"filename": "/data/sound/party2/cs/pt2-v-nemohou1.ogg", "start": 896355, "end": 917678, "audio": 1}, {"filename": "/data/sound/party2/cs/pt2-v-unaveni0.ogg", "start": 917678, "end": 945838, "audio": 1}, {"filename": "/data/sound/party2/cs/pt2-v-unaveni1.ogg", "start": 945838, "end": 960797, "audio": 1}, {"filename": "/data/sound/party2/cs/pt2-v-zmena.ogg", "start": 960797, "end": 1001271, "audio": 1}, {"filename": "/data/sound/party2/nl/pt2-m-hrac.ogg", "start": 1001271, "end": 1034004, "audio": 1}, {"filename": "/data/sound/party2/nl/pt2-m-parnik.ogg", "start": 1034004, "end": 1052871, "audio": 1}, {"filename": "/data/sound/party2/nl/pt2-m-piknik0.ogg", "start": 1052871, "end": 1076359, "audio": 1}, {"filename": "/data/sound/party2/nl/pt2-m-piknik1.ogg", "start": 1076359, "end": 1095501, "audio": 1}, {"filename": "/data/sound/party2/nl/pt2-m-piknik2.ogg", "start": 1095501, "end": 1118373, "audio": 1}, {"filename": "/data/sound/party2/nl/pt2-m-piknik3.ogg", "start": 1118373, "end": 1137148, "audio": 1}, {"filename": "/data/sound/party2/nl/pt2-v-minule0.ogg", "start": 1137148, "end": 1159602, "audio": 1}, {"filename": "/data/sound/party2/nl/pt2-v-minule1.ogg", "start": 1159602, "end": 1186272, "audio": 1}, {"filename": "/data/sound/party2/nl/pt2-v-nemohou0.ogg", "start": 1186272, "end": 1208317, "audio": 1}, {"filename": "/data/sound/party2/nl/pt2-v-nemohou1.ogg", "start": 1208317, "end": 1231647, "audio": 1}, {"filename": "/data/sound/party2/nl/pt2-v-unaveni0.ogg", "start": 1231647, "end": 1256792, "audio": 1}, {"filename": "/data/sound/party2/nl/pt2-v-unaveni1.ogg", "start": 1256792, "end": 1278106, "audio": 1}, {"filename": "/data/sound/party2/nl/pt2-v-zmena.ogg", "start": 1278106, "end": 1317086, "audio": 1}], "remote_package_size": 1317086, "package_uuid": "af6a18c9-e935-4dee-8d22-85a26a69cd82"});

})();
