
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
    var PACKAGE_NAME = 'web/data/pyramid.data';
    var REMOTE_PACKAGE_BASE = 'data/pyramid.data';
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
Module['FS_createPath']('/data/images', 'pyramid', true, true);
Module['FS_createPath']('/data', 'script', true, true);
Module['FS_createPath']('/data/script', 'pyramid', true, true);
Module['FS_createPath']('/data', 'sound', true, true);
Module['FS_createPath']('/data/sound', 'pyramid', true, true);
Module['FS_createPath']('/data/sound/pyramid', 'cs', true, true);
Module['FS_createPath']('/data/sound/pyramid', 'nl', true, true);

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
              Module['removeRunDependency']('datafile_web/data/pyramid.data');

    };
    Module['addRunDependency']('datafile_web/data/pyramid.data');
  
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
 loadPackage({"files": [{"filename": "/data/images/pyramid/bunker-14-tmp.png", "start": 0, "end": 2108, "audio": 0}, {"filename": "/data/images/pyramid/bunker-4-tmp.png", "start": 2108, "end": 3642, "audio": 0}, {"filename": "/data/images/pyramid/bunker-p.png", "start": 3642, "end": 351647, "audio": 0}, {"filename": "/data/images/pyramid/bunker-w.png", "start": 351647, "end": 475161, "audio": 0}, {"filename": "/data/images/pyramid/cerv_00.png", "start": 475161, "end": 475332, "audio": 0}, {"filename": "/data/images/pyramid/cerv_01.png", "start": 475332, "end": 475503, "audio": 0}, {"filename": "/data/images/pyramid/cerv_02.png", "start": 475503, "end": 475675, "audio": 0}, {"filename": "/data/images/pyramid/cerv_03.png", "start": 475675, "end": 475846, "audio": 0}, {"filename": "/data/images/pyramid/cerv_04.png", "start": 475846, "end": 476018, "audio": 0}, {"filename": "/data/images/pyramid/cerv_05.png", "start": 476018, "end": 476193, "audio": 0}, {"filename": "/data/images/pyramid/cerv_06.png", "start": 476193, "end": 476364, "audio": 0}, {"filename": "/data/images/pyramid/cerv_07.png", "start": 476364, "end": 476538, "audio": 0}, {"filename": "/data/images/pyramid/desticka.png", "start": 476538, "end": 477903, "audio": 0}, {"filename": "/data/images/pyramid/faraon_00.png", "start": 477903, "end": 483036, "audio": 0}, {"filename": "/data/images/pyramid/faraon_01.png", "start": 483036, "end": 488042, "audio": 0}, {"filename": "/data/images/pyramid/faraon_02.png", "start": 488042, "end": 493309, "audio": 0}, {"filename": "/data/images/pyramid/mumycat.png", "start": 493309, "end": 495215, "audio": 0}, {"filename": "/data/images/pyramid/mumysokol.png", "start": 495215, "end": 497101, "audio": 0}, {"filename": "/data/images/pyramid/scarab.png", "start": 497101, "end": 497822, "audio": 0}, {"filename": "/data/images/pyramid/stela_00.png", "start": 497822, "end": 503653, "audio": 0}, {"filename": "/data/images/pyramid/stela_01.png", "start": 503653, "end": 509299, "audio": 0}, {"filename": "/data/images/pyramid/stela_02.png", "start": 509299, "end": 514917, "audio": 0}, {"filename": "/data/images/pyramid/stela_03.png", "start": 514917, "end": 519967, "audio": 0}, {"filename": "/data/images/pyramid/stela_04.png", "start": 519967, "end": 525233, "audio": 0}, {"filename": "/data/images/pyramid/stela_05.png", "start": 525233, "end": 530120, "audio": 0}, {"filename": "/data/images/pyramid/stul.png", "start": 530120, "end": 533949, "audio": 0}, {"filename": "/data/script/pyramid/code.lua", "start": 533949, "end": 544815, "audio": 0}, {"filename": "/data/script/pyramid/dialogs_bg.lua", "start": 544815, "end": 546579, "audio": 0}, {"filename": "/data/script/pyramid/dialogs_cs.lua", "start": 546579, "end": 548111, "audio": 0}, {"filename": "/data/script/pyramid/dialogs_de.lua", "start": 548111, "end": 549678, "audio": 0}, {"filename": "/data/script/pyramid/dialogs_en.lua", "start": 549678, "end": 550612, "audio": 0}, {"filename": "/data/script/pyramid/dialogs_es.lua", "start": 550612, "end": 552176, "audio": 0}, {"filename": "/data/script/pyramid/dialogs_fr.lua", "start": 552176, "end": 553770, "audio": 0}, {"filename": "/data/script/pyramid/dialogs_it.lua", "start": 553770, "end": 555191, "audio": 0}, {"filename": "/data/script/pyramid/dialogs.lua", "start": 555191, "end": 555229, "audio": 0}, {"filename": "/data/script/pyramid/dialogs_nl.lua", "start": 555229, "end": 556766, "audio": 0}, {"filename": "/data/script/pyramid/dialogs_pl.lua", "start": 556766, "end": 558302, "audio": 0}, {"filename": "/data/script/pyramid/dialogs_ru.lua", "start": 558302, "end": 560085, "audio": 0}, {"filename": "/data/script/pyramid/dialogs_sv.lua", "start": 560085, "end": 561619, "audio": 0}, {"filename": "/data/script/pyramid/init.lua", "start": 561619, "end": 562265, "audio": 0}, {"filename": "/data/script/pyramid/models.lua", "start": 562265, "end": 565873, "audio": 0}, {"filename": "/data/sound/pyramid/cs/pyr-m-comy.ogg", "start": 565873, "end": 581884, "audio": 1}, {"filename": "/data/sound/pyramid/cs/pyr-m-dest.ogg", "start": 581884, "end": 599867, "audio": 1}, {"filename": "/data/sound/pyramid/cs/pyr-m-kam.ogg", "start": 599867, "end": 615051, "audio": 1}, {"filename": "/data/sound/pyramid/cs/pyr-m-nic.ogg", "start": 615051, "end": 630908, "audio": 1}, {"filename": "/data/sound/pyramid/cs/pyr-m-nudi.ogg", "start": 630908, "end": 652126, "audio": 1}, {"filename": "/data/sound/pyramid/cs/pyr-m-plaz.ogg", "start": 652126, "end": 666339, "audio": 1}, {"filename": "/data/sound/pyramid/cs/pyr-m-zkus.ogg", "start": 666339, "end": 686200, "audio": 1}, {"filename": "/data/sound/pyramid/cs/pyr-v-druha.ogg", "start": 686200, "end": 714405, "audio": 1}, {"filename": "/data/sound/pyramid/cs/pyr-v-sark.ogg", "start": 714405, "end": 733610, "audio": 1}, {"filename": "/data/sound/pyramid/cs/pyr-v-sbohem.ogg", "start": 733610, "end": 760631, "audio": 1}, {"filename": "/data/sound/pyramid/cs/pyr-v-sfing.ogg", "start": 760631, "end": 772303, "audio": 1}, {"filename": "/data/sound/pyramid/cs/pyr-v-vsim.ogg", "start": 772303, "end": 808443, "audio": 1}, {"filename": "/data/sound/pyramid/nl/pyr-m-comy.ogg", "start": 808443, "end": 827036, "audio": 1}, {"filename": "/data/sound/pyramid/nl/pyr-m-dest.ogg", "start": 827036, "end": 847159, "audio": 1}, {"filename": "/data/sound/pyramid/nl/pyr-m-kam.ogg", "start": 847159, "end": 865709, "audio": 1}, {"filename": "/data/sound/pyramid/nl/pyr-m-nic.ogg", "start": 865709, "end": 881932, "audio": 1}, {"filename": "/data/sound/pyramid/nl/pyr-m-nudi.ogg", "start": 881932, "end": 903544, "audio": 1}, {"filename": "/data/sound/pyramid/nl/pyr-m-plaz.ogg", "start": 903544, "end": 920053, "audio": 1}, {"filename": "/data/sound/pyramid/nl/pyr-m-zkus.ogg", "start": 920053, "end": 941507, "audio": 1}, {"filename": "/data/sound/pyramid/nl/pyr-v-druha.ogg", "start": 941507, "end": 972606, "audio": 1}, {"filename": "/data/sound/pyramid/nl/pyr-v-sark.ogg", "start": 972606, "end": 991872, "audio": 1}, {"filename": "/data/sound/pyramid/nl/pyr-v-sbohem.ogg", "start": 991872, "end": 1012662, "audio": 1}, {"filename": "/data/sound/pyramid/nl/pyr-v-sfing.ogg", "start": 1012662, "end": 1029537, "audio": 1}, {"filename": "/data/sound/pyramid/nl/pyr-v-vsim.ogg", "start": 1029537, "end": 1064777, "audio": 1}], "remote_package_size": 1064777, "package_uuid": "12f7347c-991a-4caa-8373-af6e033132c1"});

})();
