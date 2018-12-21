
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
    var PACKAGE_NAME = 'web/data/emulator.data';
    var REMOTE_PACKAGE_BASE = 'data/emulator.data';
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
Module['FS_createPath']('/data/images', 'emulator', true, true);
Module['FS_createPath']('/data', 'script', true, true);
Module['FS_createPath']('/data/script', 'emulator', true, true);
Module['FS_createPath']('/data', 'sound', true, true);
Module['FS_createPath']('/data/sound', 'emulator', true, true);
Module['FS_createPath']('/data/sound/emulator', 'cs', true, true);
Module['FS_createPath']('/data/sound/emulator', 'nl', true, true);

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
              Module['removeRunDependency']('datafile_web/data/emulator.data');

    };
    Module['addRunDependency']('datafile_web/data/emulator.data');
  
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
 loadPackage({"files": [{"filename": "/data/images/emulator/hwhero.png", "start": 0, "end": 212, "audio": 0}, {"filename": "/data/images/emulator/hwlife.png", "start": 212, "end": 420, "audio": 0}, {"filename": "/data/images/emulator/hwscore.png", "start": 420, "end": 819, "audio": 0}, {"filename": "/data/images/emulator/hwscore__ru.png", "start": 819, "end": 1296, "audio": 0}, {"filename": "/data/images/emulator/hwtron.png", "start": 1296, "end": 1481, "audio": 0}, {"filename": "/data/images/emulator/hwzone.png", "start": 1481, "end": 1731, "audio": 0}, {"filename": "/data/images/emulator/hwzone__ru.png", "start": 1731, "end": 1959, "audio": 0}, {"filename": "/data/images/emulator/jed.png", "start": 1959, "end": 2176, "audio": 0}, {"filename": "/data/images/emulator/jpazur.png", "start": 2176, "end": 2372, "audio": 0}, {"filename": "/data/images/emulator/jpfial.png", "start": 2372, "end": 2568, "audio": 0}, {"filename": "/data/images/emulator/jphero.png", "start": 2568, "end": 2871, "audio": 0}, {"filename": "/data/images/emulator/jppodkl.png", "start": 2871, "end": 3043, "audio": 0}, {"filename": "/data/images/emulator/jprak1.png", "start": 3043, "end": 3201, "audio": 0}, {"filename": "/data/images/emulator/jprak2.png", "start": 3201, "end": 3435, "audio": 0}, {"filename": "/data/images/emulator/jprak3.png", "start": 3435, "end": 3606, "audio": 0}, {"filename": "/data/images/emulator/knight_00.png", "start": 3606, "end": 3871, "audio": 0}, {"filename": "/data/images/emulator/knight_01.png", "start": 3871, "end": 4121, "audio": 0}, {"filename": "/data/images/emulator/knight_02.png", "start": 4121, "end": 4389, "audio": 0}, {"filename": "/data/images/emulator/knight_03.png", "start": 4389, "end": 4633, "audio": 0}, {"filename": "/data/images/emulator/knight_04.png", "start": 4633, "end": 4881, "audio": 0}, {"filename": "/data/images/emulator/knight_05.png", "start": 4881, "end": 5131, "audio": 0}, {"filename": "/data/images/emulator/knight_06.png", "start": 5131, "end": 5382, "audio": 0}, {"filename": "/data/images/emulator/mmhero.png", "start": 5382, "end": 5536, "audio": 0}, {"filename": "/data/images/emulator/mmtrub_00.png", "start": 5536, "end": 5724, "audio": 0}, {"filename": "/data/images/emulator/mmtrub_01.png", "start": 5724, "end": 5894, "audio": 0}, {"filename": "/data/images/emulator/mmtrub_02.png", "start": 5894, "end": 6066, "audio": 0}, {"filename": "/data/images/emulator/mmtrub_03.png", "start": 6066, "end": 6234, "audio": 0}, {"filename": "/data/images/emulator/spectrum.png", "start": 6234, "end": 6508, "audio": 0}, {"filename": "/data/images/emulator/zx-pozadi.png", "start": 6508, "end": 6957, "audio": 0}, {"filename": "/data/images/emulator/zx-tmp.png", "start": 6957, "end": 8153, "audio": 0}, {"filename": "/data/script/emulator/code.lua", "start": 8153, "end": 17209, "audio": 0}, {"filename": "/data/script/emulator/dialogs_bg.lua", "start": 17209, "end": 20328, "audio": 0}, {"filename": "/data/script/emulator/dialogs_cs.lua", "start": 20328, "end": 23003, "audio": 0}, {"filename": "/data/script/emulator/dialogs_de_CH.lua", "start": 23003, "end": 23556, "audio": 0}, {"filename": "/data/script/emulator/dialogs_de.lua", "start": 23556, "end": 26231, "audio": 0}, {"filename": "/data/script/emulator/dialogs_en.lua", "start": 26231, "end": 27769, "audio": 0}, {"filename": "/data/script/emulator/dialogs_es.lua", "start": 27769, "end": 30464, "audio": 0}, {"filename": "/data/script/emulator/dialogs_fr.lua", "start": 30464, "end": 33204, "audio": 0}, {"filename": "/data/script/emulator/dialogs_it.lua", "start": 33204, "end": 35887, "audio": 0}, {"filename": "/data/script/emulator/dialogs.lua", "start": 35887, "end": 35925, "audio": 0}, {"filename": "/data/script/emulator/dialogs_nl.lua", "start": 35925, "end": 38577, "audio": 0}, {"filename": "/data/script/emulator/dialogs_pl.lua", "start": 38577, "end": 41208, "audio": 0}, {"filename": "/data/script/emulator/dialogs_ru.lua", "start": 41208, "end": 44284, "audio": 0}, {"filename": "/data/script/emulator/dialogs_sv.lua", "start": 44284, "end": 46965, "audio": 0}, {"filename": "/data/script/emulator/init.lua", "start": 46965, "end": 47612, "audio": 0}, {"filename": "/data/script/emulator/models.lua", "start": 47612, "end": 52235, "audio": 0}, {"filename": "/data/sound/emulator/cs/zx-m-highway.ogg", "start": 52235, "end": 74082, "audio": 1}, {"filename": "/data/sound/emulator/cs/zx-m-jetpack.ogg", "start": 74082, "end": 103205, "audio": 1}, {"filename": "/data/sound/emulator/cs/zx-m-knight.ogg", "start": 103205, "end": 117759, "audio": 1}, {"filename": "/data/sound/emulator/cs/zx-m-necodosebe.ogg", "start": 117759, "end": 138323, "audio": 1}, {"filename": "/data/sound/emulator/cs/zx-m-ocel.ogg", "start": 138323, "end": 166029, "audio": 1}, {"filename": "/data/sound/emulator/cs/zx-m-pametnici.ogg", "start": 166029, "end": 189281, "audio": 1}, {"filename": "/data/sound/emulator/cs/zx-m-pixel.ogg", "start": 189281, "end": 221915, "audio": 1}, {"filename": "/data/sound/emulator/cs/zx-m-premyslis.ogg", "start": 221915, "end": 237327, "audio": 1}, {"filename": "/data/sound/emulator/cs/zx-v-hry.ogg", "start": 237327, "end": 266334, "audio": 1}, {"filename": "/data/sound/emulator/cs/zx-v-manicminer.ogg", "start": 266334, "end": 283629, "audio": 1}, {"filename": "/data/sound/emulator/cs/zx-v-nahravani.ogg", "start": 283629, "end": 306157, "audio": 1}, {"filename": "/data/sound/emulator/cs/zx-v-osmibit.ogg", "start": 306157, "end": 332169, "audio": 1}, {"filename": "/data/sound/emulator/cs/zx-v-otazka.ogg", "start": 332169, "end": 396219, "audio": 1}, {"filename": "/data/sound/emulator/cs/zx-v-pamet.ogg", "start": 396219, "end": 448704, "audio": 1}, {"filename": "/data/sound/emulator/cs/zx-v-roboti.ogg", "start": 448704, "end": 467610, "audio": 1}, {"filename": "/data/sound/emulator/nl/zx-m-highway.ogg", "start": 467610, "end": 490859, "audio": 1}, {"filename": "/data/sound/emulator/nl/zx-m-jetpack.ogg", "start": 490859, "end": 519995, "audio": 1}, {"filename": "/data/sound/emulator/nl/zx-m-knight.ogg", "start": 519995, "end": 538649, "audio": 1}, {"filename": "/data/sound/emulator/nl/zx-m-necodosebe.ogg", "start": 538649, "end": 564641, "audio": 1}, {"filename": "/data/sound/emulator/nl/zx-m-ocel.ogg", "start": 564641, "end": 590566, "audio": 1}, {"filename": "/data/sound/emulator/nl/zx-m-pametnici.ogg", "start": 590566, "end": 611836, "audio": 1}, {"filename": "/data/sound/emulator/nl/zx-m-pixel.ogg", "start": 611836, "end": 649910, "audio": 1}, {"filename": "/data/sound/emulator/nl/zx-m-premyslis.ogg", "start": 649910, "end": 666719, "audio": 1}, {"filename": "/data/sound/emulator/nl/zx-v-hry.ogg", "start": 666719, "end": 698479, "audio": 1}, {"filename": "/data/sound/emulator/nl/zx-v-manicminer.ogg", "start": 698479, "end": 717314, "audio": 1}, {"filename": "/data/sound/emulator/nl/zx-v-nahravani.ogg", "start": 717314, "end": 737084, "audio": 1}, {"filename": "/data/sound/emulator/nl/zx-v-osmibit.ogg", "start": 737084, "end": 759839, "audio": 1}, {"filename": "/data/sound/emulator/nl/zx-v-otazka.ogg", "start": 759839, "end": 810195, "audio": 1}, {"filename": "/data/sound/emulator/nl/zx-v-pamet.ogg", "start": 810195, "end": 861382, "audio": 1}, {"filename": "/data/sound/emulator/nl/zx-v-roboti.ogg", "start": 861382, "end": 884202, "audio": 1}], "remote_package_size": 884202, "package_uuid": "0982fba3-81fb-4582-82ed-56b660875c2b"});

})();
