
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
    var PACKAGE_NAME = 'web/data/cellar.data';
    var REMOTE_PACKAGE_BASE = 'data/cellar.data';
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
Module['FS_createPath']('/data/images', 'cellar', true, true);
Module['FS_createPath']('/data', 'script', true, true);
Module['FS_createPath']('/data/script', 'cellar', true, true);
Module['FS_createPath']('/data', 'sound', true, true);
Module['FS_createPath']('/data/sound', 'cellar', true, true);
Module['FS_createPath']('/data/sound/cellar', 'cs', true, true);
Module['FS_createPath']('/data/sound/cellar', 'nl', true, true);

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
              Module['removeRunDependency']('datafile_web/data/cellar.data');

    };
    Module['addRunDependency']('datafile_web/data/cellar.data');
  
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
 loadPackage({"files": [{"filename": "/data/images/cellar/11-ocel.png", "start": 0, "end": 498, "audio": 0}, {"filename": "/data/images/cellar/13-ocel.png", "start": 498, "end": 2217, "audio": 0}, {"filename": "/data/images/cellar/15-ocel.png", "start": 2217, "end": 2913, "audio": 0}, {"filename": "/data/images/cellar/6-ocel.png", "start": 2913, "end": 3609, "audio": 0}, {"filename": "/data/images/cellar/cup.png", "start": 3609, "end": 4507, "audio": 0}, {"filename": "/data/images/cellar/kniha.png", "start": 4507, "end": 5802, "audio": 0}, {"filename": "/data/images/cellar/maly_snek_00.png", "start": 5802, "end": 6476, "audio": 0}, {"filename": "/data/images/cellar/maly_snek_01.png", "start": 6476, "end": 7173, "audio": 0}, {"filename": "/data/images/cellar/maly_snek_02.png", "start": 7173, "end": 7890, "audio": 0}, {"filename": "/data/images/cellar/maly_snek_03.png", "start": 7890, "end": 8550, "audio": 0}, {"filename": "/data/images/cellar/marmelada.png", "start": 8550, "end": 10051, "audio": 0}, {"filename": "/data/images/cellar/med.png", "start": 10051, "end": 11986, "audio": 0}, {"filename": "/data/images/cellar/merunkova.png", "start": 11986, "end": 13640, "audio": 0}, {"filename": "/data/images/cellar/misa.png", "start": 13640, "end": 15570, "audio": 0}, {"filename": "/data/images/cellar/pravidla-p.png", "start": 15570, "end": 201591, "audio": 0}, {"filename": "/data/images/cellar/pravidla-w.png", "start": 201591, "end": 571937, "audio": 0}, {"filename": "/data/images/cellar/sekera_00.png", "start": 571937, "end": 574244, "audio": 0}, {"filename": "/data/images/cellar/sekera_01.png", "start": 574244, "end": 576571, "audio": 0}, {"filename": "/data/images/cellar/sekera_02.png", "start": 576571, "end": 578910, "audio": 0}, {"filename": "/data/images/cellar/shell1.png", "start": 578910, "end": 579641, "audio": 0}, {"filename": "/data/images/cellar/svicka.png", "start": 579641, "end": 583422, "audio": 0}, {"filename": "/data/script/cellar/code.lua", "start": 583422, "end": 590769, "audio": 0}, {"filename": "/data/script/cellar/dialogs_bg.lua", "start": 590769, "end": 597027, "audio": 0}, {"filename": "/data/script/cellar/dialogs_cs.lua", "start": 597027, "end": 602099, "audio": 0}, {"filename": "/data/script/cellar/dialogs_de.lua", "start": 602099, "end": 607338, "audio": 0}, {"filename": "/data/script/cellar/dialogs_en.lua", "start": 607338, "end": 610306, "audio": 0}, {"filename": "/data/script/cellar/dialogs_es.lua", "start": 610306, "end": 615537, "audio": 0}, {"filename": "/data/script/cellar/dialogs_fr.lua", "start": 615537, "end": 620757, "audio": 0}, {"filename": "/data/script/cellar/dialogs_it.lua", "start": 620757, "end": 625784, "audio": 0}, {"filename": "/data/script/cellar/dialogs.lua", "start": 625784, "end": 625822, "audio": 0}, {"filename": "/data/script/cellar/dialogs_nl.lua", "start": 625822, "end": 630978, "audio": 0}, {"filename": "/data/script/cellar/dialogs_pl.lua", "start": 630978, "end": 636103, "audio": 0}, {"filename": "/data/script/cellar/dialogs_ru.lua", "start": 636103, "end": 642531, "audio": 0}, {"filename": "/data/script/cellar/dialogs_sl.lua", "start": 642531, "end": 647599, "audio": 0}, {"filename": "/data/script/cellar/dialogs_sv.lua", "start": 647599, "end": 652673, "audio": 0}, {"filename": "/data/script/cellar/init.lua", "start": 652673, "end": 653318, "audio": 0}, {"filename": "/data/script/cellar/models.lua", "start": 653318, "end": 656748, "audio": 0}, {"filename": "/data/sound/cellar/cs/pra-m-chytit.ogg", "start": 656748, "end": 684535, "audio": 1}, {"filename": "/data/sound/cellar/cs/pra-m-jakudelat.ogg", "start": 684535, "end": 707259, "audio": 1}, {"filename": "/data/sound/cellar/cs/pra-m-kniha.ogg", "start": 707259, "end": 741074, "audio": 1}, {"filename": "/data/sound/cellar/cs/pra-m-nepohnu.ogg", "start": 741074, "end": 760655, "audio": 1}, {"filename": "/data/sound/cellar/cs/pra-m-neradit.ogg", "start": 760655, "end": 781018, "audio": 1}, {"filename": "/data/sound/cellar/cs/pra-m-pravidla.ogg", "start": 781018, "end": 814425, "audio": 1}, {"filename": "/data/sound/cellar/cs/pra-m-prisun.ogg", "start": 814425, "end": 842334, "audio": 1}, {"filename": "/data/sound/cellar/cs/pra-m-pustis.ogg", "start": 842334, "end": 875696, "audio": 1}, {"filename": "/data/sound/cellar/cs/pra-m-reseni.ogg", "start": 875696, "end": 901144, "audio": 1}, {"filename": "/data/sound/cellar/cs/pra-m-restart.ogg", "start": 901144, "end": 927634, "audio": 1}, {"filename": "/data/sound/cellar/cs/pra-m-stava.ogg", "start": 927634, "end": 944454, "audio": 1}, {"filename": "/data/sound/cellar/cs/pra-m-strach.ogg", "start": 944454, "end": 973912, "audio": 1}, {"filename": "/data/sound/cellar/cs/pra-m-uvazovat.ogg", "start": 973912, "end": 990801, "audio": 1}, {"filename": "/data/sound/cellar/cs/pra-m-vyrazit.ogg", "start": 990801, "end": 1008060, "audio": 1}, {"filename": "/data/sound/cellar/cs/pra-m-znovu.ogg", "start": 1008060, "end": 1035212, "audio": 1}, {"filename": "/data/sound/cellar/cs/pra-m-zpatky.ogg", "start": 1035212, "end": 1056290, "audio": 1}, {"filename": "/data/sound/cellar/cs/pra-v-dobrynapad.ogg", "start": 1056290, "end": 1068728, "audio": 1}, {"filename": "/data/sound/cellar/cs/pra-v-dopredu.ogg", "start": 1068728, "end": 1093454, "audio": 1}, {"filename": "/data/sound/cellar/cs/pra-v-klesnout.ogg", "start": 1093454, "end": 1129534, "audio": 1}, {"filename": "/data/sound/cellar/cs/pra-v-nahore.ogg", "start": 1129534, "end": 1158978, "audio": 1}, {"filename": "/data/sound/cellar/cs/pra-v-nezapomen.ogg", "start": 1158978, "end": 1207629, "audio": 1}, {"filename": "/data/sound/cellar/cs/pra-v-objet.ogg", "start": 1207629, "end": 1223550, "audio": 1}, {"filename": "/data/sound/cellar/cs/pra-v-prekvapit.ogg", "start": 1223550, "end": 1238203, "audio": 1}, {"filename": "/data/sound/cellar/cs/pra-v-problem.ogg", "start": 1238203, "end": 1268166, "audio": 1}, {"filename": "/data/sound/cellar/cs/pra-v-schvalne.ogg", "start": 1268166, "end": 1293844, "audio": 1}, {"filename": "/data/sound/cellar/cs/pra-v-spatne.ogg", "start": 1293844, "end": 1323884, "audio": 1}, {"filename": "/data/sound/cellar/cs/pra-v-ukladani.ogg", "start": 1323884, "end": 1350345, "audio": 1}, {"filename": "/data/sound/cellar/cs/pra-v-valec.ogg", "start": 1350345, "end": 1377199, "audio": 1}, {"filename": "/data/sound/cellar/cs/pra-v-vzit.ogg", "start": 1377199, "end": 1393156, "audio": 1}, {"filename": "/data/sound/cellar/cs/pra-v-zapeklita.ogg", "start": 1393156, "end": 1439286, "audio": 1}, {"filename": "/data/sound/cellar/cs/pra-v-zavazis.ogg", "start": 1439286, "end": 1461704, "audio": 1}, {"filename": "/data/sound/cellar/nl/pra-m-chytit.ogg", "start": 1461704, "end": 1487391, "audio": 1}, {"filename": "/data/sound/cellar/nl/pra-m-jakudelat.ogg", "start": 1487391, "end": 1507186, "audio": 1}, {"filename": "/data/sound/cellar/nl/pra-m-kniha.ogg", "start": 1507186, "end": 1536096, "audio": 1}, {"filename": "/data/sound/cellar/nl/pra-m-nepohnu.ogg", "start": 1536096, "end": 1558283, "audio": 1}, {"filename": "/data/sound/cellar/nl/pra-m-neradit.ogg", "start": 1558283, "end": 1573768, "audio": 1}, {"filename": "/data/sound/cellar/nl/pra-m-pravidla.ogg", "start": 1573768, "end": 1604625, "audio": 1}, {"filename": "/data/sound/cellar/nl/pra-m-prisun.ogg", "start": 1604625, "end": 1636743, "audio": 1}, {"filename": "/data/sound/cellar/nl/pra-m-pustis.ogg", "start": 1636743, "end": 1666874, "audio": 1}, {"filename": "/data/sound/cellar/nl/pra-m-reseni.ogg", "start": 1666874, "end": 1689371, "audio": 1}, {"filename": "/data/sound/cellar/nl/pra-m-restart.ogg", "start": 1689371, "end": 1707990, "audio": 1}, {"filename": "/data/sound/cellar/nl/pra-m-stava.ogg", "start": 1707990, "end": 1728561, "audio": 1}, {"filename": "/data/sound/cellar/nl/pra-m-strach.ogg", "start": 1728561, "end": 1760128, "audio": 1}, {"filename": "/data/sound/cellar/nl/pra-m-uvazovat.ogg", "start": 1760128, "end": 1779367, "audio": 1}, {"filename": "/data/sound/cellar/nl/pra-m-vyrazit.ogg", "start": 1779367, "end": 1802257, "audio": 1}, {"filename": "/data/sound/cellar/nl/pra-m-znovu.ogg", "start": 1802257, "end": 1828105, "audio": 1}, {"filename": "/data/sound/cellar/nl/pra-m-zpatky.ogg", "start": 1828105, "end": 1850044, "audio": 1}, {"filename": "/data/sound/cellar/nl/pra-v-dobrynapad.ogg", "start": 1850044, "end": 1867887, "audio": 1}, {"filename": "/data/sound/cellar/nl/pra-v-dopredu.ogg", "start": 1867887, "end": 1893708, "audio": 1}, {"filename": "/data/sound/cellar/nl/pra-v-klesnout.ogg", "start": 1893708, "end": 1923625, "audio": 1}, {"filename": "/data/sound/cellar/nl/pra-v-nahore.ogg", "start": 1923625, "end": 1954799, "audio": 1}, {"filename": "/data/sound/cellar/nl/pra-v-nezapomen.ogg", "start": 1954799, "end": 1998590, "audio": 1}, {"filename": "/data/sound/cellar/nl/pra-v-objet.ogg", "start": 1998590, "end": 2022212, "audio": 1}, {"filename": "/data/sound/cellar/nl/pra-v-prekvapit.ogg", "start": 2022212, "end": 2038801, "audio": 1}, {"filename": "/data/sound/cellar/nl/pra-v-problem.ogg", "start": 2038801, "end": 2067257, "audio": 1}, {"filename": "/data/sound/cellar/nl/pra-v-schvalne.ogg", "start": 2067257, "end": 2089737, "audio": 1}, {"filename": "/data/sound/cellar/nl/pra-v-spatne.ogg", "start": 2089737, "end": 2119582, "audio": 1}, {"filename": "/data/sound/cellar/nl/pra-v-ukladani.ogg", "start": 2119582, "end": 2150417, "audio": 1}, {"filename": "/data/sound/cellar/nl/pra-v-valec.ogg", "start": 2150417, "end": 2182423, "audio": 1}, {"filename": "/data/sound/cellar/nl/pra-v-vzit.ogg", "start": 2182423, "end": 2204109, "audio": 1}, {"filename": "/data/sound/cellar/nl/pra-v-zapeklita.ogg", "start": 2204109, "end": 2247734, "audio": 1}, {"filename": "/data/sound/cellar/nl/pra-v-zavazis.ogg", "start": 2247734, "end": 2276685, "audio": 1}], "remote_package_size": 2276685, "package_uuid": "d83d2f9a-102d-4d96-8f20-717cc7ada089"});

})();
