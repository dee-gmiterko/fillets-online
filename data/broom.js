
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
    var PACKAGE_NAME = 'web/data/broom.data';
    var REMOTE_PACKAGE_BASE = 'data/broom.data';
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
Module['FS_createPath']('/data/images', 'broom', true, true);
Module['FS_createPath']('/data', 'script', true, true);
Module['FS_createPath']('/data/script', 'broom', true, true);
Module['FS_createPath']('/data', 'sound', true, true);
Module['FS_createPath']('/data/sound', 'broom', true, true);
Module['FS_createPath']('/data/sound/broom', 'cs', true, true);
Module['FS_createPath']('/data/sound/broom', 'nl', true, true);

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
              Module['removeRunDependency']('datafile_web/data/broom.data');

    };
    Module['addRunDependency']('datafile_web/data/broom.data');
  
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
 loadPackage({"files": [{"filename": "/data/images/broom/drevo_a.png", "start": 0, "end": 1427, "audio": 0}, {"filename": "/data/images/broom/drevo_b.png", "start": 1427, "end": 2841, "audio": 0}, {"filename": "/data/images/broom/koste_00.png", "start": 2841, "end": 7778, "audio": 0}, {"filename": "/data/images/broom/koste_01.png", "start": 7778, "end": 12617, "audio": 0}, {"filename": "/data/images/broom/koste_02.png", "start": 12617, "end": 17451, "audio": 0}, {"filename": "/data/images/broom/koste-10-tmp.png", "start": 17451, "end": 17949, "audio": 0}, {"filename": "/data/images/broom/koste-1-tmp.png", "start": 17949, "end": 20436, "audio": 0}, {"filename": "/data/images/broom/koste-8-tmp.png", "start": 20436, "end": 20934, "audio": 0}, {"filename": "/data/images/broom/koste-p.png", "start": 20934, "end": 375514, "audio": 0}, {"filename": "/data/images/broom/koste-w.png", "start": 375514, "end": 677445, "audio": 0}, {"filename": "/data/images/broom/uhlak.png", "start": 677445, "end": 680265, "audio": 0}, {"filename": "/data/images/broom/uhli_a.png", "start": 680265, "end": 680894, "audio": 0}, {"filename": "/data/images/broom/uhli_b.png", "start": 680894, "end": 681547, "audio": 0}, {"filename": "/data/images/broom/uhli_c.png", "start": 681547, "end": 682149, "audio": 0}, {"filename": "/data/images/broom/uhli_d.png", "start": 682149, "end": 682760, "audio": 0}, {"filename": "/data/script/broom/code.lua", "start": 682760, "end": 686626, "audio": 0}, {"filename": "/data/script/broom/dialogs_bg.lua", "start": 686626, "end": 688819, "audio": 0}, {"filename": "/data/script/broom/dialogs_cs.lua", "start": 688819, "end": 690624, "audio": 0}, {"filename": "/data/script/broom/dialogs_de_CH.lua", "start": 690624, "end": 691090, "audio": 0}, {"filename": "/data/script/broom/dialogs_de.lua", "start": 691090, "end": 692998, "audio": 0}, {"filename": "/data/script/broom/dialogs_en.lua", "start": 692998, "end": 694130, "audio": 0}, {"filename": "/data/script/broom/dialogs_es.lua", "start": 694130, "end": 696064, "audio": 0}, {"filename": "/data/script/broom/dialogs_fr.lua", "start": 696064, "end": 698050, "audio": 0}, {"filename": "/data/script/broom/dialogs_it.lua", "start": 698050, "end": 699881, "audio": 0}, {"filename": "/data/script/broom/dialogs.lua", "start": 699881, "end": 699919, "audio": 0}, {"filename": "/data/script/broom/dialogs_nl.lua", "start": 699919, "end": 701881, "audio": 0}, {"filename": "/data/script/broom/dialogs_pl.lua", "start": 701881, "end": 703716, "audio": 0}, {"filename": "/data/script/broom/dialogs_ru.lua", "start": 703716, "end": 705981, "audio": 0}, {"filename": "/data/script/broom/dialogs_sl.lua", "start": 705981, "end": 707800, "audio": 0}, {"filename": "/data/script/broom/dialogs_sv.lua", "start": 707800, "end": 709655, "audio": 0}, {"filename": "/data/script/broom/init.lua", "start": 709655, "end": 710299, "audio": 0}, {"filename": "/data/script/broom/models.lua", "start": 710299, "end": 713394, "audio": 0}, {"filename": "/data/sound/broom/cs/kos-m-uklid0.ogg", "start": 713394, "end": 728445, "audio": 1}, {"filename": "/data/sound/broom/cs/kos-m-uklid1.ogg", "start": 728445, "end": 745501, "audio": 1}, {"filename": "/data/sound/broom/cs/kos-m-uklid2.ogg", "start": 745501, "end": 767376, "audio": 1}, {"filename": "/data/sound/broom/cs/kos-m-zamet0.ogg", "start": 767376, "end": 789683, "audio": 1}, {"filename": "/data/sound/broom/cs/kos-m-zamet1.ogg", "start": 789683, "end": 804075, "audio": 1}, {"filename": "/data/sound/broom/cs/kos-m-zamet2.ogg", "start": 804075, "end": 821690, "audio": 1}, {"filename": "/data/sound/broom/cs/kos-m-zamet3.ogg", "start": 821690, "end": 841028, "audio": 1}, {"filename": "/data/sound/broom/cs/kos-v-koste0.ogg", "start": 841028, "end": 858096, "audio": 1}, {"filename": "/data/sound/broom/cs/kos-v-koste1.ogg", "start": 858096, "end": 875335, "audio": 1}, {"filename": "/data/sound/broom/cs/kos-v-koste2.ogg", "start": 875335, "end": 905447, "audio": 1}, {"filename": "/data/sound/broom/cs/kos-v-poradek0.ogg", "start": 905447, "end": 922233, "audio": 1}, {"filename": "/data/sound/broom/cs/kos-v-poradek1.ogg", "start": 922233, "end": 937441, "audio": 1}, {"filename": "/data/sound/broom/cs/kos-v-poradek2.ogg", "start": 937441, "end": 954495, "audio": 1}, {"filename": "/data/sound/broom/nl/kos-m-uklid0.ogg", "start": 954495, "end": 978782, "audio": 1}, {"filename": "/data/sound/broom/nl/kos-m-uklid1.ogg", "start": 978782, "end": 999801, "audio": 1}, {"filename": "/data/sound/broom/nl/kos-m-uklid2.ogg", "start": 999801, "end": 1024225, "audio": 1}, {"filename": "/data/sound/broom/nl/kos-m-zamet0.ogg", "start": 1024225, "end": 1046607, "audio": 1}, {"filename": "/data/sound/broom/nl/kos-m-zamet1.ogg", "start": 1046607, "end": 1063215, "audio": 1}, {"filename": "/data/sound/broom/nl/kos-m-zamet2.ogg", "start": 1063215, "end": 1083590, "audio": 1}, {"filename": "/data/sound/broom/nl/kos-m-zamet3.ogg", "start": 1083590, "end": 1108983, "audio": 1}, {"filename": "/data/sound/broom/nl/kos-v-koste0.ogg", "start": 1108983, "end": 1126920, "audio": 1}, {"filename": "/data/sound/broom/nl/kos-v-koste1.ogg", "start": 1126920, "end": 1147708, "audio": 1}, {"filename": "/data/sound/broom/nl/kos-v-koste2.ogg", "start": 1147708, "end": 1183352, "audio": 1}, {"filename": "/data/sound/broom/nl/kos-v-poradek0.ogg", "start": 1183352, "end": 1205746, "audio": 1}, {"filename": "/data/sound/broom/nl/kos-v-poradek1.ogg", "start": 1205746, "end": 1231498, "audio": 1}, {"filename": "/data/sound/broom/nl/kos-v-poradek2.ogg", "start": 1231498, "end": 1251665, "audio": 1}], "remote_package_size": 1251665, "package_uuid": "4c58f34b-7d61-47ac-a9c9-2b857f5e64ae"});

})();
