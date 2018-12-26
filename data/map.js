
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
    var PACKAGE_NAME = 'web/data/map.data';
    var REMOTE_PACKAGE_BASE = 'data/map.data';
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
Module['FS_createPath']('/data/images', 'map', true, true);
Module['FS_createPath']('/data', 'script', true, true);
Module['FS_createPath']('/data/script', 'map', true, true);
Module['FS_createPath']('/data', 'sound', true, true);
Module['FS_createPath']('/data/sound', 'map', true, true);
Module['FS_createPath']('/data/sound/map', 'cs', true, true);
Module['FS_createPath']('/data/sound/map', 'nl', true, true);

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
              Module['removeRunDependency']('datafile_web/data/map.data');

    };
    Module['addRunDependency']('datafile_web/data/map.data');
  
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
 loadPackage({"files": [{"filename": "/data/images/map/19-ocel.png", "start": 0, "end": 696, "audio": 0}, {"filename": "/data/images/map/3-ocel.png", "start": 696, "end": 2750, "audio": 0}, {"filename": "/data/images/map/klobouk.png", "start": 2750, "end": 7736, "audio": 0}, {"filename": "/data/images/map/kouleb.png", "start": 7736, "end": 8358, "audio": 0}, {"filename": "/data/images/map/koulec.png", "start": 8358, "end": 9025, "audio": 0}, {"filename": "/data/images/map/kouled.png", "start": 9025, "end": 9671, "audio": 0}, {"filename": "/data/images/map/krystal_c_00.png", "start": 9671, "end": 10285, "audio": 0}, {"filename": "/data/images/map/krystal_c_01.png", "start": 10285, "end": 10895, "audio": 0}, {"filename": "/data/images/map/krystal_c_02.png", "start": 10895, "end": 11491, "audio": 0}, {"filename": "/data/images/map/krystal_c_03.png", "start": 11491, "end": 12073, "audio": 0}, {"filename": "/data/images/map/krystal_m_00.png", "start": 12073, "end": 12711, "audio": 0}, {"filename": "/data/images/map/krystal_m_01.png", "start": 12711, "end": 13348, "audio": 0}, {"filename": "/data/images/map/krystal_m_02.png", "start": 13348, "end": 13966, "audio": 0}, {"filename": "/data/images/map/krystal_m_03.png", "start": 13966, "end": 14567, "audio": 0}, {"filename": "/data/images/map/maly_snek_00.png", "start": 14567, "end": 15187, "audio": 0}, {"filename": "/data/images/map/malysnek_00.png", "start": 15187, "end": 15861, "audio": 0}, {"filename": "/data/images/map/maly_snek_01.png", "start": 15861, "end": 16522, "audio": 0}, {"filename": "/data/images/map/malysnek_01.png", "start": 16522, "end": 17198, "audio": 0}, {"filename": "/data/images/map/maly_snek_02.png", "start": 17198, "end": 17888, "audio": 0}, {"filename": "/data/images/map/malysnek_02.png", "start": 17888, "end": 18584, "audio": 0}, {"filename": "/data/images/map/maly_snek_03.png", "start": 18584, "end": 19197, "audio": 0}, {"filename": "/data/images/map/malysnek_03.png", "start": 19197, "end": 19836, "audio": 0}, {"filename": "/data/images/map/mapa-b.png", "start": 19836, "end": 35388, "audio": 0}, {"filename": "/data/images/map/mapa-okoli.png", "start": 35388, "end": 220783, "audio": 0}, {"filename": "/data/images/map/mapa-p.png", "start": 220783, "end": 320107, "audio": 0}, {"filename": "/data/images/map/oko_00.png", "start": 320107, "end": 320823, "audio": 0}, {"filename": "/data/images/map/oko_01.png", "start": 320823, "end": 321493, "audio": 0}, {"filename": "/data/images/map/oko_02.png", "start": 321493, "end": 322160, "audio": 0}, {"filename": "/data/images/map/oko_03.png", "start": 322160, "end": 322808, "audio": 0}, {"filename": "/data/images/map/oko_04.png", "start": 322808, "end": 323524, "audio": 0}, {"filename": "/data/images/map/pistole.png", "start": 323524, "end": 328110, "audio": 0}, {"filename": "/data/images/map/poster.png", "start": 328110, "end": 491165, "audio": 0}, {"filename": "/data/images/map/stolekm.png", "start": 491165, "end": 493145, "audio": 0}, {"filename": "/data/script/map/code.lua", "start": 493145, "end": 501040, "audio": 0}, {"filename": "/data/script/map/demo_dialogs_bg.lua", "start": 501040, "end": 502124, "audio": 0}, {"filename": "/data/script/map/demo_dialogs_cs.lua", "start": 502124, "end": 502568, "audio": 0}, {"filename": "/data/script/map/demo_dialogs_de.lua", "start": 502568, "end": 503410, "audio": 0}, {"filename": "/data/script/map/demo_dialogs_en.lua", "start": 503410, "end": 503839, "audio": 0}, {"filename": "/data/script/map/demo_dialogs_es.lua", "start": 503839, "end": 504705, "audio": 0}, {"filename": "/data/script/map/demo_dialogs_fr.lua", "start": 504705, "end": 505588, "audio": 0}, {"filename": "/data/script/map/demo_dialogs_it.lua", "start": 505588, "end": 506407, "audio": 0}, {"filename": "/data/script/map/demo_dialogs_nl.lua", "start": 506407, "end": 507218, "audio": 0}, {"filename": "/data/script/map/demo_dialogs_pl.lua", "start": 507218, "end": 508023, "audio": 0}, {"filename": "/data/script/map/demo_dialogs_ru.lua", "start": 508023, "end": 509157, "audio": 0}, {"filename": "/data/script/map/demo_dialogs_sv.lua", "start": 509157, "end": 509939, "audio": 0}, {"filename": "/data/script/map/demo_poster.lua", "start": 509939, "end": 510252, "audio": 0}, {"filename": "/data/script/map/dialogs_bg.lua", "start": 510252, "end": 513428, "audio": 0}, {"filename": "/data/script/map/dialogs_cs.lua", "start": 513428, "end": 515989, "audio": 0}, {"filename": "/data/script/map/dialogs_de.lua", "start": 515989, "end": 518600, "audio": 0}, {"filename": "/data/script/map/dialogs_en.lua", "start": 518600, "end": 520119, "audio": 0}, {"filename": "/data/script/map/dialogs_es.lua", "start": 520119, "end": 522747, "audio": 0}, {"filename": "/data/script/map/dialogs_fr.lua", "start": 522747, "end": 525497, "audio": 0}, {"filename": "/data/script/map/dialogs_it.lua", "start": 525497, "end": 528123, "audio": 0}, {"filename": "/data/script/map/dialogs.lua", "start": 528123, "end": 528161, "audio": 0}, {"filename": "/data/script/map/dialogs_nl.lua", "start": 528161, "end": 530728, "audio": 0}, {"filename": "/data/script/map/dialogs_pl.lua", "start": 530728, "end": 533251, "audio": 0}, {"filename": "/data/script/map/dialogs_ru.lua", "start": 533251, "end": 536416, "audio": 0}, {"filename": "/data/script/map/dialogs_sv.lua", "start": 536416, "end": 538974, "audio": 0}, {"filename": "/data/script/map/init.lua", "start": 538974, "end": 539616, "audio": 0}, {"filename": "/data/script/map/models.lua", "start": 539616, "end": 544797, "audio": 0}, {"filename": "/data/sound/map/cs/map-m-mapa.ogg", "start": 544797, "end": 565619, "audio": 1}, {"filename": "/data/sound/map/cs/map-m-neplacej.ogg", "start": 565619, "end": 588327, "audio": 1}, {"filename": "/data/sound/map/cs/map-m-pohnout.ogg", "start": 588327, "end": 604673, "audio": 1}, {"filename": "/data/sound/map/cs/map-m-pravidla.ogg", "start": 604673, "end": 632913, "audio": 1}, {"filename": "/data/sound/map/cs/map-m-sneci.ogg", "start": 632913, "end": 647776, "audio": 1}, {"filename": "/data/sound/map/cs/map-m-ukol.ogg", "start": 647776, "end": 670487, "audio": 1}, {"filename": "/data/sound/map/cs/map-m-uvidime.ogg", "start": 670487, "end": 693982, "audio": 1}, {"filename": "/data/sound/map/cs/map-m-uz.ogg", "start": 693982, "end": 706321, "audio": 1}, {"filename": "/data/sound/map/cs/map-v-cojetam.ogg", "start": 706321, "end": 721400, "audio": 1}, {"filename": "/data/sound/map/cs/map-v-dal.ogg", "start": 721400, "end": 735618, "audio": 1}, {"filename": "/data/sound/map/cs/map-v-jasne.ogg", "start": 735618, "end": 764987, "audio": 1}, {"filename": "/data/sound/map/cs/map-v-mapa.ogg", "start": 764987, "end": 793369, "audio": 1}, {"filename": "/data/sound/map/cs/map-v-oci.ogg", "start": 793369, "end": 811372, "audio": 1}, {"filename": "/data/sound/map/cs/map-v-poklady.ogg", "start": 811372, "end": 833759, "audio": 1}, {"filename": "/data/sound/map/cs/map-v-restart.ogg", "start": 833759, "end": 879385, "audio": 1}, {"filename": "/data/sound/map/cs/map-v-ukol.ogg", "start": 879385, "end": 899239, "audio": 1}, {"filename": "/data/sound/map/cs/map-x-hlemyzdi.ogg", "start": 899239, "end": 922068, "audio": 1}, {"filename": "/data/sound/map/nl/map-m-mapa.ogg", "start": 922068, "end": 938697, "audio": 1}, {"filename": "/data/sound/map/nl/map-m-neplacej.ogg", "start": 938697, "end": 963266, "audio": 1}, {"filename": "/data/sound/map/nl/map-m-pohnout.ogg", "start": 963266, "end": 979999, "audio": 1}, {"filename": "/data/sound/map/nl/map-m-pravidla.ogg", "start": 979999, "end": 1012115, "audio": 1}, {"filename": "/data/sound/map/nl/map-m-sneci.ogg", "start": 1012115, "end": 1034808, "audio": 1}, {"filename": "/data/sound/map/nl/map-m-ukol.ogg", "start": 1034808, "end": 1065756, "audio": 1}, {"filename": "/data/sound/map/nl/map-m-uvidime.ogg", "start": 1065756, "end": 1092683, "audio": 1}, {"filename": "/data/sound/map/nl/map-m-uz.ogg", "start": 1092683, "end": 1111715, "audio": 1}, {"filename": "/data/sound/map/nl/map-v-cojetam.ogg", "start": 1111715, "end": 1131234, "audio": 1}, {"filename": "/data/sound/map/nl/map-v-dal.ogg", "start": 1131234, "end": 1147927, "audio": 1}, {"filename": "/data/sound/map/nl/map-v-jasne.ogg", "start": 1147927, "end": 1175323, "audio": 1}, {"filename": "/data/sound/map/nl/map-v-mapa.ogg", "start": 1175323, "end": 1197752, "audio": 1}, {"filename": "/data/sound/map/nl/map-v-oci.ogg", "start": 1197752, "end": 1217991, "audio": 1}, {"filename": "/data/sound/map/nl/map-v-poklady.ogg", "start": 1217991, "end": 1242532, "audio": 1}, {"filename": "/data/sound/map/nl/map-v-restart.ogg", "start": 1242532, "end": 1286933, "audio": 1}, {"filename": "/data/sound/map/nl/map-v-ukol.ogg", "start": 1286933, "end": 1310741, "audio": 1}], "remote_package_size": 1310741, "package_uuid": "02c46cc9-690d-4143-a2c4-f793bbbb3534"});

})();
