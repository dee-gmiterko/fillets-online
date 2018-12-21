
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
    var PACKAGE_NAME = 'web/data/warcraft.data';
    var REMOTE_PACKAGE_BASE = 'data/warcraft.data';
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
Module['FS_createPath']('/data/images', 'warcraft', true, true);
Module['FS_createPath']('/data', 'script', true, true);
Module['FS_createPath']('/data/script', 'warcraft', true, true);
Module['FS_createPath']('/data', 'sound', true, true);
Module['FS_createPath']('/data/sound', 'warcraft', true, true);
Module['FS_createPath']('/data/sound/warcraft', 'cs', true, true);
Module['FS_createPath']('/data/sound/warcraft', 'en', true, true);
Module['FS_createPath']('/data/sound/warcraft', 'nl', true, true);

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
              Module['removeRunDependency']('datafile_web/data/warcraft.data');

    };
    Module['addRunDependency']('datafile_web/data/warcraft.data');
  
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
 loadPackage({"files": [{"filename": "/data/images/warcraft/balista.png", "start": 0, "end": 1888, "audio": 0}, {"filename": "/data/images/warcraft/dul.png", "start": 1888, "end": 11063, "audio": 0}, {"filename": "/data/images/warcraft/exit.png", "start": 11063, "end": 17578, "audio": 0}, {"filename": "/data/images/warcraft/hradt.png", "start": 17578, "end": 37388, "audio": 0}, {"filename": "/data/images/warcraft/jezdec.png", "start": 37388, "end": 40790, "audio": 0}, {"filename": "/data/images/warcraft/kopi.png", "start": 40790, "end": 42638, "audio": 0}, {"filename": "/data/images/warcraft/lucistnik.png", "start": 42638, "end": 44672, "audio": 0}, {"filename": "/data/images/warcraft/peasantl.png", "start": 44672, "end": 45806, "audio": 0}, {"filename": "/data/images/warcraft/peasant.png", "start": 45806, "end": 46937, "audio": 0}, {"filename": "/data/images/warcraft/surrend.png", "start": 46937, "end": 53487, "audio": 0}, {"filename": "/data/images/warcraft/vez.png", "start": 53487, "end": 57141, "audio": 0}, {"filename": "/data/images/warcraft/warcr2-p1.png", "start": 57141, "end": 77531, "audio": 0}, {"filename": "/data/images/warcraft/warcr2-w.png", "start": 77531, "end": 103504, "audio": 0}, {"filename": "/data/script/warcraft/code.lua", "start": 103504, "end": 112887, "audio": 0}, {"filename": "/data/script/warcraft/dialogs_bg.lua", "start": 112887, "end": 116885, "audio": 0}, {"filename": "/data/script/warcraft/dialogs_cs.lua", "start": 116885, "end": 119756, "audio": 0}, {"filename": "/data/script/warcraft/dialogs_de.lua", "start": 119756, "end": 122647, "audio": 0}, {"filename": "/data/script/warcraft/dialogs_en.lua", "start": 122647, "end": 124626, "audio": 0}, {"filename": "/data/script/warcraft/dialogs_es.lua", "start": 124626, "end": 127570, "audio": 0}, {"filename": "/data/script/warcraft/dialogs_fr.lua", "start": 127570, "end": 130581, "audio": 0}, {"filename": "/data/script/warcraft/dialogs_it.lua", "start": 130581, "end": 133464, "audio": 0}, {"filename": "/data/script/warcraft/dialogs.lua", "start": 133464, "end": 133502, "audio": 0}, {"filename": "/data/script/warcraft/dialogs_nl.lua", "start": 133502, "end": 136563, "audio": 0}, {"filename": "/data/script/warcraft/dialogs_pl.lua", "start": 136563, "end": 139382, "audio": 0}, {"filename": "/data/script/warcraft/dialogs_ru.lua", "start": 139382, "end": 143328, "audio": 0}, {"filename": "/data/script/warcraft/dialogs_sv.lua", "start": 143328, "end": 146181, "audio": 0}, {"filename": "/data/script/warcraft/init.lua", "start": 146181, "end": 146828, "audio": 0}, {"filename": "/data/script/warcraft/models.lua", "start": 146828, "end": 151793, "audio": 0}, {"filename": "/data/sound/warcraft/cs/war-m-aznato.ogg", "start": 151793, "end": 180844, "audio": 1}, {"filename": "/data/sound/warcraft/cs/war-m-hodiny.ogg", "start": 180844, "end": 210463, "audio": 1}, {"filename": "/data/sound/warcraft/cs/war-m-hrad.ogg", "start": 210463, "end": 228373, "audio": 1}, {"filename": "/data/sound/warcraft/cs/war-m-kam.ogg", "start": 228373, "end": 247222, "audio": 1}, {"filename": "/data/sound/warcraft/cs/war-m-ocel.ogg", "start": 247222, "end": 267632, "audio": 1}, {"filename": "/data/sound/warcraft/cs/war-m-peoni.ogg", "start": 267632, "end": 289518, "audio": 1}, {"filename": "/data/sound/warcraft/cs/war-m-pichat.ogg", "start": 289518, "end": 358568, "audio": 1}, {"filename": "/data/sound/warcraft/cs/war-m-povazuji.ogg", "start": 358568, "end": 378386, "audio": 1}, {"filename": "/data/sound/warcraft/cs/war-v-blizzard.ogg", "start": 378386, "end": 428290, "audio": 1}, {"filename": "/data/sound/warcraft/cs/war-v-doly.ogg", "start": 428290, "end": 455443, "audio": 1}, {"filename": "/data/sound/warcraft/cs/war-v-pohadka.ogg", "start": 455443, "end": 531490, "audio": 1}, {"filename": "/data/sound/warcraft/cs/war-v-povedome.ogg", "start": 531490, "end": 549296, "audio": 1}, {"filename": "/data/sound/warcraft/cs/war-v-prozradit.ogg", "start": 549296, "end": 605147, "audio": 1}, {"filename": "/data/sound/warcraft/cs/war-v-vesnicane.ogg", "start": 605147, "end": 628596, "audio": 1}, {"filename": "/data/sound/warcraft/en/war-a-move0.ogg", "start": 628596, "end": 637126, "audio": 1}, {"filename": "/data/sound/warcraft/en/war-a-move1.ogg", "start": 637126, "end": 646974, "audio": 1}, {"filename": "/data/sound/warcraft/en/war-a-ready0.ogg", "start": 646974, "end": 656024, "audio": 1}, {"filename": "/data/sound/warcraft/en/war-a-ready1.ogg", "start": 656024, "end": 665695, "audio": 1}, {"filename": "/data/sound/warcraft/en/war-k-move0.ogg", "start": 665695, "end": 675425, "audio": 1}, {"filename": "/data/sound/warcraft/en/war-k-move1.ogg", "start": 675425, "end": 685731, "audio": 1}, {"filename": "/data/sound/warcraft/en/war-k-move2.ogg", "start": 685731, "end": 698150, "audio": 1}, {"filename": "/data/sound/warcraft/en/war-k-ready0.ogg", "start": 698150, "end": 710237, "audio": 1}, {"filename": "/data/sound/warcraft/en/war-k-ready1.ogg", "start": 710237, "end": 718072, "audio": 1}, {"filename": "/data/sound/warcraft/en/war-k-ready2.ogg", "start": 718072, "end": 727744, "audio": 1}, {"filename": "/data/sound/warcraft/nl/war-m-aznato.ogg", "start": 727744, "end": 744631, "audio": 1}, {"filename": "/data/sound/warcraft/nl/war-m-hodiny.ogg", "start": 744631, "end": 805397, "audio": 1}, {"filename": "/data/sound/warcraft/nl/war-m-hrad.ogg", "start": 805397, "end": 825726, "audio": 1}, {"filename": "/data/sound/warcraft/nl/war-m-kam.ogg", "start": 825726, "end": 844090, "audio": 1}, {"filename": "/data/sound/warcraft/nl/war-m-ocel.ogg", "start": 844090, "end": 862688, "audio": 1}, {"filename": "/data/sound/warcraft/nl/war-m-peoni.ogg", "start": 862688, "end": 881572, "audio": 1}, {"filename": "/data/sound/warcraft/nl/war-m-pichat.ogg", "start": 881572, "end": 925189, "audio": 1}, {"filename": "/data/sound/warcraft/nl/war-m-povazuji.ogg", "start": 925189, "end": 941296, "audio": 1}, {"filename": "/data/sound/warcraft/nl/war-v-blizzard.ogg", "start": 941296, "end": 989800, "audio": 1}, {"filename": "/data/sound/warcraft/nl/war-v-doly.ogg", "start": 989800, "end": 1020484, "audio": 1}, {"filename": "/data/sound/warcraft/nl/war-v-pohadka.ogg", "start": 1020484, "end": 1095062, "audio": 1}, {"filename": "/data/sound/warcraft/nl/war-v-povedome.ogg", "start": 1095062, "end": 1115726, "audio": 1}, {"filename": "/data/sound/warcraft/nl/war-v-prozradit.ogg", "start": 1115726, "end": 1167337, "audio": 1}, {"filename": "/data/sound/warcraft/nl/war-v-vesnicane.ogg", "start": 1167337, "end": 1189996, "audio": 1}], "remote_package_size": 1189996, "package_uuid": "28678c06-3549-4fd2-914a-57af05971ef2"});

})();
