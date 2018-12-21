
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
    var PACKAGE_NAME = 'web/data/windoze.data';
    var REMOTE_PACKAGE_BASE = 'data/windoze.data';
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
Module['FS_createPath']('/data/images', 'windoze', true, true);
Module['FS_createPath']('/data', 'script', true, true);
Module['FS_createPath']('/data/script', 'windoze', true, true);
Module['FS_createPath']('/data', 'sound', true, true);
Module['FS_createPath']('/data/sound', 'windoze', true, true);
Module['FS_createPath']('/data/sound/windoze', 'cs', true, true);
Module['FS_createPath']('/data/sound/windoze', 'nl', true, true);

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
              Module['removeRunDependency']('datafile_web/data/windoze.data');

    };
    Module['addRunDependency']('datafile_web/data/windoze.data');
  
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
 loadPackage({"files": [{"filename": "/data/images/windoze/altar.png", "start": 0, "end": 1090, "audio": 0}, {"filename": "/data/images/windoze/altar__ru.png", "start": 1090, "end": 2224, "audio": 0}, {"filename": "/data/images/windoze/bonus_00.png", "start": 2224, "end": 5206, "audio": 0}, {"filename": "/data/images/windoze/bonus_01.png", "start": 5206, "end": 8195, "audio": 0}, {"filename": "/data/images/windoze/color.png", "start": 8195, "end": 8811, "audio": 0}, {"filename": "/data/images/windoze/disketa.png", "start": 8811, "end": 9183, "audio": 0}, {"filename": "/data/images/windoze/disketa__ru.png", "start": 9183, "end": 9547, "audio": 0}, {"filename": "/data/images/windoze/dotaz.png", "start": 9547, "end": 10045, "audio": 0}, {"filename": "/data/images/windoze/icon11.png", "start": 10045, "end": 10368, "audio": 0}, {"filename": "/data/images/windoze/icon14.png", "start": 10368, "end": 10676, "audio": 0}, {"filename": "/data/images/windoze/icon16.png", "start": 10676, "end": 11030, "audio": 0}, {"filename": "/data/images/windoze/icon17.png", "start": 11030, "end": 11416, "audio": 0}, {"filename": "/data/images/windoze/icon1.png", "start": 11416, "end": 11769, "audio": 0}, {"filename": "/data/images/windoze/icon21.png", "start": 11769, "end": 12134, "audio": 0}, {"filename": "/data/images/windoze/icon22.png", "start": 12134, "end": 12324, "audio": 0}, {"filename": "/data/images/windoze/icon24.png", "start": 12324, "end": 12615, "audio": 0}, {"filename": "/data/images/windoze/icon25.png", "start": 12615, "end": 12961, "audio": 0}, {"filename": "/data/images/windoze/icon27.png", "start": 12961, "end": 13275, "audio": 0}, {"filename": "/data/images/windoze/icon28.png", "start": 13275, "end": 13588, "audio": 0}, {"filename": "/data/images/windoze/icon29.png", "start": 13588, "end": 13909, "audio": 0}, {"filename": "/data/images/windoze/icon2.png", "start": 13909, "end": 14190, "audio": 0}, {"filename": "/data/images/windoze/icon31.png", "start": 14190, "end": 14470, "audio": 0}, {"filename": "/data/images/windoze/icon32.png", "start": 14470, "end": 14623, "audio": 0}, {"filename": "/data/images/windoze/icon33.png", "start": 14623, "end": 14891, "audio": 0}, {"filename": "/data/images/windoze/icon3.png", "start": 14891, "end": 15297, "audio": 0}, {"filename": "/data/images/windoze/icon5.png", "start": 15297, "end": 15716, "audio": 0}, {"filename": "/data/images/windoze/icon7.png", "start": 15716, "end": 16101, "audio": 0}, {"filename": "/data/images/windoze/kos.png", "start": 16101, "end": 16501, "audio": 0}, {"filename": "/data/images/windoze/kos__ru.png", "start": 16501, "end": 16928, "audio": 0}, {"filename": "/data/images/windoze/notepad_00.png", "start": 16928, "end": 17617, "audio": 0}, {"filename": "/data/images/windoze/notepad_00__ru.png", "start": 17617, "end": 18381, "audio": 0}, {"filename": "/data/images/windoze/notepad_01.png", "start": 18381, "end": 19090, "audio": 0}, {"filename": "/data/images/windoze/notepad_01__ru.png", "start": 19090, "end": 19879, "audio": 0}, {"filename": "/data/images/windoze/notepad_02.png", "start": 19879, "end": 20604, "audio": 0}, {"filename": "/data/images/windoze/notepad_02__ru.png", "start": 20604, "end": 21420, "audio": 0}, {"filename": "/data/images/windoze/notepad_03.png", "start": 21420, "end": 22148, "audio": 0}, {"filename": "/data/images/windoze/notepad_03__ru.png", "start": 22148, "end": 22960, "audio": 0}, {"filename": "/data/images/windoze/notepad_04.png", "start": 22960, "end": 23691, "audio": 0}, {"filename": "/data/images/windoze/notepad_04__ru.png", "start": 23691, "end": 24534, "audio": 0}, {"filename": "/data/images/windoze/notepad_05.png", "start": 24534, "end": 25268, "audio": 0}, {"filename": "/data/images/windoze/notepad_05__ru.png", "start": 25268, "end": 26115, "audio": 0}, {"filename": "/data/images/windoze/notepad_06.png", "start": 26115, "end": 26849, "audio": 0}, {"filename": "/data/images/windoze/notepad_06__ru.png", "start": 26849, "end": 27715, "audio": 0}, {"filename": "/data/images/windoze/notepad_07.png", "start": 27715, "end": 28454, "audio": 0}, {"filename": "/data/images/windoze/notepad_07__ru.png", "start": 28454, "end": 29327, "audio": 0}, {"filename": "/data/images/windoze/notepad_08.png", "start": 29327, "end": 30084, "audio": 0}, {"filename": "/data/images/windoze/notepad_08__ru.png", "start": 30084, "end": 30960, "audio": 0}, {"filename": "/data/images/windoze/notepad_09.png", "start": 30960, "end": 31721, "audio": 0}, {"filename": "/data/images/windoze/notepad_09__ru.png", "start": 31721, "end": 32602, "audio": 0}, {"filename": "/data/images/windoze/old-budik.png", "start": 32602, "end": 33416, "audio": 0}, {"filename": "/data/images/windoze/old-kniha.png", "start": 33416, "end": 33992, "audio": 0}, {"filename": "/data/images/windoze/old-prkna.png", "start": 33992, "end": 35667, "audio": 0}, {"filename": "/data/images/windoze/old-svicka.png", "start": 35667, "end": 37027, "audio": 0}, {"filename": "/data/images/windoze/old-valec.png", "start": 37027, "end": 37509, "audio": 0}, {"filename": "/data/images/windoze/tento.png", "start": 37509, "end": 37936, "audio": 0}, {"filename": "/data/images/windoze/tento__ru.png", "start": 37936, "end": 38343, "audio": 0}, {"filename": "/data/images/windoze/win-p.png", "start": 38343, "end": 149637, "audio": 0}, {"filename": "/data/images/windoze/win-w.png", "start": 149637, "end": 153390, "audio": 0}, {"filename": "/data/images/windoze/win-w__ru.png", "start": 153390, "end": 157025, "audio": 0}, {"filename": "/data/script/windoze/code.lua", "start": 157025, "end": 166548, "audio": 0}, {"filename": "/data/script/windoze/dialogs_bg.lua", "start": 166548, "end": 172636, "audio": 0}, {"filename": "/data/script/windoze/dialogs_cs.lua", "start": 172636, "end": 177626, "audio": 0}, {"filename": "/data/script/windoze/dialogs_de_CH.lua", "start": 177626, "end": 178182, "audio": 0}, {"filename": "/data/script/windoze/dialogs_de.lua", "start": 178182, "end": 183359, "audio": 0}, {"filename": "/data/script/windoze/dialogs_en.lua", "start": 183359, "end": 186304, "audio": 0}, {"filename": "/data/script/windoze/dialogs_es.lua", "start": 186304, "end": 191504, "audio": 0}, {"filename": "/data/script/windoze/dialogs_fr.lua", "start": 191504, "end": 196762, "audio": 0}, {"filename": "/data/script/windoze/dialogs_it.lua", "start": 196762, "end": 201875, "audio": 0}, {"filename": "/data/script/windoze/dialogs.lua", "start": 201875, "end": 201913, "audio": 0}, {"filename": "/data/script/windoze/dialogs_nl.lua", "start": 201913, "end": 206993, "audio": 0}, {"filename": "/data/script/windoze/dialogs_pl.lua", "start": 206993, "end": 211897, "audio": 0}, {"filename": "/data/script/windoze/dialogs_ru.lua", "start": 211897, "end": 217976, "audio": 0}, {"filename": "/data/script/windoze/dialogs_sv.lua", "start": 217976, "end": 223115, "audio": 0}, {"filename": "/data/script/windoze/init.lua", "start": 223115, "end": 223761, "audio": 0}, {"filename": "/data/script/windoze/models.lua", "start": 223761, "end": 230499, "audio": 0}, {"filename": "/data/sound/windoze/cs/win-m-blok.ogg", "start": 230499, "end": 269221, "audio": 1}, {"filename": "/data/sound/windoze/cs/win-m-chodila.ogg", "start": 269221, "end": 300697, "audio": 1}, {"filename": "/data/sound/windoze/cs/win-m-costim0.ogg", "start": 300697, "end": 333578, "audio": 1}, {"filename": "/data/sound/windoze/cs/win-m-costim1.ogg", "start": 333578, "end": 355190, "audio": 1}, {"filename": "/data/sound/windoze/cs/win-m-costim2.ogg", "start": 355190, "end": 375223, "audio": 1}, {"filename": "/data/sound/windoze/cs/win-m-costim3.ogg", "start": 375223, "end": 397241, "audio": 1}, {"filename": "/data/sound/windoze/cs/win-m-costim4.ogg", "start": 397241, "end": 419073, "audio": 1}, {"filename": "/data/sound/windoze/cs/win-m-dira.ogg", "start": 419073, "end": 440014, "audio": 1}, {"filename": "/data/sound/windoze/cs/win-m-jejda.ogg", "start": 440014, "end": 461388, "audio": 1}, {"filename": "/data/sound/windoze/cs/win-m-nemusim.ogg", "start": 461388, "end": 484744, "audio": 1}, {"filename": "/data/sound/windoze/cs/win-m-nic1.ogg", "start": 484744, "end": 500099, "audio": 1}, {"filename": "/data/sound/windoze/cs/win-m-nic3.ogg", "start": 500099, "end": 516689, "audio": 1}, {"filename": "/data/sound/windoze/cs/win-m-okno.ogg", "start": 516689, "end": 532177, "audio": 1}, {"filename": "/data/sound/windoze/cs/win-m-ven.ogg", "start": 532177, "end": 557665, "audio": 1}, {"filename": "/data/sound/windoze/cs/win-m-vga.ogg", "start": 557665, "end": 601764, "audio": 1}, {"filename": "/data/sound/windoze/cs/win-m-vzit.ogg", "start": 601764, "end": 626113, "audio": 1}, {"filename": "/data/sound/windoze/cs/win-m-zahrat.ogg", "start": 626113, "end": 643892, "audio": 1}, {"filename": "/data/sound/windoze/cs/win-m-zavrene.ogg", "start": 643892, "end": 667769, "audio": 1}, {"filename": "/data/sound/windoze/cs/win-v-citim.ogg", "start": 667769, "end": 702458, "audio": 1}, {"filename": "/data/sound/windoze/cs/win-v-hav.ogg", "start": 702458, "end": 731889, "audio": 1}, {"filename": "/data/sound/windoze/cs/win-v-hra.ogg", "start": 731889, "end": 761450, "audio": 1}, {"filename": "/data/sound/windoze/cs/win-v-nehrajem.ogg", "start": 761450, "end": 788757, "audio": 1}, {"filename": "/data/sound/windoze/cs/win-v-nic0.ogg", "start": 788757, "end": 803499, "audio": 1}, {"filename": "/data/sound/windoze/cs/win-v-nic2.ogg", "start": 803499, "end": 815548, "audio": 1}, {"filename": "/data/sound/windoze/cs/win-v-osvobodit.ogg", "start": 815548, "end": 840653, "audio": 1}, {"filename": "/data/sound/windoze/cs/win-v-plocha.ogg", "start": 840653, "end": 866007, "audio": 1}, {"filename": "/data/sound/windoze/cs/win-v-pocitala.ogg", "start": 866007, "end": 883409, "audio": 1}, {"filename": "/data/sound/windoze/cs/win-v-pockej.ogg", "start": 883409, "end": 928114, "audio": 1}, {"filename": "/data/sound/windoze/cs/win-v-premyslej.ogg", "start": 928114, "end": 948526, "audio": 1}, {"filename": "/data/sound/windoze/cs/win-v-real.ogg", "start": 948526, "end": 968867, "audio": 1}, {"filename": "/data/sound/windoze/cs/win-v-tamhle.ogg", "start": 968867, "end": 987229, "audio": 1}, {"filename": "/data/sound/windoze/nl/win-m-blok.ogg", "start": 987229, "end": 1020479, "audio": 1}, {"filename": "/data/sound/windoze/nl/win-m-chodila.ogg", "start": 1020479, "end": 1050648, "audio": 1}, {"filename": "/data/sound/windoze/nl/win-m-costim0.ogg", "start": 1050648, "end": 1078772, "audio": 1}, {"filename": "/data/sound/windoze/nl/win-m-costim1.ogg", "start": 1078772, "end": 1102453, "audio": 1}, {"filename": "/data/sound/windoze/nl/win-m-costim2.ogg", "start": 1102453, "end": 1127727, "audio": 1}, {"filename": "/data/sound/windoze/nl/win-m-costim3.ogg", "start": 1127727, "end": 1152172, "audio": 1}, {"filename": "/data/sound/windoze/nl/win-m-costim4.ogg", "start": 1152172, "end": 1176409, "audio": 1}, {"filename": "/data/sound/windoze/nl/win-m-dira.ogg", "start": 1176409, "end": 1199781, "audio": 1}, {"filename": "/data/sound/windoze/nl/win-m-jejda.ogg", "start": 1199781, "end": 1226377, "audio": 1}, {"filename": "/data/sound/windoze/nl/win-m-nemusim.ogg", "start": 1226377, "end": 1249495, "audio": 1}, {"filename": "/data/sound/windoze/nl/win-m-nic1.ogg", "start": 1249495, "end": 1264994, "audio": 1}, {"filename": "/data/sound/windoze/nl/win-m-nic3.ogg", "start": 1264994, "end": 1281528, "audio": 1}, {"filename": "/data/sound/windoze/nl/win-m-okno.ogg", "start": 1281528, "end": 1302139, "audio": 1}, {"filename": "/data/sound/windoze/nl/win-m-ven.ogg", "start": 1302139, "end": 1324088, "audio": 1}, {"filename": "/data/sound/windoze/nl/win-m-vga.ogg", "start": 1324088, "end": 1364757, "audio": 1}, {"filename": "/data/sound/windoze/nl/win-m-vzit.ogg", "start": 1364757, "end": 1391609, "audio": 1}, {"filename": "/data/sound/windoze/nl/win-m-zahrat.ogg", "start": 1391609, "end": 1412537, "audio": 1}, {"filename": "/data/sound/windoze/nl/win-m-zavrene.ogg", "start": 1412537, "end": 1436390, "audio": 1}, {"filename": "/data/sound/windoze/nl/win-v-citim.ogg", "start": 1436390, "end": 1470277, "audio": 1}, {"filename": "/data/sound/windoze/nl/win-v-hav.ogg", "start": 1470277, "end": 1498967, "audio": 1}, {"filename": "/data/sound/windoze/nl/win-v-hra.ogg", "start": 1498967, "end": 1528687, "audio": 1}, {"filename": "/data/sound/windoze/nl/win-v-nehrajem.ogg", "start": 1528687, "end": 1555093, "audio": 1}, {"filename": "/data/sound/windoze/nl/win-v-nic0.ogg", "start": 1555093, "end": 1572301, "audio": 1}, {"filename": "/data/sound/windoze/nl/win-v-nic2.ogg", "start": 1572301, "end": 1589167, "audio": 1}, {"filename": "/data/sound/windoze/nl/win-v-osvobodit.ogg", "start": 1589167, "end": 1621385, "audio": 1}, {"filename": "/data/sound/windoze/nl/win-v-plocha.ogg", "start": 1621385, "end": 1649011, "audio": 1}, {"filename": "/data/sound/windoze/nl/win-v-pocitala.ogg", "start": 1649011, "end": 1674527, "audio": 1}, {"filename": "/data/sound/windoze/nl/win-v-pockej.ogg", "start": 1674527, "end": 1722576, "audio": 1}, {"filename": "/data/sound/windoze/nl/win-v-premyslej.ogg", "start": 1722576, "end": 1747763, "audio": 1}, {"filename": "/data/sound/windoze/nl/win-v-real.ogg", "start": 1747763, "end": 1773485, "audio": 1}, {"filename": "/data/sound/windoze/nl/win-v-tamhle.ogg", "start": 1773485, "end": 1792611, "audio": 1}], "remote_package_size": 1792611, "package_uuid": "5dd26bdf-ae44-4e4d-9282-4699a233df56"});

})();
