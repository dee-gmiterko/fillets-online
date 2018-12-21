
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
    var PACKAGE_NAME = 'web/data/hanoi.data';
    var REMOTE_PACKAGE_BASE = 'data/hanoi.data';
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
Module['FS_createPath']('/data/images', 'hanoi', true, true);
Module['FS_createPath']('/data', 'script', true, true);
Module['FS_createPath']('/data/script', 'hanoi', true, true);
Module['FS_createPath']('/data', 'sound', true, true);
Module['FS_createPath']('/data/sound', 'hanoi', true, true);
Module['FS_createPath']('/data/sound/hanoi', 'cs', true, true);
Module['FS_createPath']('/data/sound/hanoi', 'nl', true, true);

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
              Module['removeRunDependency']('datafile_web/data/hanoi.data');

    };
    Module['addRunDependency']('datafile_web/data/hanoi.data');
  
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
 loadPackage({"files": [{"filename": "/data/images/hanoi/dole.png", "start": 0, "end": 7912, "audio": 0}, {"filename": "/data/images/hanoi/dolez.png", "start": 7912, "end": 8102, "audio": 0}, {"filename": "/data/images/hanoi/nahore.png", "start": 8102, "end": 16077, "audio": 0}, {"filename": "/data/images/hanoi/nahorez.png", "start": 16077, "end": 16267, "audio": 0}, {"filename": "/data/images/hanoi/nejnize.png", "start": 16267, "end": 24014, "audio": 0}, {"filename": "/data/images/hanoi/nejnizez.png", "start": 24014, "end": 24204, "audio": 0}, {"filename": "/data/images/hanoi/nejvyse.png", "start": 24204, "end": 32330, "audio": 0}, {"filename": "/data/images/hanoi/nejvysez.png", "start": 32330, "end": 32520, "audio": 0}, {"filename": "/data/images/hanoi/ocel.png", "start": 32520, "end": 35011, "audio": 0}, {"filename": "/data/images/hanoi/popredi.png", "start": 35011, "end": 119701, "audio": 0}, {"filename": "/data/images/hanoi/pozadi.png", "start": 119701, "end": 187027, "audio": 0}, {"filename": "/data/images/hanoi/styc.png", "start": 187027, "end": 187465, "audio": 0}, {"filename": "/data/images/hanoi/tyc.png", "start": 187465, "end": 187904, "audio": 0}, {"filename": "/data/images/hanoi/uprostred.png", "start": 187904, "end": 196087, "audio": 0}, {"filename": "/data/images/hanoi/uprostredz.png", "start": 196087, "end": 196277, "audio": 0}, {"filename": "/data/images/hanoi/vocel.png", "start": 196277, "end": 197191, "audio": 0}, {"filename": "/data/script/hanoi/code.lua", "start": 197191, "end": 203014, "audio": 0}, {"filename": "/data/script/hanoi/dialogs_bg.lua", "start": 203014, "end": 208157, "audio": 0}, {"filename": "/data/script/hanoi/dialogs_cs.lua", "start": 208157, "end": 212417, "audio": 0}, {"filename": "/data/script/hanoi/dialogs_de_CH.lua", "start": 212417, "end": 216859, "audio": 0}, {"filename": "/data/script/hanoi/dialogs_de.lua", "start": 216859, "end": 221301, "audio": 0}, {"filename": "/data/script/hanoi/dialogs_en.lua", "start": 221301, "end": 223777, "audio": 0}, {"filename": "/data/script/hanoi/dialogs.lua", "start": 223777, "end": 223815, "audio": 0}, {"filename": "/data/script/hanoi/dialogs_nl.lua", "start": 223815, "end": 228202, "audio": 0}, {"filename": "/data/script/hanoi/dialogs_ru.lua", "start": 228202, "end": 233555, "audio": 0}, {"filename": "/data/script/hanoi/dialogs_sv.lua", "start": 233555, "end": 237818, "audio": 0}, {"filename": "/data/script/hanoi/init.lua", "start": 237818, "end": 238462, "audio": 0}, {"filename": "/data/script/hanoi/models.lua", "start": 238462, "end": 242300, "audio": 0}, {"filename": "/data/sound/hanoi/cs/m-bude.ogg", "start": 242300, "end": 264288, "audio": 1}, {"filename": "/data/sound/hanoi/cs/m-citovat.ogg", "start": 264288, "end": 309816, "audio": 1}, {"filename": "/data/sound/hanoi/cs/m-co.ogg", "start": 309816, "end": 326165, "audio": 1}, {"filename": "/data/sound/hanoi/cs/m-hazet.ogg", "start": 326165, "end": 380362, "audio": 1}, {"filename": "/data/sound/hanoi/cs/m-inspiroval.ogg", "start": 380362, "end": 433730, "audio": 1}, {"filename": "/data/sound/hanoi/cs/m-nepomahas.ogg", "start": 433730, "end": 483564, "audio": 1}, {"filename": "/data/sound/hanoi/cs/m-predstavujes.ogg", "start": 483564, "end": 578825, "audio": 1}, {"filename": "/data/sound/hanoi/cs/m-rekurzivni.ogg", "start": 578825, "end": 671481, "audio": 1}, {"filename": "/data/sound/hanoi/cs/m-restartuj.ogg", "start": 671481, "end": 759808, "audio": 1}, {"filename": "/data/sound/hanoi/cs/m-tesise.ogg", "start": 759808, "end": 788254, "audio": 1}, {"filename": "/data/sound/hanoi/cs/m-trikrat.ogg", "start": 788254, "end": 817506, "audio": 1}, {"filename": "/data/sound/hanoi/cs/m-vicedat.ogg", "start": 817506, "end": 871846, "audio": 1}, {"filename": "/data/sound/hanoi/cs/m-vyhecoval.ogg", "start": 871846, "end": 896384, "audio": 1}, {"filename": "/data/sound/hanoi/cs/v-alehrac.ogg", "start": 896384, "end": 924107, "audio": 1}, {"filename": "/data/sound/hanoi/cs/v-bavit.ogg", "start": 924107, "end": 974747, "audio": 1}, {"filename": "/data/sound/hanoi/cs/v-budou.ogg", "start": 974747, "end": 1015287, "audio": 1}, {"filename": "/data/sound/hanoi/cs/v-jacity.ogg", "start": 1015287, "end": 1050529, "audio": 1}, {"filename": "/data/sound/hanoi/cs/v-jineho.ogg", "start": 1050529, "end": 1131393, "audio": 1}, {"filename": "/data/sound/hanoi/cs/v-kopie.ogg", "start": 1131393, "end": 1230944, "audio": 1}, {"filename": "/data/sound/hanoi/cs/v-looser.ogg", "start": 1230944, "end": 1308432, "audio": 1}, {"filename": "/data/sound/hanoi/cs/v-mamja.ogg", "start": 1308432, "end": 1332188, "audio": 1}, {"filename": "/data/sound/hanoi/cs/v-nenifer.ogg", "start": 1332188, "end": 1427482, "audio": 1}, {"filename": "/data/sound/hanoi/cs/v-orechove.ogg", "start": 1427482, "end": 1464346, "audio": 1}, {"filename": "/data/sound/hanoi/cs/v-plny.ogg", "start": 1464346, "end": 1554505, "audio": 1}, {"filename": "/data/sound/hanoi/cs/v-pochvalil.ogg", "start": 1554505, "end": 1634258, "audio": 1}, {"filename": "/data/sound/hanoi/cs/v-restartovat.ogg", "start": 1634258, "end": 1779559, "audio": 1}, {"filename": "/data/sound/hanoi/cs/v-tady.ogg", "start": 1779559, "end": 1805143, "audio": 1}, {"filename": "/data/sound/hanoi/nl/m-bude.ogg", "start": 1805143, "end": 1822710, "audio": 1}, {"filename": "/data/sound/hanoi/nl/m-citovat.ogg", "start": 1822710, "end": 1844310, "audio": 1}, {"filename": "/data/sound/hanoi/nl/m-co.ogg", "start": 1844310, "end": 1859408, "audio": 1}, {"filename": "/data/sound/hanoi/nl/m-hazet.ogg", "start": 1859408, "end": 1885015, "audio": 1}, {"filename": "/data/sound/hanoi/nl/m-inspiroval.ogg", "start": 1885015, "end": 1915323, "audio": 1}, {"filename": "/data/sound/hanoi/nl/m-nepomahas.ogg", "start": 1915323, "end": 1939658, "audio": 1}, {"filename": "/data/sound/hanoi/nl/m-predstavujes.ogg", "start": 1939658, "end": 1985764, "audio": 1}, {"filename": "/data/sound/hanoi/nl/m-rekurzivni.ogg", "start": 1985764, "end": 2019947, "audio": 1}, {"filename": "/data/sound/hanoi/nl/m-restartuj.ogg", "start": 2019947, "end": 2051539, "audio": 1}, {"filename": "/data/sound/hanoi/nl/m-tesise.ogg", "start": 2051539, "end": 2076136, "audio": 1}, {"filename": "/data/sound/hanoi/nl/m-trikrat.ogg", "start": 2076136, "end": 2096116, "audio": 1}, {"filename": "/data/sound/hanoi/nl/m-vicedat.ogg", "start": 2096116, "end": 2121363, "audio": 1}, {"filename": "/data/sound/hanoi/nl/m-vyhecoval.ogg", "start": 2121363, "end": 2142189, "audio": 1}, {"filename": "/data/sound/hanoi/nl/v-alehrac.ogg", "start": 2142189, "end": 2160997, "audio": 1}, {"filename": "/data/sound/hanoi/nl/v-bavit.ogg", "start": 2160997, "end": 2183434, "audio": 1}, {"filename": "/data/sound/hanoi/nl/v-budou.ogg", "start": 2183434, "end": 2204980, "audio": 1}, {"filename": "/data/sound/hanoi/nl/v-jacity.ogg", "start": 2204980, "end": 2222975, "audio": 1}, {"filename": "/data/sound/hanoi/nl/v-jineho.ogg", "start": 2222975, "end": 2260243, "audio": 1}, {"filename": "/data/sound/hanoi/nl/v-kopie.ogg", "start": 2260243, "end": 2294977, "audio": 1}, {"filename": "/data/sound/hanoi/nl/v-looser.ogg", "start": 2294977, "end": 2328627, "audio": 1}, {"filename": "/data/sound/hanoi/nl/v-mamja.ogg", "start": 2328627, "end": 2345115, "audio": 1}, {"filename": "/data/sound/hanoi/nl/v-nenifer.ogg", "start": 2345115, "end": 2383993, "audio": 1}, {"filename": "/data/sound/hanoi/nl/v-orechove.ogg", "start": 2383993, "end": 2407640, "audio": 1}, {"filename": "/data/sound/hanoi/nl/v-plny.ogg", "start": 2407640, "end": 2437064, "audio": 1}, {"filename": "/data/sound/hanoi/nl/v-pochvalil.ogg", "start": 2437064, "end": 2470099, "audio": 1}, {"filename": "/data/sound/hanoi/nl/v-restartovat.ogg", "start": 2470099, "end": 2518380, "audio": 1}, {"filename": "/data/sound/hanoi/nl/v-tady.ogg", "start": 2518380, "end": 2535734, "audio": 1}], "remote_package_size": 2535734, "package_uuid": "2e6a4350-9adb-4adc-bbf7-e35f0dfb0280"});

})();
