
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
    var PACKAGE_NAME = 'web/data/pearls.data';
    var REMOTE_PACKAGE_BASE = 'data/pearls.data';
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
Module['FS_createPath']('/data/images', 'pearls', true, true);
Module['FS_createPath']('/data', 'script', true, true);
Module['FS_createPath']('/data/script', 'pearls', true, true);
Module['FS_createPath']('/data', 'sound', true, true);
Module['FS_createPath']('/data/sound', 'pearls', true, true);
Module['FS_createPath']('/data/sound/pearls', 'cs', true, true);
Module['FS_createPath']('/data/sound/pearls', 'nl', true, true);

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
              Module['removeRunDependency']('datafile_web/data/pearls.data');

    };
    Module['addRunDependency']('datafile_web/data/pearls.data');
  
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
 loadPackage({"files": [{"filename": "/data/images/pearls/1-ocel.png", "start": 0, "end": 909, "audio": 0}, {"filename": "/data/images/pearls/2-ocel.png", "start": 909, "end": 1407, "audio": 0}, {"filename": "/data/images/pearls/jednicky-p.png", "start": 1407, "end": 255890, "audio": 0}, {"filename": "/data/images/pearls/jednicky-w.png", "start": 255890, "end": 510459, "audio": 0}, {"filename": "/data/images/pearls/koral.png", "start": 510459, "end": 514113, "audio": 0}, {"filename": "/data/images/pearls/musla.png", "start": 514113, "end": 515343, "audio": 0}, {"filename": "/data/images/pearls/musle_troj.png", "start": 515343, "end": 516887, "audio": 0}, {"filename": "/data/images/pearls/perla_00.png", "start": 516887, "end": 517427, "audio": 0}, {"filename": "/data/images/pearls/perla_01.png", "start": 517427, "end": 517982, "audio": 0}, {"filename": "/data/images/pearls/perla_02.png", "start": 517982, "end": 518537, "audio": 0}, {"filename": "/data/images/pearls/perla_03.png", "start": 518537, "end": 519091, "audio": 0}, {"filename": "/data/images/pearls/zeva_00.png", "start": 519091, "end": 523152, "audio": 0}, {"filename": "/data/images/pearls/zeva_01.png", "start": 523152, "end": 527446, "audio": 0}, {"filename": "/data/images/pearls/zeva_02.png", "start": 527446, "end": 531473, "audio": 0}, {"filename": "/data/images/pearls/zeva_03.png", "start": 531473, "end": 535803, "audio": 0}, {"filename": "/data/images/pearls/zeva_04.png", "start": 535803, "end": 539925, "audio": 0}, {"filename": "/data/images/pearls/zeva_05.png", "start": 539925, "end": 544043, "audio": 0}, {"filename": "/data/images/pearls/zeva_06.png", "start": 544043, "end": 548171, "audio": 0}, {"filename": "/data/images/pearls/zeva_07.png", "start": 548171, "end": 552290, "audio": 0}, {"filename": "/data/script/pearls/code.lua", "start": 552290, "end": 563394, "audio": 0}, {"filename": "/data/script/pearls/dialogs_bg.lua", "start": 563394, "end": 566446, "audio": 0}, {"filename": "/data/script/pearls/dialogs_cs.lua", "start": 566446, "end": 569093, "audio": 0}, {"filename": "/data/script/pearls/dialogs_de.lua", "start": 569093, "end": 571784, "audio": 0}, {"filename": "/data/script/pearls/dialogs_en.lua", "start": 571784, "end": 573379, "audio": 0}, {"filename": "/data/script/pearls/dialogs_es.lua", "start": 573379, "end": 576020, "audio": 0}, {"filename": "/data/script/pearls/dialogs_fr.lua", "start": 576020, "end": 578761, "audio": 0}, {"filename": "/data/script/pearls/dialogs_it.lua", "start": 578761, "end": 581364, "audio": 0}, {"filename": "/data/script/pearls/dialogs.lua", "start": 581364, "end": 581402, "audio": 0}, {"filename": "/data/script/pearls/dialogs_nl.lua", "start": 581402, "end": 584102, "audio": 0}, {"filename": "/data/script/pearls/dialogs_pl.lua", "start": 584102, "end": 586751, "audio": 0}, {"filename": "/data/script/pearls/dialogs_ru.lua", "start": 586751, "end": 590090, "audio": 0}, {"filename": "/data/script/pearls/dialogs_sv.lua", "start": 590090, "end": 592743, "audio": 0}, {"filename": "/data/script/pearls/init.lua", "start": 592743, "end": 593388, "audio": 0}, {"filename": "/data/script/pearls/models.lua", "start": 593388, "end": 597814, "audio": 0}, {"filename": "/data/sound/pearls/cs/jed-m-flakas.ogg", "start": 597814, "end": 626339, "audio": 1}, {"filename": "/data/sound/pearls/cs/jed-m-kulicka.ogg", "start": 626339, "end": 658994, "audio": 1}, {"filename": "/data/sound/pearls/cs/jed-m-libi.ogg", "start": 658994, "end": 675605, "audio": 1}, {"filename": "/data/sound/pearls/cs/jed-m-moc.ogg", "start": 675605, "end": 696914, "audio": 1}, {"filename": "/data/sound/pearls/cs/jed-m-perlorodka0.ogg", "start": 696914, "end": 715374, "audio": 1}, {"filename": "/data/sound/pearls/cs/jed-m-perlorodka1.ogg", "start": 715374, "end": 733826, "audio": 1}, {"filename": "/data/sound/pearls/cs/jed-m-perlorodka2.ogg", "start": 733826, "end": 772070, "audio": 1}, {"filename": "/data/sound/pearls/cs/jed-m-perly0.ogg", "start": 772070, "end": 787672, "audio": 1}, {"filename": "/data/sound/pearls/cs/jed-m-perly1.ogg", "start": 787672, "end": 802417, "audio": 1}, {"filename": "/data/sound/pearls/cs/jed-m-trubka.ogg", "start": 802417, "end": 827656, "audio": 1}, {"filename": "/data/sound/pearls/cs/jed-v-ocet.ogg", "start": 827656, "end": 849615, "audio": 1}, {"filename": "/data/sound/pearls/cs/jed-v-poslani0.ogg", "start": 849615, "end": 871954, "audio": 1}, {"filename": "/data/sound/pearls/cs/jed-v-poslani1.ogg", "start": 871954, "end": 886334, "audio": 1}, {"filename": "/data/sound/pearls/cs/jed-v-poslani2.ogg", "start": 886334, "end": 905222, "audio": 1}, {"filename": "/data/sound/pearls/cs/jed-v-poter.ogg", "start": 905222, "end": 933946, "audio": 1}, {"filename": "/data/sound/pearls/cs/jed-v-uzivat0.ogg", "start": 933946, "end": 954734, "audio": 1}, {"filename": "/data/sound/pearls/cs/jed-v-uzivat1.ogg", "start": 954734, "end": 976238, "audio": 1}, {"filename": "/data/sound/pearls/cs/jed-v-vzdelat.ogg", "start": 976238, "end": 993100, "audio": 1}, {"filename": "/data/sound/pearls/cs/jed-x-nedam.ogg", "start": 993100, "end": 1005623, "audio": 1}, {"filename": "/data/sound/pearls/nl/jed-m-flakas.ogg", "start": 1005623, "end": 1032002, "audio": 1}, {"filename": "/data/sound/pearls/nl/jed-m-kulicka.ogg", "start": 1032002, "end": 1052269, "audio": 1}, {"filename": "/data/sound/pearls/nl/jed-m-libi.ogg", "start": 1052269, "end": 1069955, "audio": 1}, {"filename": "/data/sound/pearls/nl/jed-m-moc.ogg", "start": 1069955, "end": 1090533, "audio": 1}, {"filename": "/data/sound/pearls/nl/jed-m-perlorodka0.ogg", "start": 1090533, "end": 1110059, "audio": 1}, {"filename": "/data/sound/pearls/nl/jed-m-perlorodka1.ogg", "start": 1110059, "end": 1129877, "audio": 1}, {"filename": "/data/sound/pearls/nl/jed-m-perlorodka2.ogg", "start": 1129877, "end": 1158031, "audio": 1}, {"filename": "/data/sound/pearls/nl/jed-m-perly0.ogg", "start": 1158031, "end": 1176682, "audio": 1}, {"filename": "/data/sound/pearls/nl/jed-m-perly1.ogg", "start": 1176682, "end": 1198451, "audio": 1}, {"filename": "/data/sound/pearls/nl/jed-m-trubka.ogg", "start": 1198451, "end": 1229915, "audio": 1}, {"filename": "/data/sound/pearls/nl/jed-v-ocet.ogg", "start": 1229915, "end": 1256879, "audio": 1}, {"filename": "/data/sound/pearls/nl/jed-v-poslani0.ogg", "start": 1256879, "end": 1281562, "audio": 1}, {"filename": "/data/sound/pearls/nl/jed-v-poslani1.ogg", "start": 1281562, "end": 1300122, "audio": 1}, {"filename": "/data/sound/pearls/nl/jed-v-poslani2.ogg", "start": 1300122, "end": 1322822, "audio": 1}, {"filename": "/data/sound/pearls/nl/jed-v-poter.ogg", "start": 1322822, "end": 1358493, "audio": 1}, {"filename": "/data/sound/pearls/nl/jed-v-uzivat0.ogg", "start": 1358493, "end": 1377880, "audio": 1}, {"filename": "/data/sound/pearls/nl/jed-v-uzivat1.ogg", "start": 1377880, "end": 1398359, "audio": 1}, {"filename": "/data/sound/pearls/nl/jed-v-vzdelat.ogg", "start": 1398359, "end": 1421919, "audio": 1}], "remote_package_size": 1421919, "package_uuid": "d8e8e6e1-7920-475b-be60-08fe4a3f84e1"});

})();
