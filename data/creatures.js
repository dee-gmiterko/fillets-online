
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
    var PACKAGE_NAME = 'web/data/creatures.data';
    var REMOTE_PACKAGE_BASE = 'data/creatures.data';
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
Module['FS_createPath']('/data/images', 'creatures', true, true);
Module['FS_createPath']('/data', 'script', true, true);
Module['FS_createPath']('/data/script', 'creatures', true, true);
Module['FS_createPath']('/data', 'sound', true, true);
Module['FS_createPath']('/data/sound', 'creatures', true, true);
Module['FS_createPath']('/data/sound/creatures', 'cs', true, true);
Module['FS_createPath']('/data/sound/creatures', 'en', true, true);
Module['FS_createPath']('/data/sound/creatures', 'nl', true, true);

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
              Module['removeRunDependency']('datafile_web/data/creatures.data');

    };
    Module['addRunDependency']('datafile_web/data/creatures.data');
  
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
 loadPackage({"files": [{"filename": "/data/images/creatures/balal_00.png", "start": 0, "end": 4330, "audio": 0}, {"filename": "/data/images/creatures/balal_01.png", "start": 4330, "end": 8596, "audio": 0}, {"filename": "/data/images/creatures/balal_02.png", "start": 8596, "end": 12778, "audio": 0}, {"filename": "/data/images/creatures/balal_03.png", "start": 12778, "end": 16939, "audio": 0}, {"filename": "/data/images/creatures/balal_04.png", "start": 16939, "end": 21065, "audio": 0}, {"filename": "/data/images/creatures/balal_05.png", "start": 21065, "end": 25387, "audio": 0}, {"filename": "/data/images/creatures/balal_06.png", "start": 25387, "end": 29710, "audio": 0}, {"filename": "/data/images/creatures/balal_07.png", "start": 29710, "end": 34038, "audio": 0}, {"filename": "/data/images/creatures/balal_08.png", "start": 34038, "end": 38392, "audio": 0}, {"filename": "/data/images/creatures/balal_09.png", "start": 38392, "end": 42786, "audio": 0}, {"filename": "/data/images/creatures/balal_10.png", "start": 42786, "end": 47210, "audio": 0}, {"filename": "/data/images/creatures/koraly-p.png", "start": 47210, "end": 392463, "audio": 0}, {"filename": "/data/images/creatures/koraly-w.png", "start": 392463, "end": 802233, "audio": 0}, {"filename": "/data/images/creatures/krab_00.png", "start": 802233, "end": 803316, "audio": 0}, {"filename": "/data/images/creatures/krab_01.png", "start": 803316, "end": 804394, "audio": 0}, {"filename": "/data/images/creatures/krab_02.png", "start": 804394, "end": 805458, "audio": 0}, {"filename": "/data/images/creatures/krab_03.png", "start": 805458, "end": 806530, "audio": 0}, {"filename": "/data/images/creatures/krab_04.png", "start": 806530, "end": 807608, "audio": 0}, {"filename": "/data/images/creatures/krab_05.png", "start": 807608, "end": 808689, "audio": 0}, {"filename": "/data/images/creatures/krab_06.png", "start": 808689, "end": 809820, "audio": 0}, {"filename": "/data/images/creatures/krab_07.png", "start": 809820, "end": 810937, "audio": 0}, {"filename": "/data/images/creatures/krab_08.png", "start": 810937, "end": 812004, "audio": 0}, {"filename": "/data/images/creatures/krab_09.png", "start": 812004, "end": 813114, "audio": 0}, {"filename": "/data/images/creatures/maly_snek_00.png", "start": 813114, "end": 813788, "audio": 0}, {"filename": "/data/images/creatures/maly_snek_01.png", "start": 813788, "end": 814485, "audio": 0}, {"filename": "/data/images/creatures/maly_snek_02.png", "start": 814485, "end": 815202, "audio": 0}, {"filename": "/data/images/creatures/maly_snek_03.png", "start": 815202, "end": 815862, "audio": 0}, {"filename": "/data/images/creatures/ocel-1.png", "start": 815862, "end": 817654, "audio": 0}, {"filename": "/data/images/creatures/ocel-2.png", "start": 817654, "end": 818350, "audio": 0}, {"filename": "/data/images/creatures/ocel-3.png", "start": 818350, "end": 819941, "audio": 0}, {"filename": "/data/images/creatures/sasanka_00.png", "start": 819941, "end": 820565, "audio": 0}, {"filename": "/data/images/creatures/sasanka_01.png", "start": 820565, "end": 821287, "audio": 0}, {"filename": "/data/images/creatures/sasanka_02.png", "start": 821287, "end": 821974, "audio": 0}, {"filename": "/data/images/creatures/sasanka_03.png", "start": 821974, "end": 822644, "audio": 0}, {"filename": "/data/images/creatures/sasanka_04.png", "start": 822644, "end": 823268, "audio": 0}, {"filename": "/data/images/creatures/sasanka_05.png", "start": 823268, "end": 823963, "audio": 0}, {"filename": "/data/images/creatures/sasanka_06.png", "start": 823963, "end": 824660, "audio": 0}, {"filename": "/data/images/creatures/sasanka_07.png", "start": 824660, "end": 825365, "audio": 0}, {"filename": "/data/images/creatures/sepie_00.png", "start": 825365, "end": 828386, "audio": 0}, {"filename": "/data/images/creatures/sepie_01.png", "start": 828386, "end": 831464, "audio": 0}, {"filename": "/data/images/creatures/sepie_02.png", "start": 831464, "end": 834596, "audio": 0}, {"filename": "/data/images/creatures/sepie_03.png", "start": 834596, "end": 837459, "audio": 0}, {"filename": "/data/images/creatures/sepie_04.png", "start": 837459, "end": 840332, "audio": 0}, {"filename": "/data/images/creatures/sepie_05.png", "start": 840332, "end": 843284, "audio": 0}, {"filename": "/data/images/creatures/sepie_06.png", "start": 843284, "end": 846300, "audio": 0}, {"filename": "/data/images/creatures/sepie_07.png", "start": 846300, "end": 849365, "audio": 0}, {"filename": "/data/images/creatures/sepie_08.png", "start": 849365, "end": 852482, "audio": 0}, {"filename": "/data/images/creatures/sepie_09.png", "start": 852482, "end": 855315, "audio": 0}, {"filename": "/data/images/creatures/sepie_10.png", "start": 855315, "end": 858282, "audio": 0}, {"filename": "/data/images/creatures/sepie_11.png", "start": 858282, "end": 861067, "audio": 0}, {"filename": "/data/images/creatures/sepie_12.png", "start": 861067, "end": 864026, "audio": 0}, {"filename": "/data/images/creatures/shell1.png", "start": 864026, "end": 864757, "audio": 0}, {"filename": "/data/script/creatures/code.lua", "start": 864757, "end": 891547, "audio": 0}, {"filename": "/data/script/creatures/dialogs_bg.lua", "start": 891547, "end": 897037, "audio": 0}, {"filename": "/data/script/creatures/dialogs_cs.lua", "start": 897037, "end": 901639, "audio": 0}, {"filename": "/data/script/creatures/dialogs_de_CH.lua", "start": 901639, "end": 902097, "audio": 0}, {"filename": "/data/script/creatures/dialogs_de.lua", "start": 902097, "end": 906857, "audio": 0}, {"filename": "/data/script/creatures/dialogs_en.lua", "start": 906857, "end": 909815, "audio": 0}, {"filename": "/data/script/creatures/dialogs_es.lua", "start": 909815, "end": 914614, "audio": 0}, {"filename": "/data/script/creatures/dialogs_fr.lua", "start": 914614, "end": 919365, "audio": 0}, {"filename": "/data/script/creatures/dialogs_it.lua", "start": 919365, "end": 924006, "audio": 0}, {"filename": "/data/script/creatures/dialogs.lua", "start": 924006, "end": 924044, "audio": 0}, {"filename": "/data/script/creatures/dialogs_nl.lua", "start": 924044, "end": 928716, "audio": 0}, {"filename": "/data/script/creatures/dialogs_pl.lua", "start": 928716, "end": 933309, "audio": 0}, {"filename": "/data/script/creatures/dialogs_ru.lua", "start": 933309, "end": 938818, "audio": 0}, {"filename": "/data/script/creatures/dialogs_sv.lua", "start": 938818, "end": 943513, "audio": 0}, {"filename": "/data/script/creatures/init.lua", "start": 943513, "end": 944161, "audio": 0}, {"filename": "/data/script/creatures/models.lua", "start": 944161, "end": 948714, "audio": 0}, {"filename": "/data/sound/creatures/cs/kor-m-avlada.ogg", "start": 948714, "end": 963041, "audio": 1}, {"filename": "/data/sound/creatures/cs/kor-m-bizarni.ogg", "start": 963041, "end": 993833, "audio": 1}, {"filename": "/data/sound/creatures/cs/kor-m-budesmuset.ogg", "start": 993833, "end": 1019545, "audio": 1}, {"filename": "/data/sound/creatures/cs/kor-m-dusi.ogg", "start": 1019545, "end": 1040018, "audio": 1}, {"filename": "/data/sound/creatures/cs/kor-m-hraje.ogg", "start": 1040018, "end": 1058282, "audio": 1}, {"filename": "/data/sound/creatures/cs/kor-m-jinou.ogg", "start": 1058282, "end": 1080850, "audio": 1}, {"filename": "/data/sound/creatures/cs/kor-m-lezekrkem.ogg", "start": 1080850, "end": 1094413, "audio": 1}, {"filename": "/data/sound/creatures/cs/kor-m-nachob.ogg", "start": 1094413, "end": 1110690, "audio": 1}, {"filename": "/data/sound/creatures/cs/kor-m-neniono.ogg", "start": 1110690, "end": 1122162, "audio": 1}, {"filename": "/data/sound/creatures/cs/kor-m-neprehani.ogg", "start": 1122162, "end": 1139907, "audio": 1}, {"filename": "/data/sound/creatures/cs/kor-m-pocit.ogg", "start": 1139907, "end": 1163787, "audio": 1}, {"filename": "/data/sound/creatures/cs/kor-m-podivej.ogg", "start": 1163787, "end": 1180557, "audio": 1}, {"filename": "/data/sound/creatures/cs/kor-m-pokud.ogg", "start": 1180557, "end": 1199142, "audio": 1}, {"filename": "/data/sound/creatures/cs/kor-m-tovis.ogg", "start": 1199142, "end": 1226211, "audio": 1}, {"filename": "/data/sound/creatures/cs/kor-m-tudiru.ogg", "start": 1226211, "end": 1244413, "audio": 1}, {"filename": "/data/sound/creatures/cs/kor-m-vsimlsis.ogg", "start": 1244413, "end": 1260585, "audio": 1}, {"filename": "/data/sound/creatures/cs/kor-m-vzdyt.ogg", "start": 1260585, "end": 1278366, "audio": 1}, {"filename": "/data/sound/creatures/cs/kor-v-avidelas.ogg", "start": 1278366, "end": 1299492, "audio": 1}, {"filename": "/data/sound/creatures/cs/kor-v-bermudy.ogg", "start": 1299492, "end": 1335960, "audio": 1}, {"filename": "/data/sound/creatures/cs/kor-v-inteligentni.ogg", "start": 1335960, "end": 1373739, "audio": 1}, {"filename": "/data/sound/creatures/cs/kor-v-jedovate.ogg", "start": 1373739, "end": 1397125, "audio": 1}, {"filename": "/data/sound/creatures/cs/kor-v-juchacka.ogg", "start": 1397125, "end": 1413250, "audio": 1}, {"filename": "/data/sound/creatures/cs/kor-v-kostice.ogg", "start": 1413250, "end": 1429888, "audio": 1}, {"filename": "/data/sound/creatures/cs/kor-v-lezekrkem.ogg", "start": 1429888, "end": 1444824, "audio": 1}, {"filename": "/data/sound/creatures/cs/kor-v-nicje.ogg", "start": 1444824, "end": 1462775, "audio": 1}, {"filename": "/data/sound/creatures/cs/kor-v-odsud.ogg", "start": 1462775, "end": 1490292, "audio": 1}, {"filename": "/data/sound/creatures/cs/kor-v-odvaz.ogg", "start": 1490292, "end": 1515293, "audio": 1}, {"filename": "/data/sound/creatures/cs/kor-v-podivej.ogg", "start": 1515293, "end": 1540602, "audio": 1}, {"filename": "/data/sound/creatures/cs/kor-v-shledavam.ogg", "start": 1540602, "end": 1559457, "audio": 1}, {"filename": "/data/sound/creatures/cs/kor-v-spitu.ogg", "start": 1559457, "end": 1586079, "audio": 1}, {"filename": "/data/sound/creatures/cs/kor-v-treba.ogg", "start": 1586079, "end": 1606059, "audio": 1}, {"filename": "/data/sound/creatures/cs/kor-v-vali.ogg", "start": 1606059, "end": 1623084, "audio": 1}, {"filename": "/data/sound/creatures/en/kor-chob-chro.ogg", "start": 1623084, "end": 1632631, "audio": 1}, {"filename": "/data/sound/creatures/en/kor-chob-psi.ogg", "start": 1632631, "end": 1641729, "audio": 1}, {"filename": "/data/sound/creatures/en/kor-chob-tca.ogg", "start": 1641729, "end": 1650999, "audio": 1}, {"filename": "/data/sound/creatures/en/kor-room-music.ogg", "start": 1650999, "end": 1762074, "audio": 1}, {"filename": "/data/sound/creatures/nl/kor-m-avlada.ogg", "start": 1762074, "end": 1784949, "audio": 1}, {"filename": "/data/sound/creatures/nl/kor-m-bizarni.ogg", "start": 1784949, "end": 1811331, "audio": 1}, {"filename": "/data/sound/creatures/nl/kor-m-budesmuset.ogg", "start": 1811331, "end": 1833456, "audio": 1}, {"filename": "/data/sound/creatures/nl/kor-m-dusi.ogg", "start": 1833456, "end": 1854011, "audio": 1}, {"filename": "/data/sound/creatures/nl/kor-m-hraje.ogg", "start": 1854011, "end": 1870856, "audio": 1}, {"filename": "/data/sound/creatures/nl/kor-m-jinou.ogg", "start": 1870856, "end": 1890675, "audio": 1}, {"filename": "/data/sound/creatures/nl/kor-m-lezekrkem.ogg", "start": 1890675, "end": 1908375, "audio": 1}, {"filename": "/data/sound/creatures/nl/kor-m-nachob.ogg", "start": 1908375, "end": 1928994, "audio": 1}, {"filename": "/data/sound/creatures/nl/kor-m-neniono.ogg", "start": 1928994, "end": 1949819, "audio": 1}, {"filename": "/data/sound/creatures/nl/kor-m-neprehani.ogg", "start": 1949819, "end": 1969880, "audio": 1}, {"filename": "/data/sound/creatures/nl/kor-m-pocit.ogg", "start": 1969880, "end": 1997941, "audio": 1}, {"filename": "/data/sound/creatures/nl/kor-m-podivej.ogg", "start": 1997941, "end": 2018260, "audio": 1}, {"filename": "/data/sound/creatures/nl/kor-m-pokud.ogg", "start": 2018260, "end": 2040953, "audio": 1}, {"filename": "/data/sound/creatures/nl/kor-m-tovis.ogg", "start": 2040953, "end": 2067800, "audio": 1}, {"filename": "/data/sound/creatures/nl/kor-m-tudiru.ogg", "start": 2067800, "end": 2088037, "audio": 1}, {"filename": "/data/sound/creatures/nl/kor-m-vsimlsis.ogg", "start": 2088037, "end": 2107672, "audio": 1}, {"filename": "/data/sound/creatures/nl/kor-m-vzdyt.ogg", "start": 2107672, "end": 2128985, "audio": 1}, {"filename": "/data/sound/creatures/nl/kor-v-avidelas.ogg", "start": 2128985, "end": 2149048, "audio": 1}, {"filename": "/data/sound/creatures/nl/kor-v-bermudy.ogg", "start": 2149048, "end": 2182270, "audio": 1}, {"filename": "/data/sound/creatures/nl/kor-v-inteligentni.ogg", "start": 2182270, "end": 2215098, "audio": 1}, {"filename": "/data/sound/creatures/nl/kor-v-jedovate.ogg", "start": 2215098, "end": 2242535, "audio": 1}, {"filename": "/data/sound/creatures/nl/kor-v-juchacka.ogg", "start": 2242535, "end": 2264502, "audio": 1}, {"filename": "/data/sound/creatures/nl/kor-v-kostice.ogg", "start": 2264502, "end": 2286070, "audio": 1}, {"filename": "/data/sound/creatures/nl/kor-v-lezekrkem.ogg", "start": 2286070, "end": 2306369, "audio": 1}, {"filename": "/data/sound/creatures/nl/kor-v-nicje.ogg", "start": 2306369, "end": 2328453, "audio": 1}, {"filename": "/data/sound/creatures/nl/kor-v-odsud.ogg", "start": 2328453, "end": 2360509, "audio": 1}, {"filename": "/data/sound/creatures/nl/kor-v-odvaz.ogg", "start": 2360509, "end": 2387601, "audio": 1}, {"filename": "/data/sound/creatures/nl/kor-v-podivej.ogg", "start": 2387601, "end": 2412360, "audio": 1}, {"filename": "/data/sound/creatures/nl/kor-v-shledavam.ogg", "start": 2412360, "end": 2433683, "audio": 1}, {"filename": "/data/sound/creatures/nl/kor-v-spitu.ogg", "start": 2433683, "end": 2462948, "audio": 1}, {"filename": "/data/sound/creatures/nl/kor-v-treba.ogg", "start": 2462948, "end": 2484206, "audio": 1}, {"filename": "/data/sound/creatures/nl/kor-v-vali.ogg", "start": 2484206, "end": 2501472, "audio": 1}], "remote_package_size": 2501472, "package_uuid": "34deb66a-7cb4-489e-98b8-12dc798681e6"});

})();
