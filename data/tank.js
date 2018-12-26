
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
    var PACKAGE_NAME = 'web/data/tank.data';
    var REMOTE_PACKAGE_BASE = 'data/tank.data';
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
Module['FS_createPath']('/data/images', 'tank', true, true);
Module['FS_createPath']('/data', 'script', true, true);
Module['FS_createPath']('/data/script', 'tank', true, true);
Module['FS_createPath']('/data', 'sound', true, true);
Module['FS_createPath']('/data/sound', 'tank', true, true);
Module['FS_createPath']('/data/sound/tank', 'cs', true, true);
Module['FS_createPath']('/data/sound/tank', 'nl', true, true);

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
              Module['removeRunDependency']('datafile_web/data/tank.data');

    };
    Module['addRunDependency']('datafile_web/data/tank.data');
  
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
 loadPackage({"files": [{"filename": "/data/images/tank/3-ocel.png", "start": 0, "end": 2637, "audio": 0}, {"filename": "/data/images/tank/4-ocel.png", "start": 2637, "end": 4005, "audio": 0}, {"filename": "/data/images/tank/5-ocel.png", "start": 4005, "end": 6175, "audio": 0}, {"filename": "/data/images/tank/6-ocel.png", "start": 6175, "end": 6673, "audio": 0}, {"filename": "/data/images/tank/7-ocel.png", "start": 6673, "end": 7168, "audio": 0}, {"filename": "/data/images/tank/maly_snek_00.png", "start": 7168, "end": 7842, "audio": 0}, {"filename": "/data/images/tank/maly_snek_01.png", "start": 7842, "end": 8539, "audio": 0}, {"filename": "/data/images/tank/maly_snek_02.png", "start": 8539, "end": 9256, "audio": 0}, {"filename": "/data/images/tank/maly_snek_03.png", "start": 9256, "end": 9916, "audio": 0}, {"filename": "/data/images/tank/naboj-a.png", "start": 9916, "end": 10927, "audio": 0}, {"filename": "/data/images/tank/naboj.png", "start": 10927, "end": 11922, "audio": 0}, {"filename": "/data/images/tank/patron.png", "start": 11922, "end": 12593, "audio": 0}, {"filename": "/data/images/tank/roboruka.png", "start": 12593, "end": 15334, "audio": 0}, {"filename": "/data/images/tank/svatba-okoli.png", "start": 15334, "end": 328109, "audio": 0}, {"filename": "/data/images/tank/svatba-pozadi.png", "start": 328109, "end": 631224, "audio": 0}, {"filename": "/data/images/tank/zebrik.png", "start": 631224, "end": 632692, "audio": 0}, {"filename": "/data/script/tank/code.lua", "start": 632692, "end": 636182, "audio": 0}, {"filename": "/data/script/tank/dialogs_bg.lua", "start": 636182, "end": 639434, "audio": 0}, {"filename": "/data/script/tank/dialogs_cs.lua", "start": 639434, "end": 642183, "audio": 0}, {"filename": "/data/script/tank/dialogs_de_CH.lua", "start": 642183, "end": 642365, "audio": 0}, {"filename": "/data/script/tank/dialogs_de.lua", "start": 642365, "end": 645137, "audio": 0}, {"filename": "/data/script/tank/dialogs_en.lua", "start": 645137, "end": 646686, "audio": 0}, {"filename": "/data/script/tank/dialogs_es.lua", "start": 646686, "end": 649388, "audio": 0}, {"filename": "/data/script/tank/dialogs_fr.lua", "start": 649388, "end": 652069, "audio": 0}, {"filename": "/data/script/tank/dialogs_it.lua", "start": 652069, "end": 654747, "audio": 0}, {"filename": "/data/script/tank/dialogs.lua", "start": 654747, "end": 654785, "audio": 0}, {"filename": "/data/script/tank/dialogs_nl.lua", "start": 654785, "end": 657516, "audio": 0}, {"filename": "/data/script/tank/dialogs_pl.lua", "start": 657516, "end": 660147, "audio": 0}, {"filename": "/data/script/tank/dialogs_ru.lua", "start": 660147, "end": 663317, "audio": 0}, {"filename": "/data/script/tank/dialogs_sv.lua", "start": 663317, "end": 665976, "audio": 0}, {"filename": "/data/script/tank/init.lua", "start": 665976, "end": 666619, "audio": 0}, {"filename": "/data/script/tank/models.lua", "start": 666619, "end": 670882, "audio": 0}, {"filename": "/data/sound/tank/cs/sv-m-doscasu.ogg", "start": 670882, "end": 689875, "audio": 1}, {"filename": "/data/sound/tank/cs/sv-m-kecy.ogg", "start": 689875, "end": 801841, "audio": 1}, {"filename": "/data/sound/tank/cs/sv-m-munice.ogg", "start": 801841, "end": 821120, "audio": 1}, {"filename": "/data/sound/tank/cs/sv-m-pomohli.ogg", "start": 821120, "end": 857548, "audio": 1}, {"filename": "/data/sound/tank/cs/sv-m-pravdepodob.ogg", "start": 857548, "end": 870152, "audio": 1}, {"filename": "/data/sound/tank/cs/sv-m-tank.ogg", "start": 870152, "end": 891149, "audio": 1}, {"filename": "/data/sound/tank/cs/sv-m-utecha.ogg", "start": 891149, "end": 906969, "audio": 1}, {"filename": "/data/sound/tank/cs/sv-m-ven.ogg", "start": 906969, "end": 933717, "audio": 1}, {"filename": "/data/sound/tank/cs/sv-v-bezsneku.ogg", "start": 933717, "end": 955082, "audio": 1}, {"filename": "/data/sound/tank/cs/sv-v-chtel.ogg", "start": 955082, "end": 977541, "audio": 1}, {"filename": "/data/sound/tank/cs/sv-v-nevim.ogg", "start": 977541, "end": 1003361, "audio": 1}, {"filename": "/data/sound/tank/cs/sv-v-obojzivelny.ogg", "start": 1003361, "end": 1019277, "audio": 1}, {"filename": "/data/sound/tank/cs/sv-v-potopena.ogg", "start": 1019277, "end": 1037952, "audio": 1}, {"filename": "/data/sound/tank/cs/sv-v-proc.ogg", "start": 1037952, "end": 1056909, "audio": 1}, {"filename": "/data/sound/tank/cs/sv-v-ucpat.ogg", "start": 1056909, "end": 1073937, "audio": 1}, {"filename": "/data/sound/tank/cs/sv-v-zebrik.ogg", "start": 1073937, "end": 1093066, "audio": 1}, {"filename": "/data/sound/tank/nl/sv-m-doscasu.ogg", "start": 1093066, "end": 1115128, "audio": 1}, {"filename": "/data/sound/tank/nl/sv-m-kecy.ogg", "start": 1115128, "end": 1173683, "audio": 1}, {"filename": "/data/sound/tank/nl/sv-m-munice.ogg", "start": 1173683, "end": 1194636, "audio": 1}, {"filename": "/data/sound/tank/nl/sv-m-pomohli.ogg", "start": 1194636, "end": 1225721, "audio": 1}, {"filename": "/data/sound/tank/nl/sv-m-pravdepodob.ogg", "start": 1225721, "end": 1241916, "audio": 1}, {"filename": "/data/sound/tank/nl/sv-m-tank.ogg", "start": 1241916, "end": 1262952, "audio": 1}, {"filename": "/data/sound/tank/nl/sv-m-utecha.ogg", "start": 1262952, "end": 1281502, "audio": 1}, {"filename": "/data/sound/tank/nl/sv-m-ven.ogg", "start": 1281502, "end": 1303386, "audio": 1}, {"filename": "/data/sound/tank/nl/sv-v-bezsneku.ogg", "start": 1303386, "end": 1325985, "audio": 1}, {"filename": "/data/sound/tank/nl/sv-v-chtel.ogg", "start": 1325985, "end": 1360649, "audio": 1}, {"filename": "/data/sound/tank/nl/sv-v-nevim.ogg", "start": 1360649, "end": 1386290, "audio": 1}, {"filename": "/data/sound/tank/nl/sv-v-obojzivelny.ogg", "start": 1386290, "end": 1407862, "audio": 1}, {"filename": "/data/sound/tank/nl/sv-v-potopena.ogg", "start": 1407862, "end": 1431907, "audio": 1}, {"filename": "/data/sound/tank/nl/sv-v-proc.ogg", "start": 1431907, "end": 1456897, "audio": 1}, {"filename": "/data/sound/tank/nl/sv-v-ucpat.ogg", "start": 1456897, "end": 1477374, "audio": 1}, {"filename": "/data/sound/tank/nl/sv-v-zebrik.ogg", "start": 1477374, "end": 1499630, "audio": 1}], "remote_package_size": 1499630, "package_uuid": "47964c02-a48f-4fb0-99d1-0e5cab7cf6f2"});

})();
