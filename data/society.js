
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
    var PACKAGE_NAME = 'web/data/society.data';
    var REMOTE_PACKAGE_BASE = 'data/society.data';
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
Module['FS_createPath']('/data/images', 'society', true, true);
Module['FS_createPath']('/data', 'script', true, true);
Module['FS_createPath']('/data/script', 'society', true, true);
Module['FS_createPath']('/data', 'sound', true, true);
Module['FS_createPath']('/data/sound', 'society', true, true);
Module['FS_createPath']('/data/sound/society', 'cs', true, true);
Module['FS_createPath']('/data/sound/society', 'en', true, true);
Module['FS_createPath']('/data/sound/society', 'nl', true, true);

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
              Module['removeRunDependency']('datafile_web/data/society.data');

    };
    Module['addRunDependency']('datafile_web/data/society.data');
  
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
 loadPackage({"files": [{"filename": "/data/images/society/konik_00.png", "start": 0, "end": 981, "audio": 0}, {"filename": "/data/images/society/konik_01.png", "start": 981, "end": 1934, "audio": 0}, {"filename": "/data/images/society/konik_02.png", "start": 1934, "end": 2905, "audio": 0}, {"filename": "/data/images/society/konik_03.png", "start": 2905, "end": 3907, "audio": 0}, {"filename": "/data/images/society/maly_snek_00.png", "start": 3907, "end": 4581, "audio": 0}, {"filename": "/data/images/society/maly_snek_01.png", "start": 4581, "end": 5278, "audio": 0}, {"filename": "/data/images/society/maly_snek_02.png", "start": 5278, "end": 5995, "audio": 0}, {"filename": "/data/images/society/maly_snek_03.png", "start": 5995, "end": 6655, "audio": 0}, {"filename": "/data/images/society/mikro-3-tmp.png", "start": 6655, "end": 7522, "audio": 0}, {"filename": "/data/images/society/mikro-4-tmp.png", "start": 7522, "end": 8389, "audio": 0}, {"filename": "/data/images/society/mikro-p.png", "start": 8389, "end": 96480, "audio": 0}, {"filename": "/data/images/society/mikro-w.png", "start": 96480, "end": 187051, "audio": 0}, {"filename": "/data/images/society/poustevnicek_b_00.png", "start": 187051, "end": 189694, "audio": 0}, {"filename": "/data/images/society/poustevnicek_b_01.png", "start": 189694, "end": 192349, "audio": 0}, {"filename": "/data/images/society/poustevnicek_b_02.png", "start": 192349, "end": 194950, "audio": 0}, {"filename": "/data/images/society/poustevnicek_b_03.png", "start": 194950, "end": 197559, "audio": 0}, {"filename": "/data/images/society/poustevnicek_f_00.png", "start": 197559, "end": 200166, "audio": 0}, {"filename": "/data/images/society/poustevnicek_f_01.png", "start": 200166, "end": 202780, "audio": 0}, {"filename": "/data/images/society/poustevnicek_f_02.png", "start": 202780, "end": 205343, "audio": 0}, {"filename": "/data/images/society/poustevnicek_f_03.png", "start": 205343, "end": 207915, "audio": 0}, {"filename": "/data/images/society/poustevnicek_m_00.png", "start": 207915, "end": 210514, "audio": 0}, {"filename": "/data/images/society/poustevnicek_m_01.png", "start": 210514, "end": 213123, "audio": 0}, {"filename": "/data/images/society/poustevnicek_m_02.png", "start": 213123, "end": 215680, "audio": 0}, {"filename": "/data/images/society/poustevnicek_m_03.png", "start": 215680, "end": 218249, "audio": 0}, {"filename": "/data/images/society/poustevnicek_z_00.png", "start": 218249, "end": 220897, "audio": 0}, {"filename": "/data/images/society/poustevnicek_z_01.png", "start": 220897, "end": 223549, "audio": 0}, {"filename": "/data/images/society/poustevnicek_z_02.png", "start": 223549, "end": 226153, "audio": 0}, {"filename": "/data/images/society/poustevnicek_z_03.png", "start": 226153, "end": 228763, "audio": 0}, {"filename": "/data/images/society/rybicka_h_00.png", "start": 228763, "end": 229909, "audio": 0}, {"filename": "/data/images/society/rybicka_h_01.png", "start": 229909, "end": 231069, "audio": 0}, {"filename": "/data/images/society/rybicka_h_02.png", "start": 231069, "end": 232220, "audio": 0}, {"filename": "/data/images/society/rybicka_h_03.png", "start": 232220, "end": 233346, "audio": 0}, {"filename": "/data/images/society/sepijka_00.png", "start": 233346, "end": 235526, "audio": 0}, {"filename": "/data/images/society/sepijka_01.png", "start": 235526, "end": 237637, "audio": 0}, {"filename": "/data/images/society/sepijka_02.png", "start": 237637, "end": 239869, "audio": 0}, {"filename": "/data/images/society/sepijka_03.png", "start": 239869, "end": 242039, "audio": 0}, {"filename": "/data/images/society/sepijka_04.png", "start": 242039, "end": 244141, "audio": 0}, {"filename": "/data/images/society/sepijka_05.png", "start": 244141, "end": 246358, "audio": 0}, {"filename": "/data/script/society/code.lua", "start": 246358, "end": 262766, "audio": 0}, {"filename": "/data/script/society/dialogs_bg.lua", "start": 262766, "end": 264930, "audio": 0}, {"filename": "/data/script/society/dialogs_cs.lua", "start": 264930, "end": 266602, "audio": 0}, {"filename": "/data/script/society/dialogs_de_CH.lua", "start": 266602, "end": 266746, "audio": 0}, {"filename": "/data/script/society/dialogs_de.lua", "start": 266746, "end": 268482, "audio": 0}, {"filename": "/data/script/society/dialogs_en.lua", "start": 268482, "end": 269667, "audio": 0}, {"filename": "/data/script/society/dialogs_es.lua", "start": 269667, "end": 271406, "audio": 0}, {"filename": "/data/script/society/dialogs_fr.lua", "start": 271406, "end": 273139, "audio": 0}, {"filename": "/data/script/society/dialogs_it.lua", "start": 273139, "end": 274858, "audio": 0}, {"filename": "/data/script/society/dialogs.lua", "start": 274858, "end": 274896, "audio": 0}, {"filename": "/data/script/society/dialogs_nl.lua", "start": 274896, "end": 276614, "audio": 0}, {"filename": "/data/script/society/dialogs_pl.lua", "start": 276614, "end": 278313, "audio": 0}, {"filename": "/data/script/society/dialogs_ru.lua", "start": 278313, "end": 280453, "audio": 0}, {"filename": "/data/script/society/dialogs_sv.lua", "start": 280453, "end": 282188, "audio": 0}, {"filename": "/data/script/society/init.lua", "start": 282188, "end": 282834, "audio": 0}, {"filename": "/data/script/society/models.lua", "start": 282834, "end": 285023, "audio": 0}, {"filename": "/data/sound/society/cs/mik-m-konik.ogg", "start": 285023, "end": 301946, "audio": 1}, {"filename": "/data/sound/society/cs/mik-m-krab.ogg", "start": 301946, "end": 318007, "audio": 1}, {"filename": "/data/sound/society/cs/mik-m-myslit.ogg", "start": 318007, "end": 338794, "audio": 1}, {"filename": "/data/sound/society/cs/mik-m-nezlob.ogg", "start": 338794, "end": 352296, "audio": 1}, {"filename": "/data/sound/society/cs/mik-m-poust.ogg", "start": 352296, "end": 369435, "audio": 1}, {"filename": "/data/sound/society/cs/mik-m-proc.ogg", "start": 369435, "end": 394429, "audio": 1}, {"filename": "/data/sound/society/cs/mik-m-tusit.ogg", "start": 394429, "end": 424886, "audio": 1}, {"filename": "/data/sound/society/cs/mik-v-projet.ogg", "start": 424886, "end": 436546, "audio": 1}, {"filename": "/data/sound/society/cs/mik-v-proto.ogg", "start": 436546, "end": 446654, "audio": 1}, {"filename": "/data/sound/society/cs/mik-v-sakra.ogg", "start": 446654, "end": 470487, "audio": 1}, {"filename": "/data/sound/society/cs/mik-v-tak.ogg", "start": 470487, "end": 478836, "audio": 1}, {"filename": "/data/sound/society/cs/mik-v-ticho0.ogg", "start": 478836, "end": 492316, "audio": 1}, {"filename": "/data/sound/society/cs/mik-v-ticho1.ogg", "start": 492316, "end": 503770, "audio": 1}, {"filename": "/data/sound/society/cs/mik-v-ticho2.ogg", "start": 503770, "end": 517797, "audio": 1}, {"filename": "/data/sound/society/cs/mik-v-videt.ogg", "start": 517797, "end": 533300, "audio": 1}, {"filename": "/data/sound/society/en/mik-x-stebet0.ogg", "start": 533300, "end": 566728, "audio": 1}, {"filename": "/data/sound/society/en/mik-x-stebet1.ogg", "start": 566728, "end": 615551, "audio": 1}, {"filename": "/data/sound/society/en/mik-x-stebet2.ogg", "start": 615551, "end": 679042, "audio": 1}, {"filename": "/data/sound/society/en/mik-x-stebet3.ogg", "start": 679042, "end": 707103, "audio": 1}, {"filename": "/data/sound/society/nl/mik-m-konik.ogg", "start": 707103, "end": 727446, "audio": 1}, {"filename": "/data/sound/society/nl/mik-m-krab.ogg", "start": 727446, "end": 748806, "audio": 1}, {"filename": "/data/sound/society/nl/mik-m-myslit.ogg", "start": 748806, "end": 773338, "audio": 1}, {"filename": "/data/sound/society/nl/mik-m-nezlob.ogg", "start": 773338, "end": 790136, "audio": 1}, {"filename": "/data/sound/society/nl/mik-m-poust.ogg", "start": 790136, "end": 813539, "audio": 1}, {"filename": "/data/sound/society/nl/mik-m-proc.ogg", "start": 813539, "end": 837038, "audio": 1}, {"filename": "/data/sound/society/nl/mik-m-tusit.ogg", "start": 837038, "end": 861478, "audio": 1}, {"filename": "/data/sound/society/nl/mik-v-projet.ogg", "start": 861478, "end": 881558, "audio": 1}, {"filename": "/data/sound/society/nl/mik-v-proto.ogg", "start": 881558, "end": 897843, "audio": 1}, {"filename": "/data/sound/society/nl/mik-v-sakra.ogg", "start": 897843, "end": 922026, "audio": 1}, {"filename": "/data/sound/society/nl/mik-v-tak.ogg", "start": 922026, "end": 933783, "audio": 1}, {"filename": "/data/sound/society/nl/mik-v-ticho0.ogg", "start": 933783, "end": 950505, "audio": 1}, {"filename": "/data/sound/society/nl/mik-v-ticho1.ogg", "start": 950505, "end": 964816, "audio": 1}, {"filename": "/data/sound/society/nl/mik-v-ticho2.ogg", "start": 964816, "end": 982938, "audio": 1}, {"filename": "/data/sound/society/nl/mik-v-videt.ogg", "start": 982938, "end": 1002555, "audio": 1}], "remote_package_size": 1002555, "package_uuid": "f1768ee7-7764-4f99-a584-5856d6ecd892"});

})();
