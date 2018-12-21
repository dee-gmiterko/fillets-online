
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
    var PACKAGE_NAME = 'web/data/grail.data';
    var REMOTE_PACKAGE_BASE = 'data/grail.data';
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
Module['FS_createPath']('/data/images', 'grail', true, true);
Module['FS_createPath']('/data', 'script', true, true);
Module['FS_createPath']('/data/script', 'grail', true, true);
Module['FS_createPath']('/data', 'sound', true, true);
Module['FS_createPath']('/data/sound', 'grail', true, true);
Module['FS_createPath']('/data/sound/grail', 'cs', true, true);
Module['FS_createPath']('/data/sound/grail', 'nl', true, true);

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
              Module['removeRunDependency']('datafile_web/data/grail.data');

    };
    Module['addRunDependency']('datafile_web/data/grail.data');
  
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
 loadPackage({"files": [{"filename": "/data/images/grail/12-ocel.png", "start": 0, "end": 1567, "audio": 0}, {"filename": "/data/images/grail/16-ocel.png", "start": 1567, "end": 2065, "audio": 0}, {"filename": "/data/images/grail/22-ocel.png", "start": 2065, "end": 2865, "audio": 0}, {"filename": "/data/images/grail/27-ocel.png", "start": 2865, "end": 3732, "audio": 0}, {"filename": "/data/images/grail/29-ocel.png", "start": 3732, "end": 5855, "audio": 0}, {"filename": "/data/images/grail/30-ocel.png", "start": 5855, "end": 6551, "audio": 0}, {"filename": "/data/images/grail/33-ocel.png", "start": 6551, "end": 8101, "audio": 0}, {"filename": "/data/images/grail/35-ocel.png", "start": 8101, "end": 10172, "audio": 0}, {"filename": "/data/images/grail/40-ocel.png", "start": 10172, "end": 11761, "audio": 0}, {"filename": "/data/images/grail/43-ocel.png", "start": 11761, "end": 14272, "audio": 0}, {"filename": "/data/images/grail/8-ocel.png", "start": 14272, "end": 17453, "audio": 0}, {"filename": "/data/images/grail/aura_00.png", "start": 17453, "end": 17987, "audio": 0}, {"filename": "/data/images/grail/aura_01.png", "start": 17987, "end": 18683, "audio": 0}, {"filename": "/data/images/grail/aura_02.png", "start": 18683, "end": 19535, "audio": 0}, {"filename": "/data/images/grail/aura_03.png", "start": 19535, "end": 20321, "audio": 0}, {"filename": "/data/images/grail/aura_04.png", "start": 20321, "end": 21161, "audio": 0}, {"filename": "/data/images/grail/aura_05.png", "start": 21161, "end": 21863, "audio": 0}, {"filename": "/data/images/grail/aura_06.png", "start": 21863, "end": 22412, "audio": 0}, {"filename": "/data/images/grail/aura_07.png", "start": 22412, "end": 23134, "audio": 0}, {"filename": "/data/images/grail/aura_08.png", "start": 23134, "end": 23982, "audio": 0}, {"filename": "/data/images/grail/aura_09.png", "start": 23982, "end": 24774, "audio": 0}, {"filename": "/data/images/grail/aura_10.png", "start": 24774, "end": 25615, "audio": 0}, {"filename": "/data/images/grail/aura_11.png", "start": 25615, "end": 26326, "audio": 0}, {"filename": "/data/images/grail/gral_00.png", "start": 26326, "end": 28012, "audio": 0}, {"filename": "/data/images/grail/gral_01.png", "start": 28012, "end": 29359, "audio": 0}, {"filename": "/data/images/grail/gral-pozadi.png", "start": 29359, "end": 601402, "audio": 0}, {"filename": "/data/images/grail/gral-zed.png", "start": 601402, "end": 919347, "audio": 0}, {"filename": "/data/images/grail/poster.png", "start": 919347, "end": 1066028, "audio": 0}, {"filename": "/data/script/grail/code.lua", "start": 1066028, "end": 1071797, "audio": 0}, {"filename": "/data/script/grail/demo_dialogs_bg.lua", "start": 1071797, "end": 1073162, "audio": 0}, {"filename": "/data/script/grail/demo_dialogs_cs.lua", "start": 1073162, "end": 1073777, "audio": 0}, {"filename": "/data/script/grail/demo_dialogs_de_CH.lua", "start": 1073777, "end": 1074437, "audio": 0}, {"filename": "/data/script/grail/demo_dialogs_de.lua", "start": 1074437, "end": 1075539, "audio": 0}, {"filename": "/data/script/grail/demo_dialogs_en.lua", "start": 1075539, "end": 1076109, "audio": 0}, {"filename": "/data/script/grail/demo_dialogs_es.lua", "start": 1076109, "end": 1077209, "audio": 0}, {"filename": "/data/script/grail/demo_dialogs_fr.lua", "start": 1077209, "end": 1078336, "audio": 0}, {"filename": "/data/script/grail/demo_dialogs_it.lua", "start": 1078336, "end": 1079441, "audio": 0}, {"filename": "/data/script/grail/demo_dialogs_nl.lua", "start": 1079441, "end": 1080563, "audio": 0}, {"filename": "/data/script/grail/demo_dialogs_pl.lua", "start": 1080563, "end": 1081644, "audio": 0}, {"filename": "/data/script/grail/demo_dialogs_ru.lua", "start": 1081644, "end": 1082988, "audio": 0}, {"filename": "/data/script/grail/demo_dialogs_sv.lua", "start": 1082988, "end": 1084052, "audio": 0}, {"filename": "/data/script/grail/demo_poster.lua", "start": 1084052, "end": 1084419, "audio": 0}, {"filename": "/data/script/grail/dialogs_bg.lua", "start": 1084419, "end": 1087742, "audio": 0}, {"filename": "/data/script/grail/dialogs_cs.lua", "start": 1087742, "end": 1090665, "audio": 0}, {"filename": "/data/script/grail/dialogs_de_CH.lua", "start": 1090665, "end": 1090986, "audio": 0}, {"filename": "/data/script/grail/dialogs_de.lua", "start": 1090986, "end": 1093918, "audio": 0}, {"filename": "/data/script/grail/dialogs_en.lua", "start": 1093918, "end": 1095569, "audio": 0}, {"filename": "/data/script/grail/dialogs_es.lua", "start": 1095569, "end": 1098453, "audio": 0}, {"filename": "/data/script/grail/dialogs_fr.lua", "start": 1098453, "end": 1101374, "audio": 0}, {"filename": "/data/script/grail/dialogs_it.lua", "start": 1101374, "end": 1104166, "audio": 0}, {"filename": "/data/script/grail/dialogs.lua", "start": 1104166, "end": 1104204, "audio": 0}, {"filename": "/data/script/grail/dialogs_nl.lua", "start": 1104204, "end": 1107097, "audio": 0}, {"filename": "/data/script/grail/dialogs_pl.lua", "start": 1107097, "end": 1109968, "audio": 0}, {"filename": "/data/script/grail/dialogs_ru.lua", "start": 1109968, "end": 1113445, "audio": 0}, {"filename": "/data/script/grail/dialogs_sv.lua", "start": 1113445, "end": 1116278, "audio": 0}, {"filename": "/data/script/grail/init.lua", "start": 1116278, "end": 1116922, "audio": 0}, {"filename": "/data/script/grail/models.lua", "start": 1116922, "end": 1123956, "audio": 0}, {"filename": "/data/sound/grail/cs/gr-m-gral.ogg", "start": 1123956, "end": 1150088, "audio": 1}, {"filename": "/data/sound/grail/cs/gr-m-jensvaty.ogg", "start": 1150088, "end": 1164930, "audio": 1}, {"filename": "/data/sound/grail/cs/gr-m-svaty0.ogg", "start": 1164930, "end": 1194866, "audio": 1}, {"filename": "/data/sound/grail/cs/gr-m-svaty1.ogg", "start": 1194866, "end": 1221027, "audio": 1}, {"filename": "/data/sound/grail/cs/gr-m-tuseni.ogg", "start": 1221027, "end": 1234990, "audio": 1}, {"filename": "/data/sound/grail/cs/gr-m-vsechny0.ogg", "start": 1234990, "end": 1263106, "audio": 1}, {"filename": "/data/sound/grail/cs/gr-m-vsechny1.ogg", "start": 1263106, "end": 1292719, "audio": 1}, {"filename": "/data/sound/grail/cs/gr-m-zare0.ogg", "start": 1292719, "end": 1308044, "audio": 1}, {"filename": "/data/sound/grail/cs/gr-m-zare1.ogg", "start": 1308044, "end": 1329535, "audio": 1}, {"filename": "/data/sound/grail/cs/gr-m-zare2.ogg", "start": 1329535, "end": 1368381, "audio": 1}, {"filename": "/data/sound/grail/cs/gr-v-jiste.ogg", "start": 1368381, "end": 1384766, "audio": 1}, {"filename": "/data/sound/grail/cs/gr-v-nic0.ogg", "start": 1384766, "end": 1416670, "audio": 1}, {"filename": "/data/sound/grail/cs/gr-v-nic1.ogg", "start": 1416670, "end": 1451463, "audio": 1}, {"filename": "/data/sound/grail/cs/gr-v-nic2.ogg", "start": 1451463, "end": 1490845, "audio": 1}, {"filename": "/data/sound/grail/cs/gr-v-skoro0.ogg", "start": 1490845, "end": 1507251, "audio": 1}, {"filename": "/data/sound/grail/cs/gr-v-skoro1.ogg", "start": 1507251, "end": 1521738, "audio": 1}, {"filename": "/data/sound/grail/cs/gr-v-tuseni.ogg", "start": 1521738, "end": 1544048, "audio": 1}, {"filename": "/data/sound/grail/cs/gr-v-vsechny0.ogg", "start": 1544048, "end": 1560462, "audio": 1}, {"filename": "/data/sound/grail/cs/gr-v-vsechny1.ogg", "start": 1560462, "end": 1574220, "audio": 1}, {"filename": "/data/sound/grail/nl/gr-m-gral.ogg", "start": 1574220, "end": 1595533, "audio": 1}, {"filename": "/data/sound/grail/nl/gr-m-jensvaty.ogg", "start": 1595533, "end": 1619605, "audio": 1}, {"filename": "/data/sound/grail/nl/gr-m-svaty0.ogg", "start": 1619605, "end": 1645394, "audio": 1}, {"filename": "/data/sound/grail/nl/gr-m-svaty1.ogg", "start": 1645394, "end": 1673923, "audio": 1}, {"filename": "/data/sound/grail/nl/gr-m-tuseni.ogg", "start": 1673923, "end": 1693395, "audio": 1}, {"filename": "/data/sound/grail/nl/gr-m-vsechny0.ogg", "start": 1693395, "end": 1716162, "audio": 1}, {"filename": "/data/sound/grail/nl/gr-m-vsechny1.ogg", "start": 1716162, "end": 1740559, "audio": 1}, {"filename": "/data/sound/grail/nl/gr-m-zare0.ogg", "start": 1740559, "end": 1758782, "audio": 1}, {"filename": "/data/sound/grail/nl/gr-m-zare1.ogg", "start": 1758782, "end": 1782518, "audio": 1}, {"filename": "/data/sound/grail/nl/gr-m-zare2.ogg", "start": 1782518, "end": 1810900, "audio": 1}, {"filename": "/data/sound/grail/nl/gr-v-jiste.ogg", "start": 1810900, "end": 1830088, "audio": 1}, {"filename": "/data/sound/grail/nl/gr-v-nic0.ogg", "start": 1830088, "end": 1866195, "audio": 1}, {"filename": "/data/sound/grail/nl/gr-v-nic1.ogg", "start": 1866195, "end": 1905251, "audio": 1}, {"filename": "/data/sound/grail/nl/gr-v-nic2.ogg", "start": 1905251, "end": 1943224, "audio": 1}, {"filename": "/data/sound/grail/nl/gr-v-skoro0.ogg", "start": 1943224, "end": 1963657, "audio": 1}, {"filename": "/data/sound/grail/nl/gr-v-skoro1.ogg", "start": 1963657, "end": 1990190, "audio": 1}, {"filename": "/data/sound/grail/nl/gr-v-tuseni.ogg", "start": 1990190, "end": 2019502, "audio": 1}, {"filename": "/data/sound/grail/nl/gr-v-vsechny0.ogg", "start": 2019502, "end": 2041615, "audio": 1}, {"filename": "/data/sound/grail/nl/gr-v-vsechny1.ogg", "start": 2041615, "end": 2062959, "audio": 1}], "remote_package_size": 2062959, "package_uuid": "73d37e63-5e14-4362-ae53-8f5269b337ef"});

})();
