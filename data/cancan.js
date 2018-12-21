
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
    var PACKAGE_NAME = 'web/data/cancan.data';
    var REMOTE_PACKAGE_BASE = 'data/cancan.data';
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
Module['FS_createPath']('/data/images', 'cancan', true, true);
Module['FS_createPath']('/data', 'script', true, true);
Module['FS_createPath']('/data/script', 'cancan', true, true);
Module['FS_createPath']('/data', 'sound', true, true);
Module['FS_createPath']('/data/sound', 'cancan', true, true);
Module['FS_createPath']('/data/sound/cancan', 'cs', true, true);
Module['FS_createPath']('/data/sound/cancan', 'en', true, true);
Module['FS_createPath']('/data/sound/cancan', 'nl', true, true);

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
              Module['removeRunDependency']('datafile_web/data/cancan.data');

    };
    Module['addRunDependency']('datafile_web/data/cancan.data');
  
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
 loadPackage({"files": [{"filename": "/data/images/cancan/kankan-12-tmp.png", "start": 0, "end": 498, "audio": 0}, {"filename": "/data/images/cancan/kankan-16-tmp.png", "start": 498, "end": 1194, "audio": 0}, {"filename": "/data/images/cancan/kankan-17-tmp.png", "start": 1194, "end": 4598, "audio": 0}, {"filename": "/data/images/cancan/kankan-21-tmp.png", "start": 4598, "end": 5465, "audio": 0}, {"filename": "/data/images/cancan/kankan-7-tmp.png", "start": 5465, "end": 6161, "audio": 0}, {"filename": "/data/images/cancan/kankan-8-tmp.png", "start": 6161, "end": 7028, "audio": 0}, {"filename": "/data/images/cancan/kankan-9-tmp.png", "start": 7028, "end": 8554, "audio": 0}, {"filename": "/data/images/cancan/kankan-p.png", "start": 8554, "end": 227312, "audio": 0}, {"filename": "/data/images/cancan/kankan-w.png", "start": 227312, "end": 608116, "audio": 0}, {"filename": "/data/images/cancan/klavir_00.png", "start": 608116, "end": 613166, "audio": 0}, {"filename": "/data/images/cancan/klavir_01.png", "start": 613166, "end": 617965, "audio": 0}, {"filename": "/data/images/cancan/klavir_02.png", "start": 617965, "end": 622850, "audio": 0}, {"filename": "/data/images/cancan/klavir_03.png", "start": 622850, "end": 627711, "audio": 0}, {"filename": "/data/images/cancan/klavir_04.png", "start": 627711, "end": 633157, "audio": 0}, {"filename": "/data/images/cancan/klavir_05.png", "start": 633157, "end": 638261, "audio": 0}, {"filename": "/data/images/cancan/klavir_06.png", "start": 638261, "end": 643520, "audio": 0}, {"filename": "/data/images/cancan/klavir_07.png", "start": 643520, "end": 648761, "audio": 0}, {"filename": "/data/images/cancan/klavir_08.png", "start": 648761, "end": 653993, "audio": 0}, {"filename": "/data/images/cancan/klavir_09.png", "start": 653993, "end": 659404, "audio": 0}, {"filename": "/data/images/cancan/koral_s.png", "start": 659404, "end": 661791, "audio": 0}, {"filename": "/data/images/cancan/krab_00.png", "start": 661791, "end": 662874, "audio": 0}, {"filename": "/data/images/cancan/krab_01.png", "start": 662874, "end": 663952, "audio": 0}, {"filename": "/data/images/cancan/krab_02.png", "start": 663952, "end": 665016, "audio": 0}, {"filename": "/data/images/cancan/krab_03.png", "start": 665016, "end": 666088, "audio": 0}, {"filename": "/data/images/cancan/krab_04.png", "start": 666088, "end": 667166, "audio": 0}, {"filename": "/data/images/cancan/krab_05.png", "start": 667166, "end": 668247, "audio": 0}, {"filename": "/data/images/cancan/krab_06.png", "start": 668247, "end": 669378, "audio": 0}, {"filename": "/data/images/cancan/krab_07.png", "start": 669378, "end": 670495, "audio": 0}, {"filename": "/data/images/cancan/krab_08.png", "start": 670495, "end": 671562, "audio": 0}, {"filename": "/data/images/cancan/krab_09.png", "start": 671562, "end": 672672, "audio": 0}, {"filename": "/data/images/cancan/muslicka.png", "start": 672672, "end": 673374, "audio": 0}, {"filename": "/data/images/cancan/rejnok_00.png", "start": 673374, "end": 675142, "audio": 0}, {"filename": "/data/images/cancan/rejnok_01.png", "start": 675142, "end": 677016, "audio": 0}, {"filename": "/data/images/cancan/rejnok_02.png", "start": 677016, "end": 678884, "audio": 0}, {"filename": "/data/images/cancan/rejnok_03.png", "start": 678884, "end": 680661, "audio": 0}, {"filename": "/data/images/cancan/rejnok_04.png", "start": 680661, "end": 682406, "audio": 0}, {"filename": "/data/images/cancan/rejnok_05.png", "start": 682406, "end": 684030, "audio": 0}, {"filename": "/data/images/cancan/rejnok_06.png", "start": 684030, "end": 685787, "audio": 0}, {"filename": "/data/images/cancan/rejnok_07.png", "start": 685787, "end": 687662, "audio": 0}, {"filename": "/data/images/cancan/rejnok_08.png", "start": 687662, "end": 689534, "audio": 0}, {"filename": "/data/images/cancan/rejnok_09.png", "start": 689534, "end": 691322, "audio": 0}, {"filename": "/data/images/cancan/rejnok_10.png", "start": 691322, "end": 693054, "audio": 0}, {"filename": "/data/images/cancan/rejnok_11.png", "start": 693054, "end": 694663, "audio": 0}, {"filename": "/data/images/cancan/sasanka_00.png", "start": 694663, "end": 695884, "audio": 0}, {"filename": "/data/images/cancan/sasanka_01.png", "start": 695884, "end": 697314, "audio": 0}, {"filename": "/data/images/cancan/sasanka_02.png", "start": 697314, "end": 698614, "audio": 0}, {"filename": "/data/images/cancan/sasanka_03.png", "start": 698614, "end": 699919, "audio": 0}, {"filename": "/data/images/cancan/sasanka_04.png", "start": 699919, "end": 701113, "audio": 0}, {"filename": "/data/images/cancan/sasanka_05.png", "start": 701113, "end": 702518, "audio": 0}, {"filename": "/data/images/cancan/sasanka_06.png", "start": 702518, "end": 703825, "audio": 0}, {"filename": "/data/images/cancan/sasanka_07.png", "start": 703825, "end": 705128, "audio": 0}, {"filename": "/data/images/cancan/sepie_00.png", "start": 705128, "end": 708149, "audio": 0}, {"filename": "/data/images/cancan/sepie_01.png", "start": 708149, "end": 711227, "audio": 0}, {"filename": "/data/images/cancan/sepie_02.png", "start": 711227, "end": 714359, "audio": 0}, {"filename": "/data/images/cancan/sepie_03.png", "start": 714359, "end": 717222, "audio": 0}, {"filename": "/data/images/cancan/sepie_04.png", "start": 717222, "end": 720095, "audio": 0}, {"filename": "/data/images/cancan/sepie_05.png", "start": 720095, "end": 723047, "audio": 0}, {"filename": "/data/images/cancan/sepie_06.png", "start": 723047, "end": 726063, "audio": 0}, {"filename": "/data/images/cancan/sepie_07.png", "start": 726063, "end": 729128, "audio": 0}, {"filename": "/data/images/cancan/sepie_08.png", "start": 729128, "end": 732245, "audio": 0}, {"filename": "/data/images/cancan/sepie_09.png", "start": 732245, "end": 735078, "audio": 0}, {"filename": "/data/images/cancan/sepie_10.png", "start": 735078, "end": 738045, "audio": 0}, {"filename": "/data/images/cancan/sepie_11.png", "start": 738045, "end": 740830, "audio": 0}, {"filename": "/data/images/cancan/sepie_12.png", "start": 740830, "end": 743789, "audio": 0}, {"filename": "/data/images/cancan/shell1.png", "start": 743789, "end": 744520, "audio": 0}, {"filename": "/data/images/cancan/tecko.png", "start": 744520, "end": 746573, "audio": 0}, {"filename": "/data/script/cancan/code.lua", "start": 746573, "end": 762782, "audio": 0}, {"filename": "/data/script/cancan/dialogs_bg.lua", "start": 762782, "end": 762936, "audio": 0}, {"filename": "/data/script/cancan/dialogs_cs.lua", "start": 762936, "end": 763028, "audio": 0}, {"filename": "/data/script/cancan/dialogs_de.lua", "start": 763028, "end": 763128, "audio": 0}, {"filename": "/data/script/cancan/dialogs_en.lua", "start": 763128, "end": 763229, "audio": 0}, {"filename": "/data/script/cancan/dialogs_es.lua", "start": 763229, "end": 763338, "audio": 0}, {"filename": "/data/script/cancan/dialogs_fr.lua", "start": 763338, "end": 763441, "audio": 0}, {"filename": "/data/script/cancan/dialogs_it.lua", "start": 763441, "end": 763536, "audio": 0}, {"filename": "/data/script/cancan/dialogs.lua", "start": 763536, "end": 763574, "audio": 0}, {"filename": "/data/script/cancan/dialogs_nl.lua", "start": 763574, "end": 763682, "audio": 0}, {"filename": "/data/script/cancan/dialogs_pl.lua", "start": 763682, "end": 763777, "audio": 0}, {"filename": "/data/script/cancan/dialogs_ru.lua", "start": 763777, "end": 763942, "audio": 0}, {"filename": "/data/script/cancan/dialogs_sv.lua", "start": 763942, "end": 764044, "audio": 0}, {"filename": "/data/script/cancan/init.lua", "start": 764044, "end": 764689, "audio": 0}, {"filename": "/data/script/cancan/models.lua", "start": 764689, "end": 769102, "audio": 0}, {"filename": "/data/sound/cancan/cs/kan-v-proc.ogg", "start": 769102, "end": 785132, "audio": 1}, {"filename": "/data/sound/cancan/en/kan-klavir-music.ogg", "start": 785132, "end": 956496, "audio": 1}, {"filename": "/data/sound/cancan/nl/kan-v-proc.ogg", "start": 956496, "end": 976555, "audio": 1}], "remote_package_size": 976555, "package_uuid": "112d051a-b03b-48b6-9248-de301f973ddf"});

})();
