
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
    var PACKAGE_NAME = 'web/data/party1.data';
    var REMOTE_PACKAGE_BASE = 'data/party1.data';
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
Module['FS_createPath']('/data/images', 'party1', true, true);
Module['FS_createPath']('/data/images', 'party2', true, true);
Module['FS_createPath']('/data', 'script', true, true);
Module['FS_createPath']('/data/script', 'party1', true, true);
Module['FS_createPath']('/data', 'sound', true, true);
Module['FS_createPath']('/data/sound', 'party1', true, true);
Module['FS_createPath']('/data/sound/party1', 'cs', true, true);
Module['FS_createPath']('/data/sound/party1', 'nl', true, true);

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
              Module['removeRunDependency']('datafile_web/data/party1.data');

    };
    Module['addRunDependency']('datafile_web/data/party1.data');
  
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
 loadPackage({"files": [{"filename": "/data/images/party1/1-ocel.png", "start": 0, "end": 2301, "audio": 0}, {"filename": "/data/images/party1/dama_00.png", "start": 2301, "end": 3097, "audio": 0}, {"filename": "/data/images/party1/dama_01.png", "start": 3097, "end": 4676, "audio": 0}, {"filename": "/data/images/party1/dama_02.png", "start": 4676, "end": 6568, "audio": 0}, {"filename": "/data/images/party1/dama_03.png", "start": 6568, "end": 8647, "audio": 0}, {"filename": "/data/images/party1/dama_04.png", "start": 8647, "end": 10903, "audio": 0}, {"filename": "/data/images/party1/dama_05.png", "start": 10903, "end": 13191, "audio": 0}, {"filename": "/data/images/party1/dama_06.png", "start": 13191, "end": 15505, "audio": 0}, {"filename": "/data/images/party1/dama_07.png", "start": 15505, "end": 17792, "audio": 0}, {"filename": "/data/images/party1/dama_08.png", "start": 17792, "end": 20036, "audio": 0}, {"filename": "/data/images/party1/dama_09.png", "start": 20036, "end": 22056, "audio": 0}, {"filename": "/data/images/party1/dama_10.png", "start": 22056, "end": 23722, "audio": 0}, {"filename": "/data/images/party1/dama_11.png", "start": 23722, "end": 25033, "audio": 0}, {"filename": "/data/images/party1/dama_12.png", "start": 25033, "end": 26088, "audio": 0}, {"filename": "/data/images/party1/dama_13.png", "start": 26088, "end": 26775, "audio": 0}, {"filename": "/data/images/party1/dama_14.png", "start": 26775, "end": 27220, "audio": 0}, {"filename": "/data/images/party1/dama_15.png", "start": 27220, "end": 29520, "audio": 0}, {"filename": "/data/images/party1/frkavec_00.png", "start": 29520, "end": 29997, "audio": 0}, {"filename": "/data/images/party1/frkavec_01.png", "start": 29997, "end": 31075, "audio": 0}, {"filename": "/data/images/party1/frkavec_02.png", "start": 31075, "end": 32343, "audio": 0}, {"filename": "/data/images/party1/frkavec_03.png", "start": 32343, "end": 33651, "audio": 0}, {"filename": "/data/images/party1/frkavec_04.png", "start": 33651, "end": 34958, "audio": 0}, {"filename": "/data/images/party1/frkavec_05.png", "start": 34958, "end": 36266, "audio": 0}, {"filename": "/data/images/party1/frkavec_06.png", "start": 36266, "end": 37449, "audio": 0}, {"filename": "/data/images/party1/kabina_okna_o.png", "start": 37449, "end": 40012, "audio": 0}, {"filename": "/data/images/party1/kabina_o.png", "start": 40012, "end": 63463, "audio": 0}, {"filename": "/data/images/party1/kap_00.png", "start": 63463, "end": 64074, "audio": 0}, {"filename": "/data/images/party1/kap_01.png", "start": 64074, "end": 64820, "audio": 0}, {"filename": "/data/images/party1/kap_02.png", "start": 64820, "end": 65680, "audio": 0}, {"filename": "/data/images/party1/kap_03.png", "start": 65680, "end": 66849, "audio": 0}, {"filename": "/data/images/party1/kap_04.png", "start": 66849, "end": 68281, "audio": 0}, {"filename": "/data/images/party1/kap_05.png", "start": 68281, "end": 69937, "audio": 0}, {"filename": "/data/images/party1/kap_06.png", "start": 69937, "end": 71676, "audio": 0}, {"filename": "/data/images/party1/kap_07.png", "start": 71676, "end": 73424, "audio": 0}, {"filename": "/data/images/party1/kap_08.png", "start": 73424, "end": 75175, "audio": 0}, {"filename": "/data/images/party1/kap_09.png", "start": 75175, "end": 76924, "audio": 0}, {"filename": "/data/images/party1/kap_10.png", "start": 76924, "end": 78591, "audio": 0}, {"filename": "/data/images/party1/kap_11.png", "start": 78591, "end": 80018, "audio": 0}, {"filename": "/data/images/party1/kap_12.png", "start": 80018, "end": 81324, "audio": 0}, {"filename": "/data/images/party1/kap_13.png", "start": 81324, "end": 82506, "audio": 0}, {"filename": "/data/images/party1/kap_14.png", "start": 82506, "end": 83316, "audio": 0}, {"filename": "/data/images/party1/kap_15.png", "start": 83316, "end": 85059, "audio": 0}, {"filename": "/data/images/party1/kap_16.png", "start": 85059, "end": 86801, "audio": 0}, {"filename": "/data/images/party1/kap_17.png", "start": 86801, "end": 88537, "audio": 0}, {"filename": "/data/images/party1/kap_18.png", "start": 88537, "end": 90273, "audio": 0}, {"filename": "/data/images/party1/lodnik_00.png", "start": 90273, "end": 91339, "audio": 0}, {"filename": "/data/images/party1/lodnik_01.png", "start": 91339, "end": 92670, "audio": 0}, {"filename": "/data/images/party1/lodnik_02.png", "start": 92670, "end": 94010, "audio": 0}, {"filename": "/data/images/party1/lodnik_03.png", "start": 94010, "end": 95354, "audio": 0}, {"filename": "/data/images/party1/lodnik_04.png", "start": 95354, "end": 96696, "audio": 0}, {"filename": "/data/images/party1/lodnik_05.png", "start": 96696, "end": 98039, "audio": 0}, {"filename": "/data/images/party1/lodnik_06.png", "start": 98039, "end": 99379, "audio": 0}, {"filename": "/data/images/party1/lodnik_07.png", "start": 99379, "end": 100628, "audio": 0}, {"filename": "/data/images/party1/lodnik_08.png", "start": 100628, "end": 101660, "audio": 0}, {"filename": "/data/images/party1/lodnik_09.png", "start": 101660, "end": 102217, "audio": 0}, {"filename": "/data/images/party1/lodnik_10.png", "start": 102217, "end": 103023, "audio": 0}, {"filename": "/data/images/party1/lodnik_11.png", "start": 103023, "end": 104184, "audio": 0}, {"filename": "/data/images/party1/lodnik_12.png", "start": 104184, "end": 105679, "audio": 0}, {"filename": "/data/images/party1/lodnik_13.png", "start": 105679, "end": 107487, "audio": 0}, {"filename": "/data/images/party1/lodnik_14.png", "start": 107487, "end": 109330, "audio": 0}, {"filename": "/data/images/party1/lodnik_15.png", "start": 109330, "end": 111178, "audio": 0}, {"filename": "/data/images/party1/lodnik_16.png", "start": 111178, "end": 113019, "audio": 0}, {"filename": "/data/images/party1/lodnik_17.png", "start": 113019, "end": 114852, "audio": 0}, {"filename": "/data/images/party1/lodnik_18.png", "start": 114852, "end": 116550, "audio": 0}, {"filename": "/data/images/party1/lodnik_19.png", "start": 116550, "end": 117899, "audio": 0}, {"filename": "/data/images/party1/lodnik_20.png", "start": 117899, "end": 119149, "audio": 0}, {"filename": "/data/images/party1/lodnik_21.png", "start": 119149, "end": 120177, "audio": 0}, {"filename": "/data/images/party1/lodnik_22.png", "start": 120177, "end": 120833, "audio": 0}, {"filename": "/data/images/party1/party1-p.png", "start": 120833, "end": 308059, "audio": 0}, {"filename": "/data/images/party1/party1-w.png", "start": 308059, "end": 664134, "audio": 0}, {"filename": "/data/images/party1/sklenicka_00.png", "start": 664134, "end": 664724, "audio": 0}, {"filename": "/data/images/party1/sklenicka_01.png", "start": 664724, "end": 665276, "audio": 0}, {"filename": "/data/images/party1/sklenicka_02.png", "start": 665276, "end": 665852, "audio": 0}, {"filename": "/data/images/party1/tacek_00.png", "start": 665852, "end": 666685, "audio": 0}, {"filename": "/data/images/party1/tacek_01.png", "start": 666685, "end": 667530, "audio": 0}, {"filename": "/data/images/party1/tacek_02.png", "start": 667530, "end": 668362, "audio": 0}, {"filename": "/data/images/party2/party1-p.png", "start": 668362, "end": 855588, "audio": 0}, {"filename": "/data/script/party1/code.lua", "start": 855588, "end": 877442, "audio": 0}, {"filename": "/data/script/party1/dialogs_bg.lua", "start": 877442, "end": 879653, "audio": 0}, {"filename": "/data/script/party1/dialogs_cs.lua", "start": 879653, "end": 881520, "audio": 0}, {"filename": "/data/script/party1/dialogs_de.lua", "start": 881520, "end": 883457, "audio": 0}, {"filename": "/data/script/party1/dialogs_en.lua", "start": 883457, "end": 884556, "audio": 0}, {"filename": "/data/script/party1/dialogs_es.lua", "start": 884556, "end": 886418, "audio": 0}, {"filename": "/data/script/party1/dialogs_fr.lua", "start": 886418, "end": 888314, "audio": 0}, {"filename": "/data/script/party1/dialogs_it.lua", "start": 888314, "end": 890149, "audio": 0}, {"filename": "/data/script/party1/dialogs.lua", "start": 890149, "end": 890187, "audio": 0}, {"filename": "/data/script/party1/dialogs_nl.lua", "start": 890187, "end": 892026, "audio": 0}, {"filename": "/data/script/party1/dialogs_pl.lua", "start": 892026, "end": 893894, "audio": 0}, {"filename": "/data/script/party1/dialogs_ru.lua", "start": 893894, "end": 896104, "audio": 0}, {"filename": "/data/script/party1/dialogs_sl.lua", "start": 896104, "end": 897919, "audio": 0}, {"filename": "/data/script/party1/dialogs_sv.lua", "start": 897919, "end": 899805, "audio": 0}, {"filename": "/data/script/party1/init.lua", "start": 899805, "end": 900450, "audio": 0}, {"filename": "/data/script/party1/models.lua", "start": 900450, "end": 905014, "audio": 0}, {"filename": "/data/sound/party1/cs/pt1-m-kostlivec.ogg", "start": 905014, "end": 933736, "audio": 1}, {"filename": "/data/sound/party1/cs/pt1-m-nemuzu.ogg", "start": 933736, "end": 949587, "audio": 1}, {"filename": "/data/sound/party1/cs/pt1-m-parnicek.ogg", "start": 949587, "end": 971257, "audio": 1}, {"filename": "/data/sound/party1/cs/pt1-m-predtucha.ogg", "start": 971257, "end": 1004347, "audio": 1}, {"filename": "/data/sound/party1/cs/pt1-m-vylezt0.ogg", "start": 1004347, "end": 1026666, "audio": 1}, {"filename": "/data/sound/party1/cs/pt1-m-vylezt1.ogg", "start": 1026666, "end": 1043919, "audio": 1}, {"filename": "/data/sound/party1/cs/pt1-m-vylezt2.ogg", "start": 1043919, "end": 1061423, "audio": 1}, {"filename": "/data/sound/party1/cs/pt1-v-pozor.ogg", "start": 1061423, "end": 1079630, "audio": 1}, {"filename": "/data/sound/party1/cs/pt1-v-predtucha.ogg", "start": 1079630, "end": 1114627, "audio": 1}, {"filename": "/data/sound/party1/cs/pt1-v-pryc0.ogg", "start": 1114627, "end": 1146935, "audio": 1}, {"filename": "/data/sound/party1/cs/pt1-v-pryc1.ogg", "start": 1146935, "end": 1174629, "audio": 1}, {"filename": "/data/sound/party1/cs/pt1-v-valec.ogg", "start": 1174629, "end": 1202913, "audio": 1}, {"filename": "/data/sound/party1/nl/pt1-m-kostlivec.ogg", "start": 1202913, "end": 1227570, "audio": 1}, {"filename": "/data/sound/party1/nl/pt1-m-nemuzu.ogg", "start": 1227570, "end": 1246610, "audio": 1}, {"filename": "/data/sound/party1/nl/pt1-m-parnicek.ogg", "start": 1246610, "end": 1265739, "audio": 1}, {"filename": "/data/sound/party1/nl/pt1-m-predtucha.ogg", "start": 1265739, "end": 1295998, "audio": 1}, {"filename": "/data/sound/party1/nl/pt1-m-vylezt0.ogg", "start": 1295998, "end": 1318339, "audio": 1}, {"filename": "/data/sound/party1/nl/pt1-m-vylezt1.ogg", "start": 1318339, "end": 1341453, "audio": 1}, {"filename": "/data/sound/party1/nl/pt1-m-vylezt2.ogg", "start": 1341453, "end": 1363259, "audio": 1}, {"filename": "/data/sound/party1/nl/pt1-v-pozor.ogg", "start": 1363259, "end": 1381653, "audio": 1}, {"filename": "/data/sound/party1/nl/pt1-v-predtucha.ogg", "start": 1381653, "end": 1407154, "audio": 1}, {"filename": "/data/sound/party1/nl/pt1-v-pryc0.ogg", "start": 1407154, "end": 1437943, "audio": 1}, {"filename": "/data/sound/party1/nl/pt1-v-pryc1.ogg", "start": 1437943, "end": 1465721, "audio": 1}, {"filename": "/data/sound/party1/nl/pt1-v-valec.ogg", "start": 1465721, "end": 1489921, "audio": 1}], "remote_package_size": 1489921, "package_uuid": "166086ad-dfb1-4668-b2e1-0450cfa66810"});

})();
