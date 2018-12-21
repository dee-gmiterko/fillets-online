
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
    var PACKAGE_NAME = 'web/data/floppy.data';
    var REMOTE_PACKAGE_BASE = 'data/floppy.data';
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
Module['FS_createPath']('/data/images', 'floppy', true, true);
Module['FS_createPath']('/data', 'script', true, true);
Module['FS_createPath']('/data/script', 'floppy', true, true);
Module['FS_createPath']('/data', 'sound', true, true);
Module['FS_createPath']('/data/sound', 'floppy', true, true);
Module['FS_createPath']('/data/sound/floppy', 'cs', true, true);
Module['FS_createPath']('/data/sound/floppy', 'en', true, true);
Module['FS_createPath']('/data/sound/floppy', 'nl', true, true);

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
              Module['removeRunDependency']('datafile_web/data/floppy.data');

    };
    Module['addRunDependency']('datafile_web/data/floppy.data');
  
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
 loadPackage({"files": [{"filename": "/data/images/floppy/11-ocel.png", "start": 0, "end": 2170, "audio": 0}, {"filename": "/data/images/floppy/13-ocel.png", "start": 2170, "end": 2668, "audio": 0}, {"filename": "/data/images/floppy/14-ocel.png", "start": 2668, "end": 4607, "audio": 0}, {"filename": "/data/images/floppy/1-tmp.png", "start": 4607, "end": 35791, "audio": 0}, {"filename": "/data/images/floppy/2-ocel.png", "start": 35791, "end": 37810, "audio": 0}, {"filename": "/data/images/floppy/3-ocel.png", "start": 37810, "end": 42125, "audio": 0}, {"filename": "/data/images/floppy/chip-1.png", "start": 42125, "end": 47102, "audio": 0}, {"filename": "/data/images/floppy/disketa-okoli.png", "start": 47102, "end": 149324, "audio": 0}, {"filename": "/data/images/floppy/disketa-p-opr.png", "start": 149324, "end": 356452, "audio": 0}, {"filename": "/data/images/floppy/klika.png", "start": 356452, "end": 358801, "audio": 0}, {"filename": "/data/images/floppy/poster.png", "start": 358801, "end": 462600, "audio": 0}, {"filename": "/data/images/floppy/souc.png", "start": 462600, "end": 464032, "audio": 0}, {"filename": "/data/images/floppy/svab_00.png", "start": 464032, "end": 465594, "audio": 0}, {"filename": "/data/images/floppy/svab_01.png", "start": 465594, "end": 467942, "audio": 0}, {"filename": "/data/images/floppy/svab_02.png", "start": 467942, "end": 470201, "audio": 0}, {"filename": "/data/images/floppy/svab_03.png", "start": 470201, "end": 472345, "audio": 0}, {"filename": "/data/images/floppy/vir-_00.png", "start": 472345, "end": 472959, "audio": 0}, {"filename": "/data/images/floppy/vir-_01.png", "start": 472959, "end": 473623, "audio": 0}, {"filename": "/data/images/floppy/vir-_02.png", "start": 473623, "end": 474271, "audio": 0}, {"filename": "/data/images/floppy/vir-_03.png", "start": 474271, "end": 474849, "audio": 0}, {"filename": "/data/images/floppy/vir-_04.png", "start": 474849, "end": 475480, "audio": 0}, {"filename": "/data/images/floppy/vir-_05.png", "start": 475480, "end": 476101, "audio": 0}, {"filename": "/data/images/floppy/vir-_06.png", "start": 476101, "end": 476680, "audio": 0}, {"filename": "/data/images/floppy/vir-_07.png", "start": 476680, "end": 477315, "audio": 0}, {"filename": "/data/images/floppy/vir-_08.png", "start": 477315, "end": 477934, "audio": 0}, {"filename": "/data/images/floppy/virus-_00.png", "start": 477934, "end": 478552, "audio": 0}, {"filename": "/data/images/floppy/virus-_01.png", "start": 478552, "end": 479216, "audio": 0}, {"filename": "/data/images/floppy/virus-_02.png", "start": 479216, "end": 479867, "audio": 0}, {"filename": "/data/images/floppy/virus-_03.png", "start": 479867, "end": 480449, "audio": 0}, {"filename": "/data/images/floppy/virus-_04.png", "start": 480449, "end": 481081, "audio": 0}, {"filename": "/data/images/floppy/virus-_05.png", "start": 481081, "end": 481701, "audio": 0}, {"filename": "/data/images/floppy/virus-_06.png", "start": 481701, "end": 482287, "audio": 0}, {"filename": "/data/images/floppy/virus-_07.png", "start": 482287, "end": 482922, "audio": 0}, {"filename": "/data/images/floppy/virus-_08.png", "start": 482922, "end": 483549, "audio": 0}, {"filename": "/data/script/floppy/code.lua", "start": 483549, "end": 494762, "audio": 0}, {"filename": "/data/script/floppy/demo_dialogs_bg.lua", "start": 494762, "end": 497504, "audio": 0}, {"filename": "/data/script/floppy/demo_dialogs_cs.lua", "start": 497504, "end": 499001, "audio": 0}, {"filename": "/data/script/floppy/demo_dialogs_de.lua", "start": 499001, "end": 501184, "audio": 0}, {"filename": "/data/script/floppy/demo_dialogs_en.lua", "start": 501184, "end": 502486, "audio": 0}, {"filename": "/data/script/floppy/demo_dialogs_es.lua", "start": 502486, "end": 504682, "audio": 0}, {"filename": "/data/script/floppy/demo_dialogs_fr.lua", "start": 504682, "end": 506891, "audio": 0}, {"filename": "/data/script/floppy/demo_dialogs_it.lua", "start": 506891, "end": 509164, "audio": 0}, {"filename": "/data/script/floppy/demo_dialogs_nl.lua", "start": 509164, "end": 511409, "audio": 0}, {"filename": "/data/script/floppy/demo_dialogs_pl.lua", "start": 511409, "end": 513579, "audio": 0}, {"filename": "/data/script/floppy/demo_dialogs_ru.lua", "start": 513579, "end": 516257, "audio": 0}, {"filename": "/data/script/floppy/demo_dialogs_sv.lua", "start": 516257, "end": 518397, "audio": 0}, {"filename": "/data/script/floppy/demo_poster.lua", "start": 518397, "end": 519065, "audio": 0}, {"filename": "/data/script/floppy/dialogs_bg.lua", "start": 519065, "end": 524848, "audio": 0}, {"filename": "/data/script/floppy/dialogs_cs.lua", "start": 524848, "end": 529407, "audio": 0}, {"filename": "/data/script/floppy/dialogs_de_CH.lua", "start": 529407, "end": 529969, "audio": 0}, {"filename": "/data/script/floppy/dialogs_de.lua", "start": 529969, "end": 534643, "audio": 0}, {"filename": "/data/script/floppy/dialogs_en.lua", "start": 534643, "end": 537609, "audio": 0}, {"filename": "/data/script/floppy/dialogs_es.lua", "start": 537609, "end": 541973, "audio": 0}, {"filename": "/data/script/floppy/dialogs_fr.lua", "start": 541973, "end": 546586, "audio": 0}, {"filename": "/data/script/floppy/dialogs_it.lua", "start": 546586, "end": 551074, "audio": 0}, {"filename": "/data/script/floppy/dialogs.lua", "start": 551074, "end": 551112, "audio": 0}, {"filename": "/data/script/floppy/dialogs_nl.lua", "start": 551112, "end": 555770, "audio": 0}, {"filename": "/data/script/floppy/dialogs_pl.lua", "start": 555770, "end": 560254, "audio": 0}, {"filename": "/data/script/floppy/dialogs_ru.lua", "start": 560254, "end": 565721, "audio": 0}, {"filename": "/data/script/floppy/dialogs_sv.lua", "start": 565721, "end": 570287, "audio": 0}, {"filename": "/data/script/floppy/init.lua", "start": 570287, "end": 570932, "audio": 0}, {"filename": "/data/script/floppy/models.lua", "start": 570932, "end": 574838, "audio": 0}, {"filename": "/data/sound/floppy/cs/disk-m-depres.ogg", "start": 574838, "end": 601597, "audio": 1}, {"filename": "/data/sound/floppy/cs/disk-m-nahrat.ogg", "start": 601597, "end": 633241, "audio": 1}, {"filename": "/data/sound/floppy/cs/disk-m-potvory.ogg", "start": 633241, "end": 652307, "audio": 1}, {"filename": "/data/sound/floppy/cs/disk-m-sakra.ogg", "start": 652307, "end": 675339, "audio": 1}, {"filename": "/data/sound/floppy/cs/disk-m-tady.ogg", "start": 675339, "end": 690291, "audio": 1}, {"filename": "/data/sound/floppy/cs/disk-m-tvorecci.ogg", "start": 690291, "end": 707485, "audio": 1}, {"filename": "/data/sound/floppy/cs/disk-m-ukol.ogg", "start": 707485, "end": 729720, "audio": 1}, {"filename": "/data/sound/floppy/cs/disk-m-vejit.ogg", "start": 729720, "end": 758331, "audio": 1}, {"filename": "/data/sound/floppy/cs/disk-m-velka.ogg", "start": 758331, "end": 791083, "audio": 1}, {"filename": "/data/sound/floppy/cs/disk-m-zmatlo.ogg", "start": 791083, "end": 826189, "audio": 1}, {"filename": "/data/sound/floppy/cs/disk-m-zvednem.ogg", "start": 826189, "end": 841900, "audio": 1}, {"filename": "/data/sound/floppy/cs/disk-v-kriz.ogg", "start": 841900, "end": 868033, "audio": 1}, {"filename": "/data/sound/floppy/cs/disk-v-mas.ogg", "start": 868033, "end": 885415, "audio": 1}, {"filename": "/data/sound/floppy/cs/disk-v-metrova.ogg", "start": 885415, "end": 922878, "audio": 1}, {"filename": "/data/sound/floppy/cs/disk-v-naano.ogg", "start": 922878, "end": 963598, "audio": 1}, {"filename": "/data/sound/floppy/cs/disk-v-nane.ogg", "start": 963598, "end": 988073, "audio": 1}, {"filename": "/data/sound/floppy/cs/disk-v-nejde.ogg", "start": 988073, "end": 1014440, "audio": 1}, {"filename": "/data/sound/floppy/cs/disk-v-neverim.ogg", "start": 1014440, "end": 1045656, "audio": 1}, {"filename": "/data/sound/floppy/cs/disk-v-pozor.ogg", "start": 1045656, "end": 1098338, "audio": 1}, {"filename": "/data/sound/floppy/cs/disk-v-tady.ogg", "start": 1098338, "end": 1116215, "audio": 1}, {"filename": "/data/sound/floppy/cs/disk-v-tezko.ogg", "start": 1116215, "end": 1126258, "audio": 1}, {"filename": "/data/sound/floppy/cs/disk-v-ulamu.ogg", "start": 1126258, "end": 1144481, "audio": 1}, {"filename": "/data/sound/floppy/cs/disk-v-viry.ogg", "start": 1144481, "end": 1162475, "audio": 1}, {"filename": "/data/sound/floppy/cs/disk-v-vratime.ogg", "start": 1162475, "end": 1176394, "audio": 1}, {"filename": "/data/sound/floppy/cs/disk-x-jejda0.ogg", "start": 1176394, "end": 1189095, "audio": 1}, {"filename": "/data/sound/floppy/cs/disk-x-jejda1.ogg", "start": 1189095, "end": 1204565, "audio": 1}, {"filename": "/data/sound/floppy/cs/disk-x-mazany.ogg", "start": 1204565, "end": 1222098, "audio": 1}, {"filename": "/data/sound/floppy/cs/disk-x-nepohnes.ogg", "start": 1222098, "end": 1243869, "audio": 1}, {"filename": "/data/sound/floppy/cs/disk-x-uzne.ogg", "start": 1243869, "end": 1262983, "audio": 1}, {"filename": "/data/sound/floppy/en/disk-x-au0.ogg", "start": 1262983, "end": 1273022, "audio": 1}, {"filename": "/data/sound/floppy/en/disk-x-au1.ogg", "start": 1273022, "end": 1283445, "audio": 1}, {"filename": "/data/sound/floppy/en/disk-x-au2.ogg", "start": 1283445, "end": 1298705, "audio": 1}, {"filename": "/data/sound/floppy/en/disk-x-vir0.ogg", "start": 1298705, "end": 1313575, "audio": 1}, {"filename": "/data/sound/floppy/en/disk-x-vir1.ogg", "start": 1313575, "end": 1324458, "audio": 1}, {"filename": "/data/sound/floppy/en/disk-x-vir2.ogg", "start": 1324458, "end": 1336249, "audio": 1}, {"filename": "/data/sound/floppy/nl/disk-m-depres.ogg", "start": 1336249, "end": 1360708, "audio": 1}, {"filename": "/data/sound/floppy/nl/disk-m-nahrat.ogg", "start": 1360708, "end": 1397338, "audio": 1}, {"filename": "/data/sound/floppy/nl/disk-m-potvory.ogg", "start": 1397338, "end": 1416125, "audio": 1}, {"filename": "/data/sound/floppy/nl/disk-m-sakra.ogg", "start": 1416125, "end": 1438588, "audio": 1}, {"filename": "/data/sound/floppy/nl/disk-m-tady.ogg", "start": 1438588, "end": 1456245, "audio": 1}, {"filename": "/data/sound/floppy/nl/disk-m-tvorecci.ogg", "start": 1456245, "end": 1477968, "audio": 1}, {"filename": "/data/sound/floppy/nl/disk-m-ukol.ogg", "start": 1477968, "end": 1502771, "audio": 1}, {"filename": "/data/sound/floppy/nl/disk-m-vejit.ogg", "start": 1502771, "end": 1531041, "audio": 1}, {"filename": "/data/sound/floppy/nl/disk-m-velka.ogg", "start": 1531041, "end": 1562850, "audio": 1}, {"filename": "/data/sound/floppy/nl/disk-m-zmatlo.ogg", "start": 1562850, "end": 1600619, "audio": 1}, {"filename": "/data/sound/floppy/nl/disk-m-zvednem.ogg", "start": 1600619, "end": 1620409, "audio": 1}, {"filename": "/data/sound/floppy/nl/disk-v-kriz.ogg", "start": 1620409, "end": 1650141, "audio": 1}, {"filename": "/data/sound/floppy/nl/disk-v-mas.ogg", "start": 1650141, "end": 1672711, "audio": 1}, {"filename": "/data/sound/floppy/nl/disk-v-metrova.ogg", "start": 1672711, "end": 1708418, "audio": 1}, {"filename": "/data/sound/floppy/nl/disk-v-naano.ogg", "start": 1708418, "end": 1742482, "audio": 1}, {"filename": "/data/sound/floppy/nl/disk-v-nane.ogg", "start": 1742482, "end": 1772470, "audio": 1}, {"filename": "/data/sound/floppy/nl/disk-v-nejde.ogg", "start": 1772470, "end": 1811372, "audio": 1}, {"filename": "/data/sound/floppy/nl/disk-v-neverim.ogg", "start": 1811372, "end": 1848168, "audio": 1}, {"filename": "/data/sound/floppy/nl/disk-v-pozor.ogg", "start": 1848168, "end": 1897770, "audio": 1}, {"filename": "/data/sound/floppy/nl/disk-v-tady.ogg", "start": 1897770, "end": 1921278, "audio": 1}, {"filename": "/data/sound/floppy/nl/disk-v-tezko.ogg", "start": 1921278, "end": 1938537, "audio": 1}, {"filename": "/data/sound/floppy/nl/disk-v-ulamu.ogg", "start": 1938537, "end": 1961564, "audio": 1}, {"filename": "/data/sound/floppy/nl/disk-v-viry.ogg", "start": 1961564, "end": 1983538, "audio": 1}, {"filename": "/data/sound/floppy/nl/disk-v-vratime.ogg", "start": 1983538, "end": 2002189, "audio": 1}], "remote_package_size": 2002189, "package_uuid": "35a26ff4-7fba-4e5f-a3ac-d68688d3f923"});

})();
