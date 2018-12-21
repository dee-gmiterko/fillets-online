
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
    var PACKAGE_NAME = 'web/data/kitchen.data';
    var REMOTE_PACKAGE_BASE = 'data/kitchen.data';
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
Module['FS_createPath']('/data/images', 'kitchen', true, true);
Module['FS_createPath']('/data', 'script', true, true);
Module['FS_createPath']('/data/script', 'kitchen', true, true);
Module['FS_createPath']('/data', 'sound', true, true);
Module['FS_createPath']('/data/sound', 'kitchen', true, true);
Module['FS_createPath']('/data/sound/kitchen', 'cs', true, true);
Module['FS_createPath']('/data/sound/kitchen', 'nl', true, true);

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
              Module['removeRunDependency']('datafile_web/data/kitchen.data');

    };
    Module['addRunDependency']('datafile_web/data/kitchen.data');
  
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
 loadPackage({"files": [{"filename": "/data/images/kitchen/17-ocel.png", "start": 0, "end": 2223, "audio": 0}, {"filename": "/data/images/kitchen/18-ocel.png", "start": 2223, "end": 4331, "audio": 0}, {"filename": "/data/images/kitchen/3-ocel.png", "start": 4331, "end": 5027, "audio": 0}, {"filename": "/data/images/kitchen/hrnecek.png", "start": 5027, "end": 7062, "audio": 0}, {"filename": "/data/images/kitchen/hrnec.png", "start": 7062, "end": 9222, "audio": 0}, {"filename": "/data/images/kitchen/kreslo.png", "start": 9222, "end": 13752, "audio": 0}, {"filename": "/data/images/kitchen/kuchyne-okoli.png", "start": 13752, "end": 210872, "audio": 0}, {"filename": "/data/images/kitchen/kuchyne-pozadi.png", "start": 210872, "end": 515806, "audio": 0}, {"filename": "/data/images/kitchen/mapa_v.png", "start": 515806, "end": 517345, "audio": 0}, {"filename": "/data/images/kitchen/mec.png", "start": 517345, "end": 522154, "audio": 0}, {"filename": "/data/images/kitchen/pohar.png", "start": 522154, "end": 523234, "audio": 0}, {"filename": "/data/images/kitchen/rahno_m.png", "start": 523234, "end": 525407, "audio": 0}, {"filename": "/data/images/kitchen/rahno_v.png", "start": 525407, "end": 530000, "audio": 0}, {"filename": "/data/images/kitchen/stolek-a.png", "start": 530000, "end": 532620, "audio": 0}, {"filename": "/data/images/kitchen/stolekm.png", "start": 532620, "end": 534600, "audio": 0}, {"filename": "/data/images/kitchen/stolek.png", "start": 534600, "end": 537221, "audio": 0}, {"filename": "/data/images/kitchen/stolekv.png", "start": 537221, "end": 539657, "audio": 0}, {"filename": "/data/images/kitchen/stozar_v_l.png", "start": 539657, "end": 541972, "audio": 0}, {"filename": "/data/images/kitchen/stul.png", "start": 541972, "end": 549488, "audio": 0}, {"filename": "/data/images/kitchen/sud.png", "start": 549488, "end": 552549, "audio": 0}, {"filename": "/data/images/kitchen/vejce.png", "start": 552549, "end": 553139, "audio": 0}, {"filename": "/data/script/kitchen/code.lua", "start": 553139, "end": 562601, "audio": 0}, {"filename": "/data/script/kitchen/dialogs_bg.lua", "start": 562601, "end": 568216, "audio": 0}, {"filename": "/data/script/kitchen/dialogs_cs.lua", "start": 568216, "end": 573074, "audio": 0}, {"filename": "/data/script/kitchen/dialogs_de.lua", "start": 573074, "end": 578085, "audio": 0}, {"filename": "/data/script/kitchen/dialogs_en.lua", "start": 578085, "end": 581044, "audio": 0}, {"filename": "/data/script/kitchen/dialogs_es.lua", "start": 581044, "end": 585988, "audio": 0}, {"filename": "/data/script/kitchen/dialogs_fr.lua", "start": 585988, "end": 591056, "audio": 0}, {"filename": "/data/script/kitchen/dialogs_it.lua", "start": 591056, "end": 595992, "audio": 0}, {"filename": "/data/script/kitchen/dialogs.lua", "start": 595992, "end": 596030, "audio": 0}, {"filename": "/data/script/kitchen/dialogs_nl.lua", "start": 596030, "end": 600948, "audio": 0}, {"filename": "/data/script/kitchen/dialogs_pl.lua", "start": 600948, "end": 605730, "audio": 0}, {"filename": "/data/script/kitchen/dialogs_ru.lua", "start": 605730, "end": 611344, "audio": 0}, {"filename": "/data/script/kitchen/dialogs_sv.lua", "start": 611344, "end": 616185, "audio": 0}, {"filename": "/data/script/kitchen/init.lua", "start": 616185, "end": 616831, "audio": 0}, {"filename": "/data/script/kitchen/models.lua", "start": 616831, "end": 621322, "audio": 0}, {"filename": "/data/sound/kitchen/cs/kuch-m-hrnec0.ogg", "start": 621322, "end": 642273, "audio": 1}, {"filename": "/data/sound/kitchen/cs/kuch-m-hrnec1.ogg", "start": 642273, "end": 659313, "audio": 1}, {"filename": "/data/sound/kitchen/cs/kuch-m-hrnec2.ogg", "start": 659313, "end": 678188, "audio": 1}, {"filename": "/data/sound/kitchen/cs/kuch-m-kreslo0.ogg", "start": 678188, "end": 697164, "audio": 1}, {"filename": "/data/sound/kitchen/cs/kuch-m-kreslo2.ogg", "start": 697164, "end": 714557, "audio": 1}, {"filename": "/data/sound/kitchen/cs/kuch-m-kuchari.ogg", "start": 714557, "end": 745983, "audio": 1}, {"filename": "/data/sound/kitchen/cs/kuch-m-noproblem.ogg", "start": 745983, "end": 770587, "audio": 1}, {"filename": "/data/sound/kitchen/cs/kuch-m-objev0.ogg", "start": 770587, "end": 786325, "audio": 1}, {"filename": "/data/sound/kitchen/cs/kuch-m-objev1.ogg", "start": 786325, "end": 806648, "audio": 1}, {"filename": "/data/sound/kitchen/cs/kuch-m-objev2.ogg", "start": 806648, "end": 820817, "audio": 1}, {"filename": "/data/sound/kitchen/cs/kuch-m-objev3.ogg", "start": 820817, "end": 843113, "audio": 1}, {"filename": "/data/sound/kitchen/cs/kuch-m-pekne.ogg", "start": 843113, "end": 867585, "audio": 1}, {"filename": "/data/sound/kitchen/cs/kuch-m-porcovani.ogg", "start": 867585, "end": 887387, "audio": 1}, {"filename": "/data/sound/kitchen/cs/kuch-m-premyslim0.ogg", "start": 887387, "end": 906292, "audio": 1}, {"filename": "/data/sound/kitchen/cs/kuch-m-premyslim1.ogg", "start": 906292, "end": 920118, "audio": 1}, {"filename": "/data/sound/kitchen/cs/kuch-m-premyslim2.ogg", "start": 920118, "end": 934364, "audio": 1}, {"filename": "/data/sound/kitchen/cs/kuch-m-recept.ogg", "start": 934364, "end": 951406, "audio": 1}, {"filename": "/data/sound/kitchen/cs/kuch-m-stolky.ogg", "start": 951406, "end": 966679, "audio": 1}, {"filename": "/data/sound/kitchen/cs/kuch-m-zapeklite.ogg", "start": 966679, "end": 1000193, "audio": 1}, {"filename": "/data/sound/kitchen/cs/kuch-v-ja.ogg", "start": 1000193, "end": 1011440, "audio": 1}, {"filename": "/data/sound/kitchen/cs/kuch-v-kreslo0.ogg", "start": 1011440, "end": 1038478, "audio": 1}, {"filename": "/data/sound/kitchen/cs/kuch-v-kreslo1.ogg", "start": 1038478, "end": 1054671, "audio": 1}, {"filename": "/data/sound/kitchen/cs/kuch-v-mec.ogg", "start": 1054671, "end": 1069227, "audio": 1}, {"filename": "/data/sound/kitchen/cs/kuch-v-nedela.ogg", "start": 1069227, "end": 1094031, "audio": 1}, {"filename": "/data/sound/kitchen/cs/kuch-v-obavam.ogg", "start": 1094031, "end": 1119541, "audio": 1}, {"filename": "/data/sound/kitchen/cs/kuch-v-odsud0.ogg", "start": 1119541, "end": 1136246, "audio": 1}, {"filename": "/data/sound/kitchen/cs/kuch-v-odsud1.ogg", "start": 1136246, "end": 1150624, "audio": 1}, {"filename": "/data/sound/kitchen/cs/kuch-v-podivej.ogg", "start": 1150624, "end": 1167250, "audio": 1}, {"filename": "/data/sound/kitchen/cs/kuch-v-problem.ogg", "start": 1167250, "end": 1179504, "audio": 1}, {"filename": "/data/sound/kitchen/cs/kuch-v-serie.ogg", "start": 1179504, "end": 1202156, "audio": 1}, {"filename": "/data/sound/kitchen/cs/kuch-v-stolky0.ogg", "start": 1202156, "end": 1226023, "audio": 1}, {"filename": "/data/sound/kitchen/cs/kuch-v-stolky1.ogg", "start": 1226023, "end": 1244573, "audio": 1}, {"filename": "/data/sound/kitchen/cs/kuch-v-stolky2.ogg", "start": 1244573, "end": 1268782, "audio": 1}, {"filename": "/data/sound/kitchen/cs/kuch-v-svitek0.ogg", "start": 1268782, "end": 1285922, "audio": 1}, {"filename": "/data/sound/kitchen/cs/kuch-v-svitek1.ogg", "start": 1285922, "end": 1309296, "audio": 1}, {"filename": "/data/sound/kitchen/cs/kuch-v-varil.ogg", "start": 1309296, "end": 1327281, "audio": 1}, {"filename": "/data/sound/kitchen/nl/kuch-m-hrnec0.ogg", "start": 1327281, "end": 1348292, "audio": 1}, {"filename": "/data/sound/kitchen/nl/kuch-m-hrnec1.ogg", "start": 1348292, "end": 1370289, "audio": 1}, {"filename": "/data/sound/kitchen/nl/kuch-m-hrnec2.ogg", "start": 1370289, "end": 1391085, "audio": 1}, {"filename": "/data/sound/kitchen/nl/kuch-m-kreslo0.ogg", "start": 1391085, "end": 1415052, "audio": 1}, {"filename": "/data/sound/kitchen/nl/kuch-m-kreslo2.ogg", "start": 1415052, "end": 1435529, "audio": 1}, {"filename": "/data/sound/kitchen/nl/kuch-m-kuchari.ogg", "start": 1435529, "end": 1464109, "audio": 1}, {"filename": "/data/sound/kitchen/nl/kuch-m-noproblem.ogg", "start": 1464109, "end": 1488580, "audio": 1}, {"filename": "/data/sound/kitchen/nl/kuch-m-objev0.ogg", "start": 1488580, "end": 1507735, "audio": 1}, {"filename": "/data/sound/kitchen/nl/kuch-m-objev1.ogg", "start": 1507735, "end": 1529939, "audio": 1}, {"filename": "/data/sound/kitchen/nl/kuch-m-objev2.ogg", "start": 1529939, "end": 1549404, "audio": 1}, {"filename": "/data/sound/kitchen/nl/kuch-m-objev3.ogg", "start": 1549404, "end": 1575013, "audio": 1}, {"filename": "/data/sound/kitchen/nl/kuch-m-pekne.ogg", "start": 1575013, "end": 1599722, "audio": 1}, {"filename": "/data/sound/kitchen/nl/kuch-m-porcovani.ogg", "start": 1599722, "end": 1624005, "audio": 1}, {"filename": "/data/sound/kitchen/nl/kuch-m-premyslim0.ogg", "start": 1624005, "end": 1647671, "audio": 1}, {"filename": "/data/sound/kitchen/nl/kuch-m-premyslim1.ogg", "start": 1647671, "end": 1660682, "audio": 1}, {"filename": "/data/sound/kitchen/nl/kuch-m-premyslim2.ogg", "start": 1660682, "end": 1676886, "audio": 1}, {"filename": "/data/sound/kitchen/nl/kuch-m-recept.ogg", "start": 1676886, "end": 1701067, "audio": 1}, {"filename": "/data/sound/kitchen/nl/kuch-m-stolky.ogg", "start": 1701067, "end": 1724191, "audio": 1}, {"filename": "/data/sound/kitchen/nl/kuch-m-zapeklite.ogg", "start": 1724191, "end": 1753265, "audio": 1}, {"filename": "/data/sound/kitchen/nl/kuch-v-ja.ogg", "start": 1753265, "end": 1767926, "audio": 1}, {"filename": "/data/sound/kitchen/nl/kuch-v-kreslo0.ogg", "start": 1767926, "end": 1795979, "audio": 1}, {"filename": "/data/sound/kitchen/nl/kuch-v-kreslo1.ogg", "start": 1795979, "end": 1815433, "audio": 1}, {"filename": "/data/sound/kitchen/nl/kuch-v-mec.ogg", "start": 1815433, "end": 1833125, "audio": 1}, {"filename": "/data/sound/kitchen/nl/kuch-v-nedela.ogg", "start": 1833125, "end": 1866447, "audio": 1}, {"filename": "/data/sound/kitchen/nl/kuch-v-obavam.ogg", "start": 1866447, "end": 1888071, "audio": 1}, {"filename": "/data/sound/kitchen/nl/kuch-v-odsud0.ogg", "start": 1888071, "end": 1905125, "audio": 1}, {"filename": "/data/sound/kitchen/nl/kuch-v-odsud1.ogg", "start": 1905125, "end": 1921180, "audio": 1}, {"filename": "/data/sound/kitchen/nl/kuch-v-podivej.ogg", "start": 1921180, "end": 1939996, "audio": 1}, {"filename": "/data/sound/kitchen/nl/kuch-v-problem.ogg", "start": 1939996, "end": 1958812, "audio": 1}, {"filename": "/data/sound/kitchen/nl/kuch-v-serie.ogg", "start": 1958812, "end": 1978189, "audio": 1}, {"filename": "/data/sound/kitchen/nl/kuch-v-stolky0.ogg", "start": 1978189, "end": 2004905, "audio": 1}, {"filename": "/data/sound/kitchen/nl/kuch-v-stolky1.ogg", "start": 2004905, "end": 2023098, "audio": 1}, {"filename": "/data/sound/kitchen/nl/kuch-v-stolky2.ogg", "start": 2023098, "end": 2046743, "audio": 1}, {"filename": "/data/sound/kitchen/nl/kuch-v-svitek0.ogg", "start": 2046743, "end": 2071734, "audio": 1}, {"filename": "/data/sound/kitchen/nl/kuch-v-svitek1.ogg", "start": 2071734, "end": 2100380, "audio": 1}, {"filename": "/data/sound/kitchen/nl/kuch-v-varil.ogg", "start": 2100380, "end": 2122576, "audio": 1}], "remote_package_size": 2122576, "package_uuid": "b09bc079-78f2-4402-85a0-a0390007b4f2"});

})();
