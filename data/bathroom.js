
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
    var PACKAGE_NAME = 'web/data/bathroom.data';
    var REMOTE_PACKAGE_BASE = 'data/bathroom.data';
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
Module['FS_createPath']('/data/images', 'bathroom', true, true);
Module['FS_createPath']('/data', 'script', true, true);
Module['FS_createPath']('/data/script', 'bathroom', true, true);
Module['FS_createPath']('/data', 'sound', true, true);
Module['FS_createPath']('/data/sound', 'bathroom', true, true);
Module['FS_createPath']('/data/sound/bathroom', 'cs', true, true);
Module['FS_createPath']('/data/sound/bathroom', 'en', true, true);
Module['FS_createPath']('/data/sound/bathroom', 'nl', true, true);

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
              Module['removeRunDependency']('datafile_web/data/bathroom.data');

    };
    Module['addRunDependency']('datafile_web/data/bathroom.data');
  
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
 loadPackage({"files": [{"filename": "/data/images/bathroom/20-ocel.png", "start": 0, "end": 696, "audio": 0}, {"filename": "/data/images/bathroom/balonek1.png", "start": 696, "end": 1233, "audio": 0}, {"filename": "/data/images/bathroom/balonek2.png", "start": 1233, "end": 1770, "audio": 0}, {"filename": "/data/images/bathroom/bathroom-p.png", "start": 1770, "end": 93750, "audio": 0}, {"filename": "/data/images/bathroom/bathroom-zed.png", "start": 93750, "end": 220400, "audio": 0}, {"filename": "/data/images/bathroom/bedna.png", "start": 220400, "end": 223687, "audio": 0}, {"filename": "/data/images/bathroom/bota.png", "start": 223687, "end": 224881, "audio": 0}, {"filename": "/data/images/bathroom/botka.png", "start": 224881, "end": 226073, "audio": 0}, {"filename": "/data/images/bathroom/hajzlak.png", "start": 226073, "end": 226767, "audio": 0}, {"filename": "/data/images/bathroom/hajzl.png", "start": 226767, "end": 230293, "audio": 0}, {"filename": "/data/images/bathroom/kartac.png", "start": 230293, "end": 234158, "audio": 0}, {"filename": "/data/images/bathroom/klobouk.png", "start": 234158, "end": 236048, "audio": 0}, {"filename": "/data/images/bathroom/kos.png", "start": 236048, "end": 239646, "audio": 0}, {"filename": "/data/images/bathroom/koulea.png", "start": 239646, "end": 240279, "audio": 0}, {"filename": "/data/images/bathroom/kufr.png", "start": 240279, "end": 243297, "audio": 0}, {"filename": "/data/images/bathroom/kvetinac.png", "start": 243297, "end": 245571, "audio": 0}, {"filename": "/data/images/bathroom/musla.png", "start": 245571, "end": 246876, "audio": 0}, {"filename": "/data/images/bathroom/ploutve.png", "start": 246876, "end": 250172, "audio": 0}, {"filename": "/data/images/bathroom/pracka_00.png", "start": 250172, "end": 256612, "audio": 0}, {"filename": "/data/images/bathroom/pracka_01.png", "start": 256612, "end": 262985, "audio": 0}, {"filename": "/data/images/bathroom/pracka_02.png", "start": 262985, "end": 269404, "audio": 0}, {"filename": "/data/images/bathroom/pracka_03.png", "start": 269404, "end": 275758, "audio": 0}, {"filename": "/data/images/bathroom/pracka_04.png", "start": 275758, "end": 282318, "audio": 0}, {"filename": "/data/images/bathroom/pracka_05.png", "start": 282318, "end": 288875, "audio": 0}, {"filename": "/data/images/bathroom/pracka_06.png", "start": 288875, "end": 295443, "audio": 0}, {"filename": "/data/images/bathroom/pracka_07.png", "start": 295443, "end": 302004, "audio": 0}, {"filename": "/data/images/bathroom/pracka_08.png", "start": 302004, "end": 308589, "audio": 0}, {"filename": "/data/images/bathroom/pracka_09.png", "start": 308589, "end": 315166, "audio": 0}, {"filename": "/data/images/bathroom/radio.png", "start": 315166, "end": 318407, "audio": 0}, {"filename": "/data/images/bathroom/sapon.png", "start": 318407, "end": 319410, "audio": 0}, {"filename": "/data/images/bathroom/shell1.png", "start": 319410, "end": 320141, "audio": 0}, {"filename": "/data/images/bathroom/sprcha.png", "start": 320141, "end": 328366, "audio": 0}, {"filename": "/data/images/bathroom/zidle.png", "start": 328366, "end": 331168, "audio": 0}, {"filename": "/data/script/bathroom/code.lua", "start": 331168, "end": 337857, "audio": 0}, {"filename": "/data/script/bathroom/dialogs_bg.lua", "start": 337857, "end": 341153, "audio": 0}, {"filename": "/data/script/bathroom/dialogs_cs.lua", "start": 341153, "end": 343945, "audio": 0}, {"filename": "/data/script/bathroom/dialogs_de_CH.lua", "start": 343945, "end": 344208, "audio": 0}, {"filename": "/data/script/bathroom/dialogs_de.lua", "start": 344208, "end": 347026, "audio": 0}, {"filename": "/data/script/bathroom/dialogs_en.lua", "start": 347026, "end": 348764, "audio": 0}, {"filename": "/data/script/bathroom/dialogs_eo.lua", "start": 348764, "end": 351468, "audio": 0}, {"filename": "/data/script/bathroom/dialogs_es.lua", "start": 351468, "end": 354245, "audio": 0}, {"filename": "/data/script/bathroom/dialogs_fr.lua", "start": 354245, "end": 357134, "audio": 0}, {"filename": "/data/script/bathroom/dialogs_it.lua", "start": 357134, "end": 359888, "audio": 0}, {"filename": "/data/script/bathroom/dialogs.lua", "start": 359888, "end": 359926, "audio": 0}, {"filename": "/data/script/bathroom/dialogs_nl.lua", "start": 359926, "end": 362774, "audio": 0}, {"filename": "/data/script/bathroom/dialogs_pl.lua", "start": 362774, "end": 365568, "audio": 0}, {"filename": "/data/script/bathroom/dialogs_ru.lua", "start": 365568, "end": 369006, "audio": 0}, {"filename": "/data/script/bathroom/dialogs_sv.lua", "start": 369006, "end": 371759, "audio": 0}, {"filename": "/data/script/bathroom/init.lua", "start": 371759, "end": 372406, "audio": 0}, {"filename": "/data/script/bathroom/models.lua", "start": 372406, "end": 376998, "audio": 0}, {"filename": "/data/sound/bathroom/cs/br-m-ahoj.ogg", "start": 376998, "end": 394494, "audio": 1}, {"filename": "/data/sound/bathroom/cs/br-m-bavi.ogg", "start": 394494, "end": 413067, "audio": 1}, {"filename": "/data/sound/bathroom/cs/br-m-bydli.ogg", "start": 413067, "end": 428079, "audio": 1}, {"filename": "/data/sound/bathroom/cs/br-m-dva.ogg", "start": 428079, "end": 440480, "audio": 1}, {"filename": "/data/sound/bathroom/cs/br-m-nefunguje.ogg", "start": 440480, "end": 454511, "audio": 1}, {"filename": "/data/sound/bathroom/cs/br-m-podvodnik.ogg", "start": 454511, "end": 470305, "audio": 1}, {"filename": "/data/sound/bathroom/cs/br-m-poklady.ogg", "start": 470305, "end": 484880, "audio": 1}, {"filename": "/data/sound/bathroom/cs/br-m-sprcha.ogg", "start": 484880, "end": 514060, "audio": 1}, {"filename": "/data/sound/bathroom/cs/br-m-vsim0.ogg", "start": 514060, "end": 524969, "audio": 1}, {"filename": "/data/sound/bathroom/cs/br-m-vsim1.ogg", "start": 524969, "end": 541306, "audio": 1}, {"filename": "/data/sound/bathroom/cs/br-m-vsim2.ogg", "start": 541306, "end": 557548, "audio": 1}, {"filename": "/data/sound/bathroom/cs/br-m-zapnout.ogg", "start": 557548, "end": 573903, "audio": 1}, {"filename": "/data/sound/bathroom/cs/br-m-zkusit.ogg", "start": 573903, "end": 589044, "audio": 1}, {"filename": "/data/sound/bathroom/cs/br-v-dost.ogg", "start": 589044, "end": 602239, "audio": 1}, {"filename": "/data/sound/bathroom/cs/br-v-draha.ogg", "start": 602239, "end": 621864, "audio": 1}, {"filename": "/data/sound/bathroom/cs/br-v-komfort.ogg", "start": 621864, "end": 643799, "audio": 1}, {"filename": "/data/sound/bathroom/cs/br-v-lazen.ogg", "start": 643799, "end": 667885, "audio": 1}, {"filename": "/data/sound/bathroom/cs/br-v-nechat.ogg", "start": 667885, "end": 685512, "audio": 1}, {"filename": "/data/sound/bathroom/cs/br-v-nerozvadet0.ogg", "start": 685512, "end": 698805, "audio": 1}, {"filename": "/data/sound/bathroom/cs/br-v-nerozvadet1.ogg", "start": 698805, "end": 716709, "audio": 1}, {"filename": "/data/sound/bathroom/cs/br-v-nerozvadet2.ogg", "start": 716709, "end": 737892, "audio": 1}, {"filename": "/data/sound/bathroom/cs/br-v-santusak.ogg", "start": 737892, "end": 754282, "audio": 1}, {"filename": "/data/sound/bathroom/cs/br-v-shodit.ogg", "start": 754282, "end": 772153, "audio": 1}, {"filename": "/data/sound/bathroom/en/br-x-pracka.ogg", "start": 772153, "end": 791591, "audio": 1}, {"filename": "/data/sound/bathroom/nl/br-m-ahoj.ogg", "start": 791591, "end": 809500, "audio": 1}, {"filename": "/data/sound/bathroom/nl/br-m-bavi.ogg", "start": 809500, "end": 830553, "audio": 1}, {"filename": "/data/sound/bathroom/nl/br-m-bydli.ogg", "start": 830553, "end": 849013, "audio": 1}, {"filename": "/data/sound/bathroom/nl/br-m-dva.ogg", "start": 849013, "end": 868259, "audio": 1}, {"filename": "/data/sound/bathroom/nl/br-m-nefunguje.ogg", "start": 868259, "end": 885302, "audio": 1}, {"filename": "/data/sound/bathroom/nl/br-m-podvodnik.ogg", "start": 885302, "end": 909069, "audio": 1}, {"filename": "/data/sound/bathroom/nl/br-m-poklady.ogg", "start": 909069, "end": 927217, "audio": 1}, {"filename": "/data/sound/bathroom/nl/br-m-sprcha.ogg", "start": 927217, "end": 955894, "audio": 1}, {"filename": "/data/sound/bathroom/nl/br-m-vsim0.ogg", "start": 955894, "end": 972528, "audio": 1}, {"filename": "/data/sound/bathroom/nl/br-m-vsim1.ogg", "start": 972528, "end": 989778, "audio": 1}, {"filename": "/data/sound/bathroom/nl/br-m-vsim2.ogg", "start": 989778, "end": 1007027, "audio": 1}, {"filename": "/data/sound/bathroom/nl/br-m-zapnout.ogg", "start": 1007027, "end": 1027155, "audio": 1}, {"filename": "/data/sound/bathroom/nl/br-m-zkusit.ogg", "start": 1027155, "end": 1051865, "audio": 1}, {"filename": "/data/sound/bathroom/nl/br-v-dost.ogg", "start": 1051865, "end": 1069274, "audio": 1}, {"filename": "/data/sound/bathroom/nl/br-v-draha.ogg", "start": 1069274, "end": 1090665, "audio": 1}, {"filename": "/data/sound/bathroom/nl/br-v-komfort.ogg", "start": 1090665, "end": 1112770, "audio": 1}, {"filename": "/data/sound/bathroom/nl/br-v-lazen.ogg", "start": 1112770, "end": 1138210, "audio": 1}, {"filename": "/data/sound/bathroom/nl/br-v-nechat.ogg", "start": 1138210, "end": 1158799, "audio": 1}, {"filename": "/data/sound/bathroom/nl/br-v-nerozvadet0.ogg", "start": 1158799, "end": 1174365, "audio": 1}, {"filename": "/data/sound/bathroom/nl/br-v-nerozvadet1.ogg", "start": 1174365, "end": 1201596, "audio": 1}, {"filename": "/data/sound/bathroom/nl/br-v-nerozvadet2.ogg", "start": 1201596, "end": 1223662, "audio": 1}, {"filename": "/data/sound/bathroom/nl/br-v-santusak.ogg", "start": 1223662, "end": 1242542, "audio": 1}, {"filename": "/data/sound/bathroom/nl/br-v-shodit.ogg", "start": 1242542, "end": 1269634, "audio": 1}], "remote_package_size": 1269634, "package_uuid": "dbdca65e-4b6c-463c-a687-430ae0180747"});

})();
