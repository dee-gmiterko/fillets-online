
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
    var PACKAGE_NAME = 'web/data/computer.data';
    var REMOTE_PACKAGE_BASE = 'data/computer.data';
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
Module['FS_createPath']('/data/images', 'computer', true, true);
Module['FS_createPath']('/data', 'script', true, true);
Module['FS_createPath']('/data/script', 'computer', true, true);
Module['FS_createPath']('/data', 'sound', true, true);
Module['FS_createPath']('/data/sound', 'computer', true, true);
Module['FS_createPath']('/data/sound/computer', 'cs', true, true);
Module['FS_createPath']('/data/sound/computer', 'nl', true, true);

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
              Module['removeRunDependency']('datafile_web/data/computer.data');

    };
    Module['addRunDependency']('datafile_web/data/computer.data');
  
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
 loadPackage({"files": [{"filename": "/data/images/computer/4-ocel.png", "start": 0, "end": 3587, "audio": 0}, {"filename": "/data/images/computer/cola.png", "start": 3587, "end": 4748, "audio": 0}, {"filename": "/data/images/computer/kanystr.png", "start": 4748, "end": 7155, "audio": 0}, {"filename": "/data/images/computer/klavesnice.png", "start": 7155, "end": 16583, "audio": 0}, {"filename": "/data/images/computer/monitor.png", "start": 16583, "end": 38681, "audio": 0}, {"filename": "/data/images/computer/pocitac-okoli.png", "start": 38681, "end": 257749, "audio": 0}, {"filename": "/data/images/computer/pocitac.png", "start": 257749, "end": 278372, "audio": 0}, {"filename": "/data/images/computer/pocitac-pozadi.png", "start": 278372, "end": 497704, "audio": 0}, {"filename": "/data/images/computer/roura_st_a.png", "start": 497704, "end": 499335, "audio": 0}, {"filename": "/data/images/computer/roura_st.png", "start": 499335, "end": 501197, "audio": 0}, {"filename": "/data/images/computer/vyvrtka.png", "start": 501197, "end": 504599, "audio": 0}, {"filename": "/data/script/computer/code.lua", "start": 504599, "end": 509297, "audio": 0}, {"filename": "/data/script/computer/dialogs_bg.lua", "start": 509297, "end": 513970, "audio": 0}, {"filename": "/data/script/computer/dialogs_cs.lua", "start": 513970, "end": 517883, "audio": 0}, {"filename": "/data/script/computer/dialogs_de_CH.lua", "start": 517883, "end": 518170, "audio": 0}, {"filename": "/data/script/computer/dialogs_de.lua", "start": 518170, "end": 522100, "audio": 0}, {"filename": "/data/script/computer/dialogs_en.lua", "start": 522100, "end": 524365, "audio": 0}, {"filename": "/data/script/computer/dialogs_es.lua", "start": 524365, "end": 528403, "audio": 0}, {"filename": "/data/script/computer/dialogs_fr.lua", "start": 528403, "end": 532350, "audio": 0}, {"filename": "/data/script/computer/dialogs_it.lua", "start": 532350, "end": 536220, "audio": 0}, {"filename": "/data/script/computer/dialogs.lua", "start": 536220, "end": 536258, "audio": 0}, {"filename": "/data/script/computer/dialogs_nl.lua", "start": 536258, "end": 540190, "audio": 0}, {"filename": "/data/script/computer/dialogs_pl.lua", "start": 540190, "end": 544126, "audio": 0}, {"filename": "/data/script/computer/dialogs_ru.lua", "start": 544126, "end": 549026, "audio": 0}, {"filename": "/data/script/computer/dialogs_sv.lua", "start": 549026, "end": 552924, "audio": 0}, {"filename": "/data/script/computer/init.lua", "start": 552924, "end": 553571, "audio": 0}, {"filename": "/data/script/computer/models.lua", "start": 553571, "end": 556295, "audio": 0}, {"filename": "/data/sound/computer/cs/poc-m-kcemu.ogg", "start": 556295, "end": 605990, "audio": 1}, {"filename": "/data/sound/computer/cs/poc-m-kram.ogg", "start": 605990, "end": 643263, "audio": 1}, {"filename": "/data/sound/computer/cs/poc-m-lezt0.ogg", "start": 643263, "end": 658705, "audio": 1}, {"filename": "/data/sound/computer/cs/poc-m-lezt1.ogg", "start": 658705, "end": 672444, "audio": 1}, {"filename": "/data/sound/computer/cs/poc-m-lezt2.ogg", "start": 672444, "end": 684881, "audio": 1}, {"filename": "/data/sound/computer/cs/poc-m-mechanika.ogg", "start": 684881, "end": 700678, "audio": 1}, {"filename": "/data/sound/computer/cs/poc-m-mohlby.ogg", "start": 700678, "end": 714359, "audio": 1}, {"filename": "/data/sound/computer/cs/poc-m-myslis.ogg", "start": 714359, "end": 737962, "audio": 1}, {"filename": "/data/sound/computer/cs/poc-m-ukryta.ogg", "start": 737962, "end": 775608, "audio": 1}, {"filename": "/data/sound/computer/cs/poc-m-vyvrtka.ogg", "start": 775608, "end": 796014, "audio": 1}, {"filename": "/data/sound/computer/cs/poc-m-zezadu.ogg", "start": 796014, "end": 812949, "audio": 1}, {"filename": "/data/sound/computer/cs/poc-v-dira.ogg", "start": 812949, "end": 833667, "audio": 1}, {"filename": "/data/sound/computer/cs/poc-v-kam0.ogg", "start": 833667, "end": 861302, "audio": 1}, {"filename": "/data/sound/computer/cs/poc-v-kam1.ogg", "start": 861302, "end": 882592, "audio": 1}, {"filename": "/data/sound/computer/cs/poc-v-kam2.ogg", "start": 882592, "end": 902592, "audio": 1}, {"filename": "/data/sound/computer/cs/poc-v-kam3.ogg", "start": 902592, "end": 923385, "audio": 1}, {"filename": "/data/sound/computer/cs/poc-v-mono.ogg", "start": 923385, "end": 935553, "audio": 1}, {"filename": "/data/sound/computer/cs/poc-v-multimed.ogg", "start": 935553, "end": 982162, "audio": 1}, {"filename": "/data/sound/computer/cs/poc-v-napad.ogg", "start": 982162, "end": 1021615, "audio": 1}, {"filename": "/data/sound/computer/cs/poc-v-nenajde.ogg", "start": 1021615, "end": 1042941, "audio": 1}, {"filename": "/data/sound/computer/cs/poc-v-pssst.ogg", "start": 1042941, "end": 1051665, "audio": 1}, {"filename": "/data/sound/computer/cs/poc-v-stahni.ogg", "start": 1051665, "end": 1082467, "audio": 1}, {"filename": "/data/sound/computer/cs/poc-v-vyresil.ogg", "start": 1082467, "end": 1163067, "audio": 1}, {"filename": "/data/sound/computer/nl/poc-m-kcemu.ogg", "start": 1163067, "end": 1206485, "audio": 1}, {"filename": "/data/sound/computer/nl/poc-m-kram.ogg", "start": 1206485, "end": 1252290, "audio": 1}, {"filename": "/data/sound/computer/nl/poc-m-lezt0.ogg", "start": 1252290, "end": 1267012, "audio": 1}, {"filename": "/data/sound/computer/nl/poc-m-lezt1.ogg", "start": 1267012, "end": 1283805, "audio": 1}, {"filename": "/data/sound/computer/nl/poc-m-lezt2.ogg", "start": 1283805, "end": 1300286, "audio": 1}, {"filename": "/data/sound/computer/nl/poc-m-mechanika.ogg", "start": 1300286, "end": 1316764, "audio": 1}, {"filename": "/data/sound/computer/nl/poc-m-mohlby.ogg", "start": 1316764, "end": 1331755, "audio": 1}, {"filename": "/data/sound/computer/nl/poc-m-myslis.ogg", "start": 1331755, "end": 1355078, "audio": 1}, {"filename": "/data/sound/computer/nl/poc-m-ukryta.ogg", "start": 1355078, "end": 1391686, "audio": 1}, {"filename": "/data/sound/computer/nl/poc-m-vyvrtka.ogg", "start": 1391686, "end": 1414000, "audio": 1}, {"filename": "/data/sound/computer/nl/poc-m-zezadu.ogg", "start": 1414000, "end": 1432373, "audio": 1}, {"filename": "/data/sound/computer/nl/poc-v-dira.ogg", "start": 1432373, "end": 1452521, "audio": 1}, {"filename": "/data/sound/computer/nl/poc-v-kam0.ogg", "start": 1452521, "end": 1490367, "audio": 1}, {"filename": "/data/sound/computer/nl/poc-v-kam1.ogg", "start": 1490367, "end": 1510391, "audio": 1}, {"filename": "/data/sound/computer/nl/poc-v-kam2.ogg", "start": 1510391, "end": 1536555, "audio": 1}, {"filename": "/data/sound/computer/nl/poc-v-kam3.ogg", "start": 1536555, "end": 1566258, "audio": 1}, {"filename": "/data/sound/computer/nl/poc-v-mono.ogg", "start": 1566258, "end": 1583024, "audio": 1}, {"filename": "/data/sound/computer/nl/poc-v-multimed.ogg", "start": 1583024, "end": 1631054, "audio": 1}, {"filename": "/data/sound/computer/nl/poc-v-napad.ogg", "start": 1631054, "end": 1663779, "audio": 1}, {"filename": "/data/sound/computer/nl/poc-v-nenajde.ogg", "start": 1663779, "end": 1686248, "audio": 1}, {"filename": "/data/sound/computer/nl/poc-v-pssst.ogg", "start": 1686248, "end": 1703150, "audio": 1}, {"filename": "/data/sound/computer/nl/poc-v-stahni.ogg", "start": 1703150, "end": 1739960, "audio": 1}, {"filename": "/data/sound/computer/nl/poc-v-vyresil.ogg", "start": 1739960, "end": 1823489, "audio": 1}], "remote_package_size": 1823489, "package_uuid": "030274cf-47dc-4696-9de3-a844b9fb388f"});

})();
