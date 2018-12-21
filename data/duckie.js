
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
    var PACKAGE_NAME = 'web/data/duckie.data';
    var REMOTE_PACKAGE_BASE = 'data/duckie.data';
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
Module['FS_createPath']('/data/images', 'duckie', true, true);
Module['FS_createPath']('/data', 'script', true, true);
Module['FS_createPath']('/data/script', 'duckie', true, true);
Module['FS_createPath']('/data', 'sound', true, true);
Module['FS_createPath']('/data/sound', 'duckie', true, true);
Module['FS_createPath']('/data/sound/duckie', 'cs', true, true);
Module['FS_createPath']('/data/sound/duckie', 'nl', true, true);

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
              Module['removeRunDependency']('datafile_web/data/duckie.data');

    };
    Module['addRunDependency']('datafile_web/data/duckie.data');
  
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
 loadPackage({"files": [{"filename": "/data/images/duckie/cola.png", "start": 0, "end": 1161, "audio": 0}, {"filename": "/data/images/duckie/kachna.png", "start": 1161, "end": 4903, "audio": 0}, {"filename": "/data/images/duckie/kohoutek.png", "start": 4903, "end": 6978, "audio": 0}, {"filename": "/data/images/duckie/odpadky-11-tmp.png", "start": 6978, "end": 10225, "audio": 0}, {"filename": "/data/images/duckie/odpadky-p.png", "start": 10225, "end": 124758, "audio": 0}, {"filename": "/data/images/duckie/odpadky-w.png", "start": 124758, "end": 297248, "audio": 0}, {"filename": "/data/images/duckie/prkno.png", "start": 297248, "end": 298936, "audio": 0}, {"filename": "/data/images/duckie/roura_m.png", "start": 298936, "end": 300411, "audio": 0}, {"filename": "/data/images/duckie/roura_st.png", "start": 300411, "end": 302273, "audio": 0}, {"filename": "/data/images/duckie/roura_v.png", "start": 302273, "end": 305071, "audio": 0}, {"filename": "/data/script/duckie/code.lua", "start": 305071, "end": 308533, "audio": 0}, {"filename": "/data/script/duckie/dialogs_bg.lua", "start": 308533, "end": 310253, "audio": 0}, {"filename": "/data/script/duckie/dialogs_cs.lua", "start": 310253, "end": 311750, "audio": 0}, {"filename": "/data/script/duckie/dialogs_de.lua", "start": 311750, "end": 313284, "audio": 0}, {"filename": "/data/script/duckie/dialogs_en.lua", "start": 313284, "end": 314190, "audio": 0}, {"filename": "/data/script/duckie/dialogs_es.lua", "start": 314190, "end": 315702, "audio": 0}, {"filename": "/data/script/duckie/dialogs_fr.lua", "start": 315702, "end": 317212, "audio": 0}, {"filename": "/data/script/duckie/dialogs_it.lua", "start": 317212, "end": 318644, "audio": 0}, {"filename": "/data/script/duckie/dialogs.lua", "start": 318644, "end": 318682, "audio": 0}, {"filename": "/data/script/duckie/dialogs_nl.lua", "start": 318682, "end": 320170, "audio": 0}, {"filename": "/data/script/duckie/dialogs_pl.lua", "start": 320170, "end": 321612, "audio": 0}, {"filename": "/data/script/duckie/dialogs_ru.lua", "start": 321612, "end": 323386, "audio": 0}, {"filename": "/data/script/duckie/dialogs_sv.lua", "start": 323386, "end": 324880, "audio": 0}, {"filename": "/data/script/duckie/init.lua", "start": 324880, "end": 325525, "audio": 0}, {"filename": "/data/script/duckie/models.lua", "start": 325525, "end": 327710, "audio": 0}, {"filename": "/data/sound/duckie/cs/odp-m-blaznis.ogg", "start": 327710, "end": 352404, "audio": 1}, {"filename": "/data/sound/duckie/cs/odp-m-kohout.ogg", "start": 352404, "end": 368212, "audio": 1}, {"filename": "/data/sound/duckie/cs/odp-m-predmet.ogg", "start": 368212, "end": 388519, "audio": 1}, {"filename": "/data/sound/duckie/cs/odp-m-zda0.ogg", "start": 388519, "end": 407724, "audio": 1}, {"filename": "/data/sound/duckie/cs/odp-m-zda1.ogg", "start": 407724, "end": 426341, "audio": 1}, {"filename": "/data/sound/duckie/cs/odp-v-coja.ogg", "start": 426341, "end": 437362, "audio": 1}, {"filename": "/data/sound/duckie/cs/odp-v-kachna.ogg", "start": 437362, "end": 461169, "audio": 1}, {"filename": "/data/sound/duckie/cs/odp-v-nestacim.ogg", "start": 461169, "end": 478229, "audio": 1}, {"filename": "/data/sound/duckie/cs/odp-v-pohni.ogg", "start": 478229, "end": 499075, "audio": 1}, {"filename": "/data/sound/duckie/cs/odp-v-pozadi.ogg", "start": 499075, "end": 517330, "audio": 1}, {"filename": "/data/sound/duckie/cs/odp-v-snehulak.ogg", "start": 517330, "end": 533015, "audio": 1}, {"filename": "/data/sound/duckie/cs/odp-v-vtip.ogg", "start": 533015, "end": 559012, "audio": 1}, {"filename": "/data/sound/duckie/nl/odp-m-blaznis.ogg", "start": 559012, "end": 582634, "audio": 1}, {"filename": "/data/sound/duckie/nl/odp-m-kohout.ogg", "start": 582634, "end": 601889, "audio": 1}, {"filename": "/data/sound/duckie/nl/odp-m-predmet.ogg", "start": 601889, "end": 625868, "audio": 1}, {"filename": "/data/sound/duckie/nl/odp-m-zda0.ogg", "start": 625868, "end": 642282, "audio": 1}, {"filename": "/data/sound/duckie/nl/odp-m-zda1.ogg", "start": 642282, "end": 660657, "audio": 1}, {"filename": "/data/sound/duckie/nl/odp-v-coja.ogg", "start": 660657, "end": 676514, "audio": 1}, {"filename": "/data/sound/duckie/nl/odp-v-kachna.ogg", "start": 676514, "end": 702009, "audio": 1}, {"filename": "/data/sound/duckie/nl/odp-v-nestacim.ogg", "start": 702009, "end": 722455, "audio": 1}, {"filename": "/data/sound/duckie/nl/odp-v-pohni.ogg", "start": 722455, "end": 741818, "audio": 1}, {"filename": "/data/sound/duckie/nl/odp-v-pozadi.ogg", "start": 741818, "end": 764914, "audio": 1}, {"filename": "/data/sound/duckie/nl/odp-v-snehulak.ogg", "start": 764914, "end": 782565, "audio": 1}, {"filename": "/data/sound/duckie/nl/odp-v-vtip.ogg", "start": 782565, "end": 807052, "audio": 1}], "remote_package_size": 807052, "package_uuid": "26f2a08c-d009-43e1-9db0-540cfb994ef7"});

})();
