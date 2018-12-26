
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
    var PACKAGE_NAME = 'web/data/imprisoned.data';
    var REMOTE_PACKAGE_BASE = 'data/imprisoned.data';
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
Module['FS_createPath']('/data/images', 'imprisoned', true, true);
Module['FS_createPath']('/data', 'script', true, true);
Module['FS_createPath']('/data/script', 'imprisoned', true, true);
Module['FS_createPath']('/data', 'sound', true, true);
Module['FS_createPath']('/data/sound', 'imprisoned', true, true);
Module['FS_createPath']('/data/sound/imprisoned', 'cs', true, true);
Module['FS_createPath']('/data/sound/imprisoned', 'en', true, true);
Module['FS_createPath']('/data/sound/imprisoned', 'nl', true, true);

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
              Module['removeRunDependency']('datafile_web/data/imprisoned.data');

    };
    Module['addRunDependency']('datafile_web/data/imprisoned.data');
  
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
 loadPackage({"files": [{"filename": "/data/images/imprisoned/coral_cerv.png", "start": 0, "end": 9492, "audio": 0}, {"filename": "/data/images/imprisoned/konik_00.png", "start": 9492, "end": 10473, "audio": 0}, {"filename": "/data/images/imprisoned/konik_01.png", "start": 10473, "end": 11426, "audio": 0}, {"filename": "/data/images/imprisoned/konik_02.png", "start": 11426, "end": 12397, "audio": 0}, {"filename": "/data/images/imprisoned/konik_03.png", "start": 12397, "end": 13399, "audio": 0}, {"filename": "/data/images/imprisoned/korala.png", "start": 13399, "end": 18480, "audio": 0}, {"filename": "/data/images/imprisoned/koral_bily.png", "start": 18480, "end": 23124, "audio": 0}, {"filename": "/data/images/imprisoned/koralb.png", "start": 23124, "end": 30830, "audio": 0}, {"filename": "/data/images/imprisoned/koralc.png", "start": 30830, "end": 34935, "audio": 0}, {"filename": "/data/images/imprisoned/koral_dlouhy.png", "start": 34935, "end": 40216, "audio": 0}, {"filename": "/data/images/imprisoned/korald.png", "start": 40216, "end": 41734, "audio": 0}, {"filename": "/data/images/imprisoned/koral_zel.png", "start": 41734, "end": 51257, "audio": 0}, {"filename": "/data/images/imprisoned/maly_snek_00.png", "start": 51257, "end": 51931, "audio": 0}, {"filename": "/data/images/imprisoned/maly_snek_01.png", "start": 51931, "end": 52628, "audio": 0}, {"filename": "/data/images/imprisoned/maly_snek_02.png", "start": 52628, "end": 53345, "audio": 0}, {"filename": "/data/images/imprisoned/maly_snek_03.png", "start": 53345, "end": 54005, "audio": 0}, {"filename": "/data/images/imprisoned/musle_troj.png", "start": 54005, "end": 55545, "audio": 0}, {"filename": "/data/images/imprisoned/ncp-p.png", "start": 55545, "end": 409024, "audio": 0}, {"filename": "/data/images/imprisoned/ncp-w.png", "start": 409024, "end": 840290, "audio": 0}, {"filename": "/data/images/imprisoned/newcolorproblem-11-tmp.png", "start": 840290, "end": 842192, "audio": 0}, {"filename": "/data/images/imprisoned/newcolorproblem-12-tmp.png", "start": 842192, "end": 843778, "audio": 0}, {"filename": "/data/images/imprisoned/newcolorproblem-13-tmp.png", "start": 843778, "end": 844719, "audio": 0}, {"filename": "/data/images/imprisoned/newcolorproblem-16-tmp.png", "start": 844719, "end": 845415, "audio": 0}, {"filename": "/data/images/imprisoned/newcolorproblem-7-tmp.png", "start": 845415, "end": 846282, "audio": 0}, {"filename": "/data/images/imprisoned/sasanka_00.png", "start": 846282, "end": 846906, "audio": 0}, {"filename": "/data/images/imprisoned/sasanka_01.png", "start": 846906, "end": 847628, "audio": 0}, {"filename": "/data/images/imprisoned/sasanka_02.png", "start": 847628, "end": 848315, "audio": 0}, {"filename": "/data/images/imprisoned/sasanka_03.png", "start": 848315, "end": 848985, "audio": 0}, {"filename": "/data/images/imprisoned/sasanka_04.png", "start": 848985, "end": 849609, "audio": 0}, {"filename": "/data/images/imprisoned/sasanka_05.png", "start": 849609, "end": 850304, "audio": 0}, {"filename": "/data/images/imprisoned/sasanka_06.png", "start": 850304, "end": 851001, "audio": 0}, {"filename": "/data/images/imprisoned/sasanka_07.png", "start": 851001, "end": 851706, "audio": 0}, {"filename": "/data/images/imprisoned/shell1.png", "start": 851706, "end": 852437, "audio": 0}, {"filename": "/data/images/imprisoned/shell_velka.png", "start": 852437, "end": 854606, "audio": 0}, {"filename": "/data/script/imprisoned/code.lua", "start": 854606, "end": 870454, "audio": 0}, {"filename": "/data/script/imprisoned/dialogs_bg.lua", "start": 870454, "end": 872452, "audio": 0}, {"filename": "/data/script/imprisoned/dialogs_cs.lua", "start": 872452, "end": 873988, "audio": 0}, {"filename": "/data/script/imprisoned/dialogs_de.lua", "start": 873988, "end": 875617, "audio": 0}, {"filename": "/data/script/imprisoned/dialogs_en.lua", "start": 875617, "end": 876714, "audio": 0}, {"filename": "/data/script/imprisoned/dialogs_es.lua", "start": 876714, "end": 878316, "audio": 0}, {"filename": "/data/script/imprisoned/dialogs_fr.lua", "start": 878316, "end": 879975, "audio": 0}, {"filename": "/data/script/imprisoned/dialogs_it.lua", "start": 879975, "end": 881583, "audio": 0}, {"filename": "/data/script/imprisoned/dialogs.lua", "start": 881583, "end": 881621, "audio": 0}, {"filename": "/data/script/imprisoned/dialogs_nl.lua", "start": 881621, "end": 883254, "audio": 0}, {"filename": "/data/script/imprisoned/dialogs_pl.lua", "start": 883254, "end": 884813, "audio": 0}, {"filename": "/data/script/imprisoned/dialogs_ru.lua", "start": 884813, "end": 886753, "audio": 0}, {"filename": "/data/script/imprisoned/dialogs_sv.lua", "start": 886753, "end": 888388, "audio": 0}, {"filename": "/data/script/imprisoned/init.lua", "start": 888388, "end": 889037, "audio": 0}, {"filename": "/data/script/imprisoned/models.lua", "start": 889037, "end": 894264, "audio": 0}, {"filename": "/data/sound/imprisoned/cs/ncp-m-barvy.ogg", "start": 894264, "end": 906530, "audio": 1}, {"filename": "/data/sound/imprisoned/cs/ncp-m-komari.ogg", "start": 906530, "end": 922818, "audio": 1}, {"filename": "/data/sound/imprisoned/cs/ncp-m-koraly.ogg", "start": 922818, "end": 941813, "audio": 1}, {"filename": "/data/sound/imprisoned/cs/ncp-m-muzes.ogg", "start": 941813, "end": 957533, "audio": 1}, {"filename": "/data/sound/imprisoned/cs/ncp-m-nekoukej.ogg", "start": 957533, "end": 969976, "audio": 1}, {"filename": "/data/sound/imprisoned/cs/ncp-m-tesno0.ogg", "start": 969976, "end": 989479, "audio": 1}, {"filename": "/data/sound/imprisoned/cs/ncp-m-tesno1.ogg", "start": 989479, "end": 1003493, "audio": 1}, {"filename": "/data/sound/imprisoned/cs/ncp-m-tvrdy.ogg", "start": 1003493, "end": 1018331, "audio": 1}, {"filename": "/data/sound/imprisoned/cs/ncp-v-ceho.ogg", "start": 1018331, "end": 1029261, "audio": 1}, {"filename": "/data/sound/imprisoned/cs/ncp-v-dostala.ogg", "start": 1029261, "end": 1044345, "audio": 1}, {"filename": "/data/sound/imprisoned/cs/ncp-v-mekky.ogg", "start": 1044345, "end": 1060306, "audio": 1}, {"filename": "/data/sound/imprisoned/cs/ncp-v-neprojedu.ogg", "start": 1060306, "end": 1078335, "audio": 1}, {"filename": "/data/sound/imprisoned/cs/ncp-v-sasanka.ogg", "start": 1078335, "end": 1105993, "audio": 1}, {"filename": "/data/sound/imprisoned/cs/ncp-v-tak.ogg", "start": 1105993, "end": 1114905, "audio": 1}, {"filename": "/data/sound/imprisoned/en/ncp-x-ihaha.ogg", "start": 1114905, "end": 1126478, "audio": 1}, {"filename": "/data/sound/imprisoned/en/ncp-x-tik.ogg", "start": 1126478, "end": 1130136, "audio": 1}, {"filename": "/data/sound/imprisoned/en/ncp-x-tup.ogg", "start": 1130136, "end": 1134460, "audio": 1}, {"filename": "/data/sound/imprisoned/nl/ncp-m-barvy.ogg", "start": 1134460, "end": 1151835, "audio": 1}, {"filename": "/data/sound/imprisoned/nl/ncp-m-komari.ogg", "start": 1151835, "end": 1171851, "audio": 1}, {"filename": "/data/sound/imprisoned/nl/ncp-m-koraly.ogg", "start": 1171851, "end": 1197993, "audio": 1}, {"filename": "/data/sound/imprisoned/nl/ncp-m-muzes.ogg", "start": 1197993, "end": 1215093, "audio": 1}, {"filename": "/data/sound/imprisoned/nl/ncp-m-nekoukej.ogg", "start": 1215093, "end": 1234701, "audio": 1}, {"filename": "/data/sound/imprisoned/nl/ncp-m-tesno0.ogg", "start": 1234701, "end": 1257288, "audio": 1}, {"filename": "/data/sound/imprisoned/nl/ncp-m-tesno1.ogg", "start": 1257288, "end": 1273573, "audio": 1}, {"filename": "/data/sound/imprisoned/nl/ncp-m-tvrdy.ogg", "start": 1273573, "end": 1293360, "audio": 1}, {"filename": "/data/sound/imprisoned/nl/ncp-v-ceho.ogg", "start": 1293360, "end": 1309592, "audio": 1}, {"filename": "/data/sound/imprisoned/nl/ncp-v-dostala.ogg", "start": 1309592, "end": 1330281, "audio": 1}, {"filename": "/data/sound/imprisoned/nl/ncp-v-mekky.ogg", "start": 1330281, "end": 1355548, "audio": 1}, {"filename": "/data/sound/imprisoned/nl/ncp-v-neprojedu.ogg", "start": 1355548, "end": 1374906, "audio": 1}, {"filename": "/data/sound/imprisoned/nl/ncp-v-sasanka.ogg", "start": 1374906, "end": 1404949, "audio": 1}, {"filename": "/data/sound/imprisoned/nl/ncp-v-tak.ogg", "start": 1404949, "end": 1419530, "audio": 1}], "remote_package_size": 1419530, "package_uuid": "359862ee-9fb3-4f6a-8750-71a57580cf0d"});

})();
