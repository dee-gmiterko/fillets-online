
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
    var PACKAGE_NAME = 'web/data/steel.data';
    var REMOTE_PACKAGE_BASE = 'data/steel.data';
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
Module['FS_createPath']('/data/images', 'steel', true, true);
Module['FS_createPath']('/data', 'script', true, true);
Module['FS_createPath']('/data/script', 'steel', true, true);
Module['FS_createPath']('/data', 'sound', true, true);
Module['FS_createPath']('/data/sound', 'steel', true, true);
Module['FS_createPath']('/data/sound/steel', 'cs', true, true);
Module['FS_createPath']('/data/sound/steel', 'en', true, true);
Module['FS_createPath']('/data/sound/steel', 'nl', true, true);

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
              Module['removeRunDependency']('datafile_web/data/steel.data');

    };
    Module['addRunDependency']('datafile_web/data/steel.data');
  
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
 loadPackage({"files": [{"filename": "/data/images/steel/steel-pozadi0.png", "start": 0, "end": 232828, "audio": 0}, {"filename": "/data/images/steel/steel-pozadi1.png", "start": 232828, "end": 475155, "audio": 0}, {"filename": "/data/images/steel/steel-pozadi2.png", "start": 475155, "end": 520119, "audio": 0}, {"filename": "/data/images/steel/steel-prostredi_00.png", "start": 520119, "end": 599125, "audio": 0}, {"filename": "/data/images/steel/steel-prostredi_01.png", "start": 599125, "end": 682471, "audio": 0}, {"filename": "/data/images/steel/steel-prostredi_02.png", "start": 682471, "end": 720212, "audio": 0}, {"filename": "/data/images/steel/t1p_00.png", "start": 720212, "end": 720707, "audio": 0}, {"filename": "/data/images/steel/t1p_01.png", "start": 720707, "end": 721207, "audio": 0}, {"filename": "/data/images/steel/t1p_02.png", "start": 721207, "end": 721608, "audio": 0}, {"filename": "/data/images/steel/t2p_00.png", "start": 721608, "end": 722325, "audio": 0}, {"filename": "/data/images/steel/t2p_01.png", "start": 722325, "end": 723049, "audio": 0}, {"filename": "/data/images/steel/t2p_02.png", "start": 723049, "end": 723624, "audio": 0}, {"filename": "/data/images/steel/t3p_00.png", "start": 723624, "end": 724491, "audio": 0}, {"filename": "/data/images/steel/t3p_01.png", "start": 724491, "end": 725369, "audio": 0}, {"filename": "/data/images/steel/t3p_02.png", "start": 725369, "end": 726142, "audio": 0}, {"filename": "/data/images/steel/t4p_00.png", "start": 726142, "end": 726963, "audio": 0}, {"filename": "/data/images/steel/t4p_01.png", "start": 726963, "end": 727791, "audio": 0}, {"filename": "/data/images/steel/t4p_02.png", "start": 727791, "end": 728426, "audio": 0}, {"filename": "/data/images/steel/t5p_00.png", "start": 728426, "end": 731033, "audio": 0}, {"filename": "/data/images/steel/t5p_01.png", "start": 731033, "end": 733612, "audio": 0}, {"filename": "/data/images/steel/t5p_02.png", "start": 733612, "end": 735643, "audio": 0}, {"filename": "/data/images/steel/t6p_00.png", "start": 735643, "end": 740786, "audio": 0}, {"filename": "/data/images/steel/t6p_01.png", "start": 740786, "end": 745894, "audio": 0}, {"filename": "/data/images/steel/t6p_02.png", "start": 745894, "end": 749728, "audio": 0}, {"filename": "/data/images/steel/t7p_00.png", "start": 749728, "end": 751927, "audio": 0}, {"filename": "/data/images/steel/t7p_01.png", "start": 751927, "end": 754099, "audio": 0}, {"filename": "/data/images/steel/t7p_02.png", "start": 754099, "end": 755740, "audio": 0}, {"filename": "/data/images/steel/t8p_00.png", "start": 755740, "end": 756253, "audio": 0}, {"filename": "/data/images/steel/t8p_01.png", "start": 756253, "end": 756765, "audio": 0}, {"filename": "/data/images/steel/t8p_02.png", "start": 756765, "end": 757187, "audio": 0}, {"filename": "/data/script/steel/code.lua", "start": 757187, "end": 759620, "audio": 0}, {"filename": "/data/script/steel/dialogs_bg.lua", "start": 759620, "end": 759884, "audio": 0}, {"filename": "/data/script/steel/dialogs_cs.lua", "start": 759884, "end": 760081, "audio": 0}, {"filename": "/data/script/steel/dialogs_de.lua", "start": 760081, "end": 760279, "audio": 0}, {"filename": "/data/script/steel/dialogs_en.lua", "start": 760279, "end": 760440, "audio": 0}, {"filename": "/data/script/steel/dialogs_es.lua", "start": 760440, "end": 760647, "audio": 0}, {"filename": "/data/script/steel/dialogs_fr.lua", "start": 760647, "end": 760849, "audio": 0}, {"filename": "/data/script/steel/dialogs_it.lua", "start": 760849, "end": 761049, "audio": 0}, {"filename": "/data/script/steel/dialogs.lua", "start": 761049, "end": 761087, "audio": 0}, {"filename": "/data/script/steel/dialogs_nl.lua", "start": 761087, "end": 761288, "audio": 0}, {"filename": "/data/script/steel/dialogs_pl.lua", "start": 761288, "end": 761477, "audio": 0}, {"filename": "/data/script/steel/dialogs_ru.lua", "start": 761477, "end": 761751, "audio": 0}, {"filename": "/data/script/steel/dialogs_sv.lua", "start": 761751, "end": 761953, "audio": 0}, {"filename": "/data/script/steel/init.lua", "start": 761953, "end": 762597, "audio": 0}, {"filename": "/data/script/steel/models.lua", "start": 762597, "end": 767579, "audio": 0}, {"filename": "/data/sound/steel/cs/steel-m-0.ogg", "start": 767579, "end": 781308, "audio": 1}, {"filename": "/data/sound/steel/cs/steel-m-1.ogg", "start": 781308, "end": 795970, "audio": 1}, {"filename": "/data/sound/steel/en/steel-x-redalert.ogg", "start": 795970, "end": 805035, "audio": 1}, {"filename": "/data/sound/steel/nl/steel-m-0.ogg", "start": 805035, "end": 822974, "audio": 1}, {"filename": "/data/sound/steel/nl/steel-m-1.ogg", "start": 822974, "end": 841323, "audio": 1}], "remote_package_size": 841323, "package_uuid": "d932930a-370f-42d9-ad10-d107e4153bb1"});

})();
