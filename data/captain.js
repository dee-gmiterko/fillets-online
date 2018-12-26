
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
    var PACKAGE_NAME = 'web/data/captain.data';
    var REMOTE_PACKAGE_BASE = 'data/captain.data';
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
Module['FS_createPath']('/data/images', 'captain', true, true);
Module['FS_createPath']('/data', 'script', true, true);
Module['FS_createPath']('/data/script', 'captain', true, true);
Module['FS_createPath']('/data', 'sound', true, true);
Module['FS_createPath']('/data/sound', 'captain', true, true);
Module['FS_createPath']('/data/sound/captain', 'cs', true, true);
Module['FS_createPath']('/data/sound/captain', 'nl', true, true);

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
              Module['removeRunDependency']('datafile_web/data/captain.data');

    };
    Module['addRunDependency']('datafile_web/data/captain.data');
  
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
 loadPackage({"files": [{"filename": "/data/images/captain/drahokam_00.png", "start": 0, "end": 1175, "audio": 0}, {"filename": "/data/images/captain/drahokam_01.png", "start": 1175, "end": 2341, "audio": 0}, {"filename": "/data/images/captain/drahokam_02.png", "start": 2341, "end": 3490, "audio": 0}, {"filename": "/data/images/captain/drahokam_03.png", "start": 3490, "end": 4617, "audio": 0}, {"filename": "/data/images/captain/drahokam_04.png", "start": 4617, "end": 5784, "audio": 0}, {"filename": "/data/images/captain/drahokam_05.png", "start": 5784, "end": 6934, "audio": 0}, {"filename": "/data/images/captain/hak_00.png", "start": 6934, "end": 10251, "audio": 0}, {"filename": "/data/images/captain/hak_01.png", "start": 10251, "end": 13695, "audio": 0}, {"filename": "/data/images/captain/hak_02.png", "start": 13695, "end": 17134, "audio": 0}, {"filename": "/data/images/captain/kreslo.png", "start": 17134, "end": 21664, "audio": 0}, {"filename": "/data/images/captain/krystal_c_00.png", "start": 21664, "end": 22278, "audio": 0}, {"filename": "/data/images/captain/krystal_c_01.png", "start": 22278, "end": 22888, "audio": 0}, {"filename": "/data/images/captain/krystal_c_02.png", "start": 22888, "end": 23484, "audio": 0}, {"filename": "/data/images/captain/krystal_c_03.png", "start": 23484, "end": 24066, "audio": 0}, {"filename": "/data/images/captain/krystal_f_00.png", "start": 24066, "end": 24718, "audio": 0}, {"filename": "/data/images/captain/krystal_f_01.png", "start": 24718, "end": 25363, "audio": 0}, {"filename": "/data/images/captain/krystal_f_02.png", "start": 25363, "end": 26002, "audio": 0}, {"filename": "/data/images/captain/krystal_f_03.png", "start": 26002, "end": 26612, "audio": 0}, {"filename": "/data/images/captain/krystal_m_00.png", "start": 26612, "end": 27250, "audio": 0}, {"filename": "/data/images/captain/krystal_m_01.png", "start": 27250, "end": 27887, "audio": 0}, {"filename": "/data/images/captain/krystal_m_02.png", "start": 27887, "end": 28505, "audio": 0}, {"filename": "/data/images/captain/krystal_m_03.png", "start": 28505, "end": 29106, "audio": 0}, {"filename": "/data/images/captain/lebza_00.png", "start": 29106, "end": 31496, "audio": 0}, {"filename": "/data/images/captain/lebza_01.png", "start": 31496, "end": 33917, "audio": 0}, {"filename": "/data/images/captain/lebza_02.png", "start": 33917, "end": 36362, "audio": 0}, {"filename": "/data/images/captain/lebza_03.png", "start": 36362, "end": 38806, "audio": 0}, {"filename": "/data/images/captain/mapa_m.png", "start": 38806, "end": 39828, "audio": 0}, {"filename": "/data/images/captain/mapa_v.png", "start": 39828, "end": 41367, "audio": 0}, {"filename": "/data/images/captain/nuz.png", "start": 41367, "end": 44327, "audio": 0}, {"filename": "/data/images/captain/oko_00.png", "start": 44327, "end": 45043, "audio": 0}, {"filename": "/data/images/captain/oko_01.png", "start": 45043, "end": 45734, "audio": 0}, {"filename": "/data/images/captain/oko_02.png", "start": 45734, "end": 46422, "audio": 0}, {"filename": "/data/images/captain/oko_03.png", "start": 46422, "end": 47091, "audio": 0}, {"filename": "/data/images/captain/oko_04.png", "start": 47091, "end": 47807, "audio": 0}, {"filename": "/data/images/captain/pohar.png", "start": 47807, "end": 48887, "audio": 0}, {"filename": "/data/images/captain/rahno_m.png", "start": 48887, "end": 51060, "audio": 0}, {"filename": "/data/images/captain/rahno_v.png", "start": 51060, "end": 55653, "audio": 0}, {"filename": "/data/images/captain/stozar_m.png", "start": 55653, "end": 57129, "audio": 0}, {"filename": "/data/images/captain/stozar_v_l.png", "start": 57129, "end": 59444, "audio": 0}, {"filename": "/data/images/captain/stozar_v.png", "start": 59444, "end": 61516, "audio": 0}, {"filename": "/data/images/captain/stul.png", "start": 61516, "end": 65397, "audio": 0}, {"filename": "/data/images/captain/vladova-10-tmp.png", "start": 65397, "end": 67252, "audio": 0}, {"filename": "/data/images/captain/vladova-18-tmp.png", "start": 67252, "end": 67855, "audio": 0}, {"filename": "/data/images/captain/vladova-21-tmp.png", "start": 67855, "end": 68551, "audio": 0}, {"filename": "/data/images/captain/vladova-2-tmp.png", "start": 68551, "end": 69247, "audio": 0}, {"filename": "/data/images/captain/vladova-p.png", "start": 69247, "end": 285073, "audio": 0}, {"filename": "/data/images/captain/vladova-w.png", "start": 285073, "end": 600986, "audio": 0}, {"filename": "/data/script/captain/code.lua", "start": 600986, "end": 617460, "audio": 0}, {"filename": "/data/script/captain/dialogs_bg.lua", "start": 617460, "end": 620072, "audio": 0}, {"filename": "/data/script/captain/dialogs_cs.lua", "start": 620072, "end": 622221, "audio": 0}, {"filename": "/data/script/captain/dialogs_de.lua", "start": 622221, "end": 624406, "audio": 0}, {"filename": "/data/script/captain/dialogs_en.lua", "start": 624406, "end": 625661, "audio": 0}, {"filename": "/data/script/captain/dialogs_es.lua", "start": 625661, "end": 627884, "audio": 0}, {"filename": "/data/script/captain/dialogs_fr.lua", "start": 627884, "end": 630078, "audio": 0}, {"filename": "/data/script/captain/dialogs_it.lua", "start": 630078, "end": 632267, "audio": 0}, {"filename": "/data/script/captain/dialogs.lua", "start": 632267, "end": 632305, "audio": 0}, {"filename": "/data/script/captain/dialogs_nl.lua", "start": 632305, "end": 634442, "audio": 0}, {"filename": "/data/script/captain/dialogs_pl.lua", "start": 634442, "end": 636570, "audio": 0}, {"filename": "/data/script/captain/dialogs_ru.lua", "start": 636570, "end": 639260, "audio": 0}, {"filename": "/data/script/captain/dialogs_sv.lua", "start": 639260, "end": 641348, "audio": 0}, {"filename": "/data/script/captain/init.lua", "start": 641348, "end": 641994, "audio": 0}, {"filename": "/data/script/captain/models.lua", "start": 641994, "end": 646484, "audio": 0}, {"filename": "/data/sound/captain/cs/vl-leb-kecy0.ogg", "start": 646484, "end": 671448, "audio": 1}, {"filename": "/data/sound/captain/cs/vl-leb-kecy1.ogg", "start": 671448, "end": 737589, "audio": 1}, {"filename": "/data/sound/captain/cs/vl-leb-kecy2.ogg", "start": 737589, "end": 778513, "audio": 1}, {"filename": "/data/sound/captain/cs/vl-leb-kecy3.ogg", "start": 778513, "end": 833076, "audio": 1}, {"filename": "/data/sound/captain/cs/vl-leb-kecy4.ogg", "start": 833076, "end": 875164, "audio": 1}, {"filename": "/data/sound/captain/cs/vl-m-hak.ogg", "start": 875164, "end": 913140, "audio": 1}, {"filename": "/data/sound/captain/cs/vl-m-hara.ogg", "start": 913140, "end": 928587, "audio": 1}, {"filename": "/data/sound/captain/cs/vl-m-oko.ogg", "start": 928587, "end": 946313, "audio": 1}, {"filename": "/data/sound/captain/cs/vl-v-kaj1.ogg", "start": 946313, "end": 965982, "audio": 1}, {"filename": "/data/sound/captain/cs/vl-v-kaj2.ogg", "start": 965982, "end": 982629, "audio": 1}, {"filename": "/data/sound/captain/cs/vl-v-lodni.ogg", "start": 982629, "end": 1008227, "audio": 1}, {"filename": "/data/sound/captain/cs/vl-v-silha.ogg", "start": 1008227, "end": 1025232, "audio": 1}, {"filename": "/data/sound/captain/cs/vl-x-site.ogg", "start": 1025232, "end": 1040896, "audio": 1}, {"filename": "/data/sound/captain/nl/vl-m-hak.ogg", "start": 1040896, "end": 1065811, "audio": 1}, {"filename": "/data/sound/captain/nl/vl-m-hara.ogg", "start": 1065811, "end": 1082507, "audio": 1}, {"filename": "/data/sound/captain/nl/vl-m-oko.ogg", "start": 1082507, "end": 1101339, "audio": 1}, {"filename": "/data/sound/captain/nl/vl-v-kaj1.ogg", "start": 1101339, "end": 1122709, "audio": 1}, {"filename": "/data/sound/captain/nl/vl-v-kaj2.ogg", "start": 1122709, "end": 1142220, "audio": 1}, {"filename": "/data/sound/captain/nl/vl-v-lodni.ogg", "start": 1142220, "end": 1174505, "audio": 1}, {"filename": "/data/sound/captain/nl/vl-v-silha.ogg", "start": 1174505, "end": 1193474, "audio": 1}], "remote_package_size": 1193474, "package_uuid": "be4c06d2-96bf-4566-b17e-958a377ae715"});

})();
