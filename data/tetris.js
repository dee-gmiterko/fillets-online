
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
    var PACKAGE_NAME = 'web/data/tetris.data';
    var REMOTE_PACKAGE_BASE = 'data/tetris.data';
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
Module['FS_createPath']('/data/images', 'tetris', true, true);
Module['FS_createPath']('/data', 'script', true, true);
Module['FS_createPath']('/data/script', 'tetris', true, true);
Module['FS_createPath']('/data', 'sound', true, true);
Module['FS_createPath']('/data/sound', 'tetris', true, true);
Module['FS_createPath']('/data/sound/tetris', 'cs', true, true);
Module['FS_createPath']('/data/sound/tetris', 'nl', true, true);

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
              Module['removeRunDependency']('datafile_web/data/tetris.data');

    };
    Module['addRunDependency']('datafile_web/data/tetris.data');
  
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
 loadPackage({"files": [{"filename": "/data/images/tetris/12-ocel.png", "start": 0, "end": 2236, "audio": 0}, {"filename": "/data/images/tetris/13-ocel.png", "start": 2236, "end": 3219, "audio": 0}, {"filename": "/data/images/tetris/ctverec.png", "start": 3219, "end": 3350, "audio": 0}, {"filename": "/data/images/tetris/dlouha.png", "start": 3350, "end": 3472, "audio": 0}, {"filename": "/data/images/tetris/elko1l.png", "start": 3472, "end": 3623, "audio": 0}, {"filename": "/data/images/tetris/elko1o.png", "start": 3623, "end": 3774, "audio": 0}, {"filename": "/data/images/tetris/elko2o.png", "start": 3774, "end": 3921, "audio": 0}, {"filename": "/data/images/tetris/lodo.png", "start": 3921, "end": 4076, "audio": 0}, {"filename": "/data/images/tetris/lods.png", "start": 4076, "end": 4228, "audio": 0}, {"filename": "/data/images/tetris/tetris-p.png", "start": 4228, "end": 4664, "audio": 0}, {"filename": "/data/images/tetris/tetris-w2.png", "start": 4664, "end": 14274, "audio": 0}, {"filename": "/data/images/tetris/vozik.png", "start": 14274, "end": 20790, "audio": 0}, {"filename": "/data/images/tetris/zidle1l.png", "start": 20790, "end": 20942, "audio": 0}, {"filename": "/data/images/tetris/zidle1s.png", "start": 20942, "end": 21103, "audio": 0}, {"filename": "/data/images/tetris/zidle2l.png", "start": 21103, "end": 21257, "audio": 0}, {"filename": "/data/script/tetris/code.lua", "start": 21257, "end": 24394, "audio": 0}, {"filename": "/data/script/tetris/dialogs_bg.lua", "start": 24394, "end": 27142, "audio": 0}, {"filename": "/data/script/tetris/dialogs_cs.lua", "start": 27142, "end": 29318, "audio": 0}, {"filename": "/data/script/tetris/dialogs_de_CH.lua", "start": 29318, "end": 29431, "audio": 0}, {"filename": "/data/script/tetris/dialogs_de.lua", "start": 29431, "end": 31638, "audio": 0}, {"filename": "/data/script/tetris/dialogs_en.lua", "start": 31638, "end": 32923, "audio": 0}, {"filename": "/data/script/tetris/dialogs_es.lua", "start": 32923, "end": 35145, "audio": 0}, {"filename": "/data/script/tetris/dialogs_fr.lua", "start": 35145, "end": 37361, "audio": 0}, {"filename": "/data/script/tetris/dialogs_it.lua", "start": 37361, "end": 39551, "audio": 0}, {"filename": "/data/script/tetris/dialogs.lua", "start": 39551, "end": 39589, "audio": 0}, {"filename": "/data/script/tetris/dialogs_nl.lua", "start": 39589, "end": 41783, "audio": 0}, {"filename": "/data/script/tetris/dialogs_pl.lua", "start": 41783, "end": 43991, "audio": 0}, {"filename": "/data/script/tetris/dialogs_ru.lua", "start": 43991, "end": 47152, "audio": 0}, {"filename": "/data/script/tetris/dialogs_sv.lua", "start": 47152, "end": 49353, "audio": 0}, {"filename": "/data/script/tetris/init.lua", "start": 49353, "end": 49998, "audio": 0}, {"filename": "/data/script/tetris/models.lua", "start": 49998, "end": 53732, "audio": 0}, {"filename": "/data/sound/tetris/cs/tet-m-ano.ogg", "start": 53732, "end": 63542, "audio": 1}, {"filename": "/data/sound/tetris/cs/tet-m-jaklepsi.ogg", "start": 63542, "end": 75238, "audio": 1}, {"filename": "/data/sound/tetris/cs/tet-m-lepe.ogg", "start": 75238, "end": 98134, "audio": 1}, {"filename": "/data/sound/tetris/cs/tet-m-pozor.ogg", "start": 98134, "end": 119921, "audio": 1}, {"filename": "/data/sound/tetris/cs/tet-m-predmety.ogg", "start": 119921, "end": 144153, "audio": 1}, {"filename": "/data/sound/tetris/cs/tet-m-program.ogg", "start": 144153, "end": 159571, "audio": 1}, {"filename": "/data/sound/tetris/cs/tet-m-usudek.ogg", "start": 159571, "end": 178992, "audio": 1}, {"filename": "/data/sound/tetris/cs/tet-m-vypadala.ogg", "start": 178992, "end": 201668, "audio": 1}, {"filename": "/data/sound/tetris/cs/tet-v-hybat.ogg", "start": 201668, "end": 232018, "audio": 1}, {"filename": "/data/sound/tetris/cs/tet-v-kostky.ogg", "start": 232018, "end": 257441, "audio": 1}, {"filename": "/data/sound/tetris/cs/tet-v-lepsi.ogg", "start": 257441, "end": 280946, "audio": 1}, {"filename": "/data/sound/tetris/cs/tet-v-myslim.ogg", "start": 280946, "end": 294776, "audio": 1}, {"filename": "/data/sound/tetris/cs/tet-v-ucta.ogg", "start": 294776, "end": 322769, "audio": 1}, {"filename": "/data/sound/tetris/cs/tet-v-uprava.ogg", "start": 322769, "end": 363429, "audio": 1}, {"filename": "/data/sound/tetris/nl/tet-m-ano.ogg", "start": 363429, "end": 376258, "audio": 1}, {"filename": "/data/sound/tetris/nl/tet-m-jaklepsi.ogg", "start": 376258, "end": 391727, "audio": 1}, {"filename": "/data/sound/tetris/nl/tet-m-lepe.ogg", "start": 391727, "end": 412767, "audio": 1}, {"filename": "/data/sound/tetris/nl/tet-m-pozor.ogg", "start": 412767, "end": 434324, "audio": 1}, {"filename": "/data/sound/tetris/nl/tet-m-predmety.ogg", "start": 434324, "end": 457025, "audio": 1}, {"filename": "/data/sound/tetris/nl/tet-m-program.ogg", "start": 457025, "end": 474328, "audio": 1}, {"filename": "/data/sound/tetris/nl/tet-m-usudek.ogg", "start": 474328, "end": 494339, "audio": 1}, {"filename": "/data/sound/tetris/nl/tet-m-vypadala.ogg", "start": 494339, "end": 522134, "audio": 1}, {"filename": "/data/sound/tetris/nl/tet-v-hybat.ogg", "start": 522134, "end": 548288, "audio": 1}, {"filename": "/data/sound/tetris/nl/tet-v-kostky.ogg", "start": 548288, "end": 573382, "audio": 1}, {"filename": "/data/sound/tetris/nl/tet-v-lepsi.ogg", "start": 573382, "end": 602841, "audio": 1}, {"filename": "/data/sound/tetris/nl/tet-v-myslim.ogg", "start": 602841, "end": 619660, "audio": 1}, {"filename": "/data/sound/tetris/nl/tet-v-ucta.ogg", "start": 619660, "end": 656655, "audio": 1}, {"filename": "/data/sound/tetris/nl/tet-v-uprava.ogg", "start": 656655, "end": 697631, "audio": 1}], "remote_package_size": 697631, "package_uuid": "bccb5c5d-d29c-499a-8eca-008ebd0bfe52"});

})();
