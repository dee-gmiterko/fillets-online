
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
    var PACKAGE_NAME = 'web/data/corridor.data';
    var REMOTE_PACKAGE_BASE = 'data/corridor.data';
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
Module['FS_createPath']('/data/images', 'corridor', true, true);
Module['FS_createPath']('/data', 'script', true, true);
Module['FS_createPath']('/data/script', 'corridor', true, true);
Module['FS_createPath']('/data', 'sound', true, true);
Module['FS_createPath']('/data/sound', 'corridor', true, true);
Module['FS_createPath']('/data/sound/corridor', 'cs', true, true);
Module['FS_createPath']('/data/sound/corridor', 'en', true, true);
Module['FS_createPath']('/data/sound/corridor', 'nl', true, true);

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
              Module['removeRunDependency']('datafile_web/data/corridor.data');

    };
    Module['addRunDependency']('datafile_web/data/corridor.data');
  
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
 loadPackage({"files": [{"filename": "/data/images/corridor/chodba-14-tmp.png", "start": 0, "end": 696, "audio": 0}, {"filename": "/data/images/corridor/chodba-20-tmp.png", "start": 696, "end": 1605, "audio": 0}, {"filename": "/data/images/corridor/chodba-21-tmp.png", "start": 1605, "end": 2472, "audio": 0}, {"filename": "/data/images/corridor/chodba-25-tmp.png", "start": 2472, "end": 2970, "audio": 0}, {"filename": "/data/images/corridor/chodba-4-tmp.png", "start": 2970, "end": 3886, "audio": 0}, {"filename": "/data/images/corridor/chodba-okoli.png", "start": 3886, "end": 43839, "audio": 0}, {"filename": "/data/images/corridor/chodba-p2.png", "start": 43839, "end": 399847, "audio": 0}, {"filename": "/data/images/corridor/dark.png", "start": 399847, "end": 400202, "audio": 0}, {"filename": "/data/images/corridor/dvere-a_00.png", "start": 400202, "end": 401477, "audio": 0}, {"filename": "/data/images/corridor/dvere-a_01.png", "start": 401477, "end": 402743, "audio": 0}, {"filename": "/data/images/corridor/dvere-a_02.png", "start": 402743, "end": 402917, "audio": 0}, {"filename": "/data/images/corridor/dvere-a_03.png", "start": 402917, "end": 403077, "audio": 0}, {"filename": "/data/images/corridor/dvere-b_00.png", "start": 403077, "end": 404366, "audio": 0}, {"filename": "/data/images/corridor/dvere-b_01.png", "start": 404366, "end": 405644, "audio": 0}, {"filename": "/data/images/corridor/dvere-b_02.png", "start": 405644, "end": 405819, "audio": 0}, {"filename": "/data/images/corridor/dvere-b_03.png", "start": 405819, "end": 405973, "audio": 0}, {"filename": "/data/images/corridor/matka_a.png", "start": 405973, "end": 406610, "audio": 0}, {"filename": "/data/images/corridor/poklop_00.png", "start": 406610, "end": 408760, "audio": 0}, {"filename": "/data/images/corridor/poklop_01.png", "start": 408760, "end": 410912, "audio": 0}, {"filename": "/data/images/corridor/poklop_02.png", "start": 410912, "end": 411220, "audio": 0}, {"filename": "/data/images/corridor/poklop_03.png", "start": 411220, "end": 411529, "audio": 0}, {"filename": "/data/images/corridor/robleft_00.png", "start": 411529, "end": 425011, "audio": 0}, {"filename": "/data/images/corridor/robleft_01.png", "start": 425011, "end": 438525, "audio": 0}, {"filename": "/data/images/corridor/robleft_02.png", "start": 438525, "end": 452009, "audio": 0}, {"filename": "/data/images/corridor/robleft_03.png", "start": 452009, "end": 453822, "audio": 0}, {"filename": "/data/images/corridor/robleft_04.png", "start": 453822, "end": 455675, "audio": 0}, {"filename": "/data/images/corridor/robleft_05.png", "start": 455675, "end": 457493, "audio": 0}, {"filename": "/data/images/corridor/robleft_06.png", "start": 457493, "end": 471047, "audio": 0}, {"filename": "/data/images/corridor/robleft_07.png", "start": 471047, "end": 484640, "audio": 0}, {"filename": "/data/images/corridor/robleft_08.png", "start": 484640, "end": 498194, "audio": 0}, {"filename": "/data/images/corridor/robright_00.png", "start": 498194, "end": 511613, "audio": 0}, {"filename": "/data/images/corridor/robright_01.png", "start": 511613, "end": 525073, "audio": 0}, {"filename": "/data/images/corridor/robright_02.png", "start": 525073, "end": 538516, "audio": 0}, {"filename": "/data/images/corridor/robright_03.png", "start": 538516, "end": 540323, "audio": 0}, {"filename": "/data/images/corridor/robright_04.png", "start": 540323, "end": 542171, "audio": 0}, {"filename": "/data/images/corridor/robright_05.png", "start": 542171, "end": 543993, "audio": 0}, {"filename": "/data/images/corridor/robright_06.png", "start": 543993, "end": 557569, "audio": 0}, {"filename": "/data/images/corridor/robright_07.png", "start": 557569, "end": 571188, "audio": 0}, {"filename": "/data/images/corridor/robright_08.png", "start": 571188, "end": 584790, "audio": 0}, {"filename": "/data/images/corridor/vypinac_00.png", "start": 584790, "end": 585576, "audio": 0}, {"filename": "/data/images/corridor/vypinac_01.png", "start": 585576, "end": 586362, "audio": 0}, {"filename": "/data/images/corridor/vypinac_02.png", "start": 586362, "end": 587156, "audio": 0}, {"filename": "/data/script/corridor/code.lua", "start": 587156, "end": 601243, "audio": 0}, {"filename": "/data/script/corridor/dialogs_bg.lua", "start": 601243, "end": 608284, "audio": 0}, {"filename": "/data/script/corridor/dialogs_cs.lua", "start": 608284, "end": 614333, "audio": 0}, {"filename": "/data/script/corridor/dialogs_de_CH.lua", "start": 614333, "end": 615131, "audio": 0}, {"filename": "/data/script/corridor/dialogs_de.lua", "start": 615131, "end": 621366, "audio": 0}, {"filename": "/data/script/corridor/dialogs_en.lua", "start": 621366, "end": 625064, "audio": 0}, {"filename": "/data/script/corridor/dialogs_es.lua", "start": 625064, "end": 631258, "audio": 0}, {"filename": "/data/script/corridor/dialogs_fr.lua", "start": 631258, "end": 637488, "audio": 0}, {"filename": "/data/script/corridor/dialogs_it.lua", "start": 637488, "end": 643537, "audio": 0}, {"filename": "/data/script/corridor/dialogs.lua", "start": 643537, "end": 643575, "audio": 0}, {"filename": "/data/script/corridor/dialogs_nl.lua", "start": 643575, "end": 649743, "audio": 0}, {"filename": "/data/script/corridor/dialogs_pl.lua", "start": 649743, "end": 655748, "audio": 0}, {"filename": "/data/script/corridor/dialogs_ru.lua", "start": 655748, "end": 662848, "audio": 0}, {"filename": "/data/script/corridor/dialogs_sv.lua", "start": 662848, "end": 668920, "audio": 0}, {"filename": "/data/script/corridor/init.lua", "start": 668920, "end": 669567, "audio": 0}, {"filename": "/data/script/corridor/models.lua", "start": 669567, "end": 674661, "audio": 0}, {"filename": "/data/sound/corridor/cs/ch-m-blik0.ogg", "start": 674661, "end": 693251, "audio": 1}, {"filename": "/data/sound/corridor/cs/ch-m-blik1.ogg", "start": 693251, "end": 721019, "audio": 1}, {"filename": "/data/sound/corridor/cs/ch-m-blik2.ogg", "start": 721019, "end": 734679, "audio": 1}, {"filename": "/data/sound/corridor/cs/ch-m-bojim0.ogg", "start": 734679, "end": 755498, "audio": 1}, {"filename": "/data/sound/corridor/cs/ch-m-bojim1.ogg", "start": 755498, "end": 769845, "audio": 1}, {"filename": "/data/sound/corridor/cs/ch-m-bojim2.ogg", "start": 769845, "end": 792841, "audio": 1}, {"filename": "/data/sound/corridor/cs/ch-m-doufam.ogg", "start": 792841, "end": 809054, "audio": 1}, {"filename": "/data/sound/corridor/cs/ch-m-odpoved0.ogg", "start": 809054, "end": 834606, "audio": 1}, {"filename": "/data/sound/corridor/cs/ch-m-odpoved1.ogg", "start": 834606, "end": 862525, "audio": 1}, {"filename": "/data/sound/corridor/cs/ch-m-odpoved2.ogg", "start": 862525, "end": 889031, "audio": 1}, {"filename": "/data/sound/corridor/cs/ch-m-odpoved3.ogg", "start": 889031, "end": 915123, "audio": 1}, {"filename": "/data/sound/corridor/cs/ch-m-rozsvit0.ogg", "start": 915123, "end": 929932, "audio": 1}, {"filename": "/data/sound/corridor/cs/ch-m-rozsvit1.ogg", "start": 929932, "end": 946675, "audio": 1}, {"filename": "/data/sound/corridor/cs/ch-m-rozsvit2.ogg", "start": 946675, "end": 974127, "audio": 1}, {"filename": "/data/sound/corridor/cs/ch-m-tady0.ogg", "start": 974127, "end": 983611, "audio": 1}, {"filename": "/data/sound/corridor/cs/ch-m-tady1.ogg", "start": 983611, "end": 995885, "audio": 1}, {"filename": "/data/sound/corridor/cs/ch-m-tady2.ogg", "start": 995885, "end": 1008676, "audio": 1}, {"filename": "/data/sound/corridor/cs/ch-m-ten.ogg", "start": 1008676, "end": 1034630, "audio": 1}, {"filename": "/data/sound/corridor/cs/ch-m-vubec.ogg", "start": 1034630, "end": 1056645, "audio": 1}, {"filename": "/data/sound/corridor/cs/ch-r-anavic0.ogg", "start": 1056645, "end": 1084744, "audio": 1}, {"filename": "/data/sound/corridor/cs/ch-r-anavic1.ogg", "start": 1084744, "end": 1137983, "audio": 1}, {"filename": "/data/sound/corridor/cs/ch-r-anavic2.ogg", "start": 1137983, "end": 1167574, "audio": 1}, {"filename": "/data/sound/corridor/cs/ch-r-anavic3.ogg", "start": 1167574, "end": 1208104, "audio": 1}, {"filename": "/data/sound/corridor/cs/ch-r-hracka.ogg", "start": 1208104, "end": 1239247, "audio": 1}, {"filename": "/data/sound/corridor/cs/ch-r-ikdyz0.ogg", "start": 1239247, "end": 1266851, "audio": 1}, {"filename": "/data/sound/corridor/cs/ch-r-ikdyz1.ogg", "start": 1266851, "end": 1299284, "audio": 1}, {"filename": "/data/sound/corridor/cs/ch-r-ikdyz2.ogg", "start": 1299284, "end": 1339779, "audio": 1}, {"filename": "/data/sound/corridor/cs/ch-r-ikdyz3.ogg", "start": 1339779, "end": 1375861, "audio": 1}, {"filename": "/data/sound/corridor/cs/ch-r-nevsimej0.ogg", "start": 1375861, "end": 1414706, "audio": 1}, {"filename": "/data/sound/corridor/cs/ch-r-nevsimej1.ogg", "start": 1414706, "end": 1451690, "audio": 1}, {"filename": "/data/sound/corridor/cs/ch-r-nevsimej2.ogg", "start": 1451690, "end": 1488157, "audio": 1}, {"filename": "/data/sound/corridor/cs/ch-v-halo0.ogg", "start": 1488157, "end": 1503337, "audio": 1}, {"filename": "/data/sound/corridor/cs/ch-v-halo1.ogg", "start": 1503337, "end": 1517107, "audio": 1}, {"filename": "/data/sound/corridor/cs/ch-v-halo2.ogg", "start": 1517107, "end": 1531092, "audio": 1}, {"filename": "/data/sound/corridor/cs/ch-v-neboj0.ogg", "start": 1531092, "end": 1546748, "audio": 1}, {"filename": "/data/sound/corridor/cs/ch-v-neboj1.ogg", "start": 1546748, "end": 1563811, "audio": 1}, {"filename": "/data/sound/corridor/cs/ch-v-neboj2.ogg", "start": 1563811, "end": 1577835, "audio": 1}, {"filename": "/data/sound/corridor/cs/ch-v-pockej0.ogg", "start": 1577835, "end": 1598809, "audio": 1}, {"filename": "/data/sound/corridor/cs/ch-v-pockej1.ogg", "start": 1598809, "end": 1624479, "audio": 1}, {"filename": "/data/sound/corridor/cs/ch-v-pockej2.ogg", "start": 1624479, "end": 1643630, "audio": 1}, {"filename": "/data/sound/corridor/cs/ch-v-pozor.ogg", "start": 1643630, "end": 1660886, "audio": 1}, {"filename": "/data/sound/corridor/cs/ch-v-robopes.ogg", "start": 1660886, "end": 1688654, "audio": 1}, {"filename": "/data/sound/corridor/cs/ch-v-smysl.ogg", "start": 1688654, "end": 1709800, "audio": 1}, {"filename": "/data/sound/corridor/cs/ch-v-zapada.ogg", "start": 1709800, "end": 1733792, "audio": 1}, {"filename": "/data/sound/corridor/en/ch-x-click1.ogg", "start": 1733792, "end": 1737826, "audio": 1}, {"filename": "/data/sound/corridor/en/ch-x-click2.ogg", "start": 1737826, "end": 1741923, "audio": 1}, {"filename": "/data/sound/corridor/nl/ch-m-blik0.ogg", "start": 1741923, "end": 1764603, "audio": 1}, {"filename": "/data/sound/corridor/nl/ch-m-blik1.ogg", "start": 1764603, "end": 1794076, "audio": 1}, {"filename": "/data/sound/corridor/nl/ch-m-blik2.ogg", "start": 1794076, "end": 1812049, "audio": 1}, {"filename": "/data/sound/corridor/nl/ch-m-bojim0.ogg", "start": 1812049, "end": 1831411, "audio": 1}, {"filename": "/data/sound/corridor/nl/ch-m-bojim1.ogg", "start": 1831411, "end": 1849604, "audio": 1}, {"filename": "/data/sound/corridor/nl/ch-m-bojim2.ogg", "start": 1849604, "end": 1872437, "audio": 1}, {"filename": "/data/sound/corridor/nl/ch-m-doufam.ogg", "start": 1872437, "end": 1894629, "audio": 1}, {"filename": "/data/sound/corridor/nl/ch-m-odpoved0.ogg", "start": 1894629, "end": 1925589, "audio": 1}, {"filename": "/data/sound/corridor/nl/ch-m-odpoved1.ogg", "start": 1925589, "end": 1956335, "audio": 1}, {"filename": "/data/sound/corridor/nl/ch-m-odpoved2.ogg", "start": 1956335, "end": 1987267, "audio": 1}, {"filename": "/data/sound/corridor/nl/ch-m-odpoved3.ogg", "start": 1987267, "end": 2017390, "audio": 1}, {"filename": "/data/sound/corridor/nl/ch-m-rozsvit0.ogg", "start": 2017390, "end": 2042137, "audio": 1}, {"filename": "/data/sound/corridor/nl/ch-m-rozsvit1.ogg", "start": 2042137, "end": 2062203, "audio": 1}, {"filename": "/data/sound/corridor/nl/ch-m-rozsvit2.ogg", "start": 2062203, "end": 2083055, "audio": 1}, {"filename": "/data/sound/corridor/nl/ch-m-tady0.ogg", "start": 2083055, "end": 2096986, "audio": 1}, {"filename": "/data/sound/corridor/nl/ch-m-tady1.ogg", "start": 2096986, "end": 2112477, "audio": 1}, {"filename": "/data/sound/corridor/nl/ch-m-tady2.ogg", "start": 2112477, "end": 2127642, "audio": 1}, {"filename": "/data/sound/corridor/nl/ch-m-ten.ogg", "start": 2127642, "end": 2150391, "audio": 1}, {"filename": "/data/sound/corridor/nl/ch-m-vubec.ogg", "start": 2150391, "end": 2175350, "audio": 1}, {"filename": "/data/sound/corridor/nl/ch-v-halo0.ogg", "start": 2175350, "end": 2191363, "audio": 1}, {"filename": "/data/sound/corridor/nl/ch-v-halo1.ogg", "start": 2191363, "end": 2210348, "audio": 1}, {"filename": "/data/sound/corridor/nl/ch-v-halo2.ogg", "start": 2210348, "end": 2226626, "audio": 1}, {"filename": "/data/sound/corridor/nl/ch-v-neboj0.ogg", "start": 2226626, "end": 2247605, "audio": 1}, {"filename": "/data/sound/corridor/nl/ch-v-neboj1.ogg", "start": 2247605, "end": 2272115, "audio": 1}, {"filename": "/data/sound/corridor/nl/ch-v-neboj2.ogg", "start": 2272115, "end": 2289249, "audio": 1}, {"filename": "/data/sound/corridor/nl/ch-v-pockej0.ogg", "start": 2289249, "end": 2312300, "audio": 1}, {"filename": "/data/sound/corridor/nl/ch-v-pockej1.ogg", "start": 2312300, "end": 2341877, "audio": 1}, {"filename": "/data/sound/corridor/nl/ch-v-pockej2.ogg", "start": 2341877, "end": 2365461, "audio": 1}, {"filename": "/data/sound/corridor/nl/ch-v-pozor.ogg", "start": 2365461, "end": 2384834, "audio": 1}, {"filename": "/data/sound/corridor/nl/ch-v-robopes.ogg", "start": 2384834, "end": 2412140, "audio": 1}, {"filename": "/data/sound/corridor/nl/ch-v-smysl.ogg", "start": 2412140, "end": 2438505, "audio": 1}, {"filename": "/data/sound/corridor/nl/ch-v-zapada.ogg", "start": 2438505, "end": 2455234, "audio": 1}], "remote_package_size": 2455234, "package_uuid": "d32d69a3-3dfb-47fb-952e-4bd4684d68b0"});

})();
