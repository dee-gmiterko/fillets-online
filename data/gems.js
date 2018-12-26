
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
    var PACKAGE_NAME = 'web/data/gems.data';
    var REMOTE_PACKAGE_BASE = 'data/gems.data';
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
Module['FS_createPath']('/data/images', 'gems', true, true);
Module['FS_createPath']('/data', 'script', true, true);
Module['FS_createPath']('/data/script', 'gems', true, true);
Module['FS_createPath']('/data', 'sound', true, true);
Module['FS_createPath']('/data/sound', 'gems', true, true);
Module['FS_createPath']('/data/sound/gems', 'cs', true, true);
Module['FS_createPath']('/data/sound/gems', 'nl', true, true);

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
              Module['removeRunDependency']('datafile_web/data/gems.data');

    };
    Module['addRunDependency']('datafile_web/data/gems.data');
  
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
 loadPackage({"files": [{"filename": "/data/images/gems/krystal_00.png", "start": 0, "end": 612, "audio": 0}, {"filename": "/data/images/gems/krystal_01.png", "start": 612, "end": 1218, "audio": 0}, {"filename": "/data/images/gems/krystal_02.png", "start": 1218, "end": 1814, "audio": 0}, {"filename": "/data/images/gems/krystal_03.png", "start": 1814, "end": 2390, "audio": 0}, {"filename": "/data/images/gems/krystal_04.png", "start": 2390, "end": 3056, "audio": 0}, {"filename": "/data/images/gems/krystal_05.png", "start": 3056, "end": 3725, "audio": 0}, {"filename": "/data/images/gems/krystal_06.png", "start": 3725, "end": 4401, "audio": 0}, {"filename": "/data/images/gems/krystal_07.png", "start": 4401, "end": 5012, "audio": 0}, {"filename": "/data/images/gems/krystal_08.png", "start": 5012, "end": 5650, "audio": 0}, {"filename": "/data/images/gems/krystal_09.png", "start": 5650, "end": 6287, "audio": 0}, {"filename": "/data/images/gems/krystal_10.png", "start": 6287, "end": 6905, "audio": 0}, {"filename": "/data/images/gems/krystal_11.png", "start": 6905, "end": 7506, "audio": 0}, {"filename": "/data/images/gems/krystal_12.png", "start": 7506, "end": 8174, "audio": 0}, {"filename": "/data/images/gems/krystal_13.png", "start": 8174, "end": 8840, "audio": 0}, {"filename": "/data/images/gems/krystal_14.png", "start": 8840, "end": 9497, "audio": 0}, {"filename": "/data/images/gems/krystal_15.png", "start": 9497, "end": 10120, "audio": 0}, {"filename": "/data/images/gems/krystal_16.png", "start": 10120, "end": 10735, "audio": 0}, {"filename": "/data/images/gems/krystal_17.png", "start": 10735, "end": 11334, "audio": 0}, {"filename": "/data/images/gems/krystal_18.png", "start": 11334, "end": 11906, "audio": 0}, {"filename": "/data/images/gems/krystal_19.png", "start": 11906, "end": 12445, "audio": 0}, {"filename": "/data/images/gems/krystal_20.png", "start": 12445, "end": 13084, "audio": 0}, {"filename": "/data/images/gems/krystal_21.png", "start": 13084, "end": 13722, "audio": 0}, {"filename": "/data/images/gems/krystal_22.png", "start": 13722, "end": 14348, "audio": 0}, {"filename": "/data/images/gems/krystal_23.png", "start": 14348, "end": 14957, "audio": 0}, {"filename": "/data/images/gems/zaval-p.png", "start": 14957, "end": 79642, "audio": 0}, {"filename": "/data/images/gems/zaval-w.png", "start": 79642, "end": 180089, "audio": 0}, {"filename": "/data/script/gems/code.lua", "start": 180089, "end": 184226, "audio": 0}, {"filename": "/data/script/gems/dialogs_bg.lua", "start": 184226, "end": 186802, "audio": 0}, {"filename": "/data/script/gems/dialogs_cs.lua", "start": 186802, "end": 188941, "audio": 0}, {"filename": "/data/script/gems/dialogs_de.lua", "start": 188941, "end": 191168, "audio": 0}, {"filename": "/data/script/gems/dialogs_en.lua", "start": 191168, "end": 192426, "audio": 0}, {"filename": "/data/script/gems/dialogs_es.lua", "start": 192426, "end": 194605, "audio": 0}, {"filename": "/data/script/gems/dialogs_fr.lua", "start": 194605, "end": 196829, "audio": 0}, {"filename": "/data/script/gems/dialogs_it.lua", "start": 196829, "end": 198984, "audio": 0}, {"filename": "/data/script/gems/dialogs.lua", "start": 198984, "end": 199022, "audio": 0}, {"filename": "/data/script/gems/dialogs_nl.lua", "start": 199022, "end": 201059, "audio": 0}, {"filename": "/data/script/gems/dialogs_pl.lua", "start": 201059, "end": 203236, "audio": 0}, {"filename": "/data/script/gems/dialogs_ru.lua", "start": 203236, "end": 205792, "audio": 0}, {"filename": "/data/script/gems/dialogs_sv.lua", "start": 205792, "end": 207938, "audio": 0}, {"filename": "/data/script/gems/init.lua", "start": 207938, "end": 208581, "audio": 0}, {"filename": "/data/script/gems/models.lua", "start": 208581, "end": 222314, "audio": 0}, {"filename": "/data/sound/gems/cs/zav-m-hopskok.ogg", "start": 222314, "end": 240946, "audio": 1}, {"filename": "/data/sound/gems/cs/zav-m-hrac.ogg", "start": 240946, "end": 265427, "audio": 1}, {"filename": "/data/sound/gems/cs/zav-m-kameny.ogg", "start": 265427, "end": 290098, "audio": 1}, {"filename": "/data/sound/gems/cs/zav-m-krasa.ogg", "start": 290098, "end": 319457, "audio": 1}, {"filename": "/data/sound/gems/cs/zav-m-pohnout.ogg", "start": 319457, "end": 344386, "audio": 1}, {"filename": "/data/sound/gems/cs/zav-m-pravda.ogg", "start": 344386, "end": 384854, "audio": 1}, {"filename": "/data/sound/gems/cs/zav-v-restart.ogg", "start": 384854, "end": 418825, "audio": 1}, {"filename": "/data/sound/gems/cs/zav-v-sto.ogg", "start": 418825, "end": 445598, "audio": 1}, {"filename": "/data/sound/gems/cs/zav-v-trpyt.ogg", "start": 445598, "end": 463343, "audio": 1}, {"filename": "/data/sound/gems/cs/zav-v-venku.ogg", "start": 463343, "end": 485349, "audio": 1}, {"filename": "/data/sound/gems/cs/zav-v-zachranit.ogg", "start": 485349, "end": 506664, "audio": 1}, {"filename": "/data/sound/gems/cs/zav-v-zaval.ogg", "start": 506664, "end": 539568, "audio": 1}, {"filename": "/data/sound/gems/cs/zav-v-zeleny.ogg", "start": 539568, "end": 563220, "audio": 1}, {"filename": "/data/sound/gems/nl/zav-m-hopskok.ogg", "start": 563220, "end": 596290, "audio": 1}, {"filename": "/data/sound/gems/nl/zav-m-hrac.ogg", "start": 596290, "end": 624679, "audio": 1}, {"filename": "/data/sound/gems/nl/zav-m-kameny.ogg", "start": 624679, "end": 649056, "audio": 1}, {"filename": "/data/sound/gems/nl/zav-m-pohnout.ogg", "start": 649056, "end": 676584, "audio": 1}, {"filename": "/data/sound/gems/nl/zav-m-pravda.ogg", "start": 676584, "end": 701955, "audio": 1}, {"filename": "/data/sound/gems/nl/zav-v-restart.ogg", "start": 701955, "end": 721654, "audio": 1}, {"filename": "/data/sound/gems/nl/zav-v-sto.ogg", "start": 721654, "end": 725353, "audio": 1}, {"filename": "/data/sound/gems/nl/zav-v-trpyt.ogg", "start": 725353, "end": 747699, "audio": 1}, {"filename": "/data/sound/gems/nl/zav-v-venku.ogg", "start": 747699, "end": 773492, "audio": 1}, {"filename": "/data/sound/gems/nl/zav-v-zaval.ogg", "start": 773492, "end": 803423, "audio": 1}, {"filename": "/data/sound/gems/nl/zav-v-zeleny.ogg", "start": 803423, "end": 835441, "audio": 1}], "remote_package_size": 835441, "package_uuid": "4e7f27d2-ae3d-4d18-99cc-ee279c3c163f"});

})();
