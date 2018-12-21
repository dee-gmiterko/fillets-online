
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
    var PACKAGE_NAME = 'web/data/columns.data';
    var REMOTE_PACKAGE_BASE = 'data/columns.data';
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
Module['FS_createPath']('/data/images', 'columns', true, true);
Module['FS_createPath']('/data', 'script', true, true);
Module['FS_createPath']('/data/script', 'columns', true, true);
Module['FS_createPath']('/data', 'sound', true, true);
Module['FS_createPath']('/data/sound', 'columns', true, true);
Module['FS_createPath']('/data/sound/columns', 'cs', true, true);
Module['FS_createPath']('/data/sound/columns', 'en', true, true);
Module['FS_createPath']('/data/sound/columns', 'nl', true, true);

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
              Module['removeRunDependency']('datafile_web/data/columns.data');

    };
    Module['addRunDependency']('datafile_web/data/columns.data');
  
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
 loadPackage({"files": [{"filename": "/data/images/columns/3-ocel.png", "start": 0, "end": 1267, "audio": 0}, {"filename": "/data/images/columns/hlava_m-_00.png", "start": 1267, "end": 1983, "audio": 0}, {"filename": "/data/images/columns/hlava_m-_01.png", "start": 1983, "end": 2708, "audio": 0}, {"filename": "/data/images/columns/hlava_m-_02.png", "start": 2708, "end": 3444, "audio": 0}, {"filename": "/data/images/columns/leva_00.png", "start": 3444, "end": 31012, "audio": 0}, {"filename": "/data/images/columns/leva_01.png", "start": 31012, "end": 59421, "audio": 0}, {"filename": "/data/images/columns/leva_02.png", "start": 59421, "end": 87722, "audio": 0}, {"filename": "/data/images/columns/leva_03.png", "start": 87722, "end": 115737, "audio": 0}, {"filename": "/data/images/columns/leva_04.png", "start": 115737, "end": 143627, "audio": 0}, {"filename": "/data/images/columns/leva_05.png", "start": 143627, "end": 171427, "audio": 0}, {"filename": "/data/images/columns/leva_06.png", "start": 171427, "end": 198823, "audio": 0}, {"filename": "/data/images/columns/leva_07.png", "start": 198823, "end": 226046, "audio": 0}, {"filename": "/data/images/columns/patka.png", "start": 226046, "end": 228847, "audio": 0}, {"filename": "/data/images/columns/prava_00.png", "start": 228847, "end": 243470, "audio": 0}, {"filename": "/data/images/columns/prava_01.png", "start": 243470, "end": 257989, "audio": 0}, {"filename": "/data/images/columns/prava_02.png", "start": 257989, "end": 272566, "audio": 0}, {"filename": "/data/images/columns/prava_03.png", "start": 272566, "end": 287158, "audio": 0}, {"filename": "/data/images/columns/prava_04.png", "start": 287158, "end": 301553, "audio": 0}, {"filename": "/data/images/columns/prava_05.png", "start": 301553, "end": 316034, "audio": 0}, {"filename": "/data/images/columns/prava_06.png", "start": 316034, "end": 330631, "audio": 0}, {"filename": "/data/images/columns/prava_07.png", "start": 330631, "end": 345364, "audio": 0}, {"filename": "/data/images/columns/prava_08.png", "start": 345364, "end": 360047, "audio": 0}, {"filename": "/data/images/columns/prava_09.png", "start": 360047, "end": 374780, "audio": 0}, {"filename": "/data/images/columns/sloupy-p.png", "start": 374780, "end": 478522, "audio": 0}, {"filename": "/data/images/columns/sloupy-w.png", "start": 478522, "end": 677888, "audio": 0}, {"filename": "/data/images/columns/stalagnat.png", "start": 677888, "end": 681855, "audio": 0}, {"filename": "/data/images/columns/stred.png", "start": 681855, "end": 694383, "audio": 0}, {"filename": "/data/images/columns/troska.png", "start": 694383, "end": 696679, "audio": 0}, {"filename": "/data/images/columns/vlys.png", "start": 696679, "end": 718698, "audio": 0}, {"filename": "/data/script/columns/code.lua", "start": 718698, "end": 735457, "audio": 0}, {"filename": "/data/script/columns/dialogs_bg.lua", "start": 735457, "end": 737656, "audio": 0}, {"filename": "/data/script/columns/dialogs_cs.lua", "start": 737656, "end": 739441, "audio": 0}, {"filename": "/data/script/columns/dialogs_de.lua", "start": 739441, "end": 741324, "audio": 0}, {"filename": "/data/script/columns/dialogs_en.lua", "start": 741324, "end": 742429, "audio": 0}, {"filename": "/data/script/columns/dialogs_es.lua", "start": 742429, "end": 744254, "audio": 0}, {"filename": "/data/script/columns/dialogs_fr.lua", "start": 744254, "end": 746127, "audio": 0}, {"filename": "/data/script/columns/dialogs_it.lua", "start": 746127, "end": 747913, "audio": 0}, {"filename": "/data/script/columns/dialogs.lua", "start": 747913, "end": 747951, "audio": 0}, {"filename": "/data/script/columns/dialogs_nl.lua", "start": 747951, "end": 749806, "audio": 0}, {"filename": "/data/script/columns/dialogs_pl.lua", "start": 749806, "end": 751590, "audio": 0}, {"filename": "/data/script/columns/dialogs_ru.lua", "start": 751590, "end": 753764, "audio": 0}, {"filename": "/data/script/columns/dialogs_sl.lua", "start": 753764, "end": 755574, "audio": 0}, {"filename": "/data/script/columns/dialogs_sv.lua", "start": 755574, "end": 757381, "audio": 0}, {"filename": "/data/script/columns/init.lua", "start": 757381, "end": 758027, "audio": 0}, {"filename": "/data/script/columns/models.lua", "start": 758027, "end": 767711, "audio": 0}, {"filename": "/data/sound/columns/cs/sl-m-nelibila.ogg", "start": 767711, "end": 783493, "audio": 1}, {"filename": "/data/sound/columns/cs/sl-m-sedi.ogg", "start": 783493, "end": 798738, "audio": 1}, {"filename": "/data/sound/columns/cs/sl-m-tehdy.ogg", "start": 798738, "end": 818822, "audio": 1}, {"filename": "/data/sound/columns/cs/sl-m-trvat.ogg", "start": 818822, "end": 837224, "audio": 1}, {"filename": "/data/sound/columns/cs/sl-m-velkolepe.ogg", "start": 837224, "end": 852026, "audio": 1}, {"filename": "/data/sound/columns/cs/sl-v-barbarka.ogg", "start": 852026, "end": 876554, "audio": 1}, {"filename": "/data/sound/columns/cs/sl-v-feidios.ogg", "start": 876554, "end": 892120, "audio": 1}, {"filename": "/data/sound/columns/cs/sl-v-nechme.ogg", "start": 892120, "end": 922181, "audio": 1}, {"filename": "/data/sound/columns/cs/sl-v-opatrne.ogg", "start": 922181, "end": 942126, "audio": 1}, {"filename": "/data/sound/columns/cs/sl-v-pust.ogg", "start": 942126, "end": 955599, "audio": 1}, {"filename": "/data/sound/columns/cs/sl-v-skoda.ogg", "start": 955599, "end": 968317, "audio": 1}, {"filename": "/data/sound/columns/cs/sl-v-stopa.ogg", "start": 968317, "end": 993696, "audio": 1}, {"filename": "/data/sound/columns/cs/sl-v-vkapse.ogg", "start": 993696, "end": 1021065, "audio": 1}, {"filename": "/data/sound/columns/en/sl-m-jekot.ogg", "start": 1021065, "end": 1029976, "audio": 1}, {"filename": "/data/sound/columns/nl/sl-m-nelibila.ogg", "start": 1029976, "end": 1047476, "audio": 1}, {"filename": "/data/sound/columns/nl/sl-m-sedi.ogg", "start": 1047476, "end": 1065297, "audio": 1}, {"filename": "/data/sound/columns/nl/sl-m-tehdy.ogg", "start": 1065297, "end": 1085864, "audio": 1}, {"filename": "/data/sound/columns/nl/sl-m-trvat.ogg", "start": 1085864, "end": 1107583, "audio": 1}, {"filename": "/data/sound/columns/nl/sl-m-velkolepe.ogg", "start": 1107583, "end": 1127880, "audio": 1}, {"filename": "/data/sound/columns/nl/sl-v-barbarka.ogg", "start": 1127880, "end": 1155991, "audio": 1}, {"filename": "/data/sound/columns/nl/sl-v-feidios.ogg", "start": 1155991, "end": 1190465, "audio": 1}, {"filename": "/data/sound/columns/nl/sl-v-nechme.ogg", "start": 1190465, "end": 1220979, "audio": 1}, {"filename": "/data/sound/columns/nl/sl-v-opatrne.ogg", "start": 1220979, "end": 1246747, "audio": 1}, {"filename": "/data/sound/columns/nl/sl-v-pust.ogg", "start": 1246747, "end": 1269629, "audio": 1}, {"filename": "/data/sound/columns/nl/sl-v-skoda.ogg", "start": 1269629, "end": 1285093, "audio": 1}, {"filename": "/data/sound/columns/nl/sl-v-stopa.ogg", "start": 1285093, "end": 1313054, "audio": 1}, {"filename": "/data/sound/columns/nl/sl-v-vkapse.ogg", "start": 1313054, "end": 1343291, "audio": 1}], "remote_package_size": 1343291, "package_uuid": "b22294ae-66d2-466d-8a18-b8c3c5b12e68"});

})();
