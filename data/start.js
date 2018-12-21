
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
    var PACKAGE_NAME = 'web/data/start.data';
    var REMOTE_PACKAGE_BASE = 'data/start.data';
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
Module['FS_createPath']('/data/images', 'start', true, true);
Module['FS_createPath']('/data', 'script', true, true);
Module['FS_createPath']('/data/script', 'start', true, true);
Module['FS_createPath']('/data', 'sound', true, true);
Module['FS_createPath']('/data/sound', 'start', true, true);
Module['FS_createPath']('/data/sound/start', 'cs', true, true);
Module['FS_createPath']('/data/sound/start', 'nl', true, true);

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
              Module['removeRunDependency']('datafile_web/data/start.data');

    };
    Module['addRunDependency']('datafile_web/data/start.data');
  
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
 loadPackage({"files": [{"filename": "/data/images/start/polstar.png", "start": 0, "end": 1541, "audio": 0}, {"filename": "/data/images/start/prvni-p.png", "start": 1541, "end": 186575, "audio": 0}, {"filename": "/data/images/start/prvni-w.png", "start": 186575, "end": 410734, "audio": 0}, {"filename": "/data/images/start/stul.png", "start": 410734, "end": 414966, "audio": 0}, {"filename": "/data/images/start/val_00.png", "start": 414966, "end": 415901, "audio": 0}, {"filename": "/data/images/start/val_01.png", "start": 415901, "end": 417254, "audio": 0}, {"filename": "/data/images/start/val_02.png", "start": 417254, "end": 418669, "audio": 0}, {"filename": "/data/images/start/val_03.png", "start": 418669, "end": 420130, "audio": 0}, {"filename": "/data/images/start/val_04.png", "start": 420130, "end": 421648, "audio": 0}, {"filename": "/data/images/start/val_05.png", "start": 421648, "end": 423207, "audio": 0}, {"filename": "/data/images/start/val_06.png", "start": 423207, "end": 424765, "audio": 0}, {"filename": "/data/images/start/val_07.png", "start": 424765, "end": 426284, "audio": 0}, {"filename": "/data/images/start/val_08.png", "start": 426284, "end": 427837, "audio": 0}, {"filename": "/data/images/start/zidle_m.png", "start": 427837, "end": 432032, "audio": 0}, {"filename": "/data/images/start/zidle_v.png", "start": 432032, "end": 436246, "audio": 0}, {"filename": "/data/script/start/code.lua", "start": 436246, "end": 446619, "audio": 0}, {"filename": "/data/script/start/dialogs_bg.lua", "start": 446619, "end": 452591, "audio": 0}, {"filename": "/data/script/start/dialogs_cs.lua", "start": 452591, "end": 457459, "audio": 0}, {"filename": "/data/script/start/dialogs_de_CH.lua", "start": 457459, "end": 457759, "audio": 0}, {"filename": "/data/script/start/dialogs_de.lua", "start": 457759, "end": 462851, "audio": 0}, {"filename": "/data/script/start/dialogs_en.lua", "start": 462851, "end": 465768, "audio": 0}, {"filename": "/data/script/start/dialogs_eo.lua", "start": 465768, "end": 470567, "audio": 0}, {"filename": "/data/script/start/dialogs_es.lua", "start": 470567, "end": 475647, "audio": 0}, {"filename": "/data/script/start/dialogs_fr.lua", "start": 475647, "end": 480696, "audio": 0}, {"filename": "/data/script/start/dialogs_it.lua", "start": 480696, "end": 485668, "audio": 0}, {"filename": "/data/script/start/dialogs.lua", "start": 485668, "end": 485706, "audio": 0}, {"filename": "/data/script/start/dialogs_nl.lua", "start": 485706, "end": 490748, "audio": 0}, {"filename": "/data/script/start/dialogs_pl.lua", "start": 490748, "end": 495692, "audio": 0}, {"filename": "/data/script/start/dialogs_ru.lua", "start": 495692, "end": 501891, "audio": 0}, {"filename": "/data/script/start/dialogs_sl.lua", "start": 501891, "end": 506805, "audio": 0}, {"filename": "/data/script/start/dialogs_sv.lua", "start": 506805, "end": 511830, "audio": 0}, {"filename": "/data/script/start/init.lua", "start": 511830, "end": 512474, "audio": 0}, {"filename": "/data/script/start/models.lua", "start": 512474, "end": 514257, "audio": 0}, {"filename": "/data/sound/start/cs/1st-m-backspace.ogg", "start": 514257, "end": 528377, "audio": 1}, {"filename": "/data/sound/start/cs/1st-m-cotobylo.ogg", "start": 528377, "end": 540025, "audio": 1}, {"filename": "/data/sound/start/cs/1st-m-diky.ogg", "start": 540025, "end": 559382, "audio": 1}, {"filename": "/data/sound/start/cs/1st-m-hej.ogg", "start": 559382, "end": 573357, "audio": 1}, {"filename": "/data/sound/start/cs/1st-m-hmmm.ogg", "start": 573357, "end": 601516, "audio": 1}, {"filename": "/data/sound/start/cs/1st-m-navod4.ogg", "start": 601516, "end": 637698, "audio": 1}, {"filename": "/data/sound/start/cs/1st-m-navod6.ogg", "start": 637698, "end": 650482, "audio": 1}, {"filename": "/data/sound/start/cs/1st-m-navod8.ogg", "start": 650482, "end": 675576, "audio": 1}, {"filename": "/data/sound/start/cs/1st-m-nechtoho.ogg", "start": 675576, "end": 699351, "audio": 1}, {"filename": "/data/sound/start/cs/1st-m-nepohnu.ogg", "start": 699351, "end": 720549, "audio": 1}, {"filename": "/data/sound/start/cs/1st-m-neprojedu.ogg", "start": 720549, "end": 744680, "audio": 1}, {"filename": "/data/sound/start/cs/1st-m-pockej.ogg", "start": 744680, "end": 762849, "audio": 1}, {"filename": "/data/sound/start/cs/1st-m-pokud.ogg", "start": 762849, "end": 789720, "audio": 1}, {"filename": "/data/sound/start/cs/1st-m-proc.ogg", "start": 789720, "end": 804049, "audio": 1}, {"filename": "/data/sound/start/cs/1st-v-chyba.ogg", "start": 804049, "end": 840928, "audio": 1}, {"filename": "/data/sound/start/cs/1st-v-davej.ogg", "start": 840928, "end": 875273, "audio": 1}, {"filename": "/data/sound/start/cs/1st-v-jedno.ogg", "start": 875273, "end": 886718, "audio": 1}, {"filename": "/data/sound/start/cs/1st-v-najit.ogg", "start": 886718, "end": 906563, "audio": 1}, {"filename": "/data/sound/start/cs/1st-v-navod1.ogg", "start": 906563, "end": 941556, "audio": 1}, {"filename": "/data/sound/start/cs/1st-v-navod5.ogg", "start": 941556, "end": 958463, "audio": 1}, {"filename": "/data/sound/start/cs/1st-v-navod7.ogg", "start": 958463, "end": 998406, "audio": 1}, {"filename": "/data/sound/start/cs/1st-v-nedostanu.ogg", "start": 998406, "end": 1032703, "audio": 1}, {"filename": "/data/sound/start/cs/1st-v-nemuzu.ogg", "start": 1032703, "end": 1059740, "audio": 1}, {"filename": "/data/sound/start/cs/1st-v-netusim.ogg", "start": 1059740, "end": 1072409, "audio": 1}, {"filename": "/data/sound/start/cs/1st-v-posunout.ogg", "start": 1072409, "end": 1094579, "audio": 1}, {"filename": "/data/sound/start/cs/1st-v-pribral.ogg", "start": 1094579, "end": 1110058, "audio": 1}, {"filename": "/data/sound/start/cs/1st-v-stiskni.ogg", "start": 1110058, "end": 1128478, "audio": 1}, {"filename": "/data/sound/start/cs/1st-v-takdobre.ogg", "start": 1128478, "end": 1138705, "audio": 1}, {"filename": "/data/sound/start/cs/1st-v-takukaz.ogg", "start": 1138705, "end": 1151936, "audio": 1}, {"filename": "/data/sound/start/cs/1st-v-ven.ogg", "start": 1151936, "end": 1167949, "audio": 1}, {"filename": "/data/sound/start/cs/1st-v-znovu.ogg", "start": 1167949, "end": 1195365, "audio": 1}, {"filename": "/data/sound/start/cs/1st-x-ocel.ogg", "start": 1195365, "end": 1314364, "audio": 1}, {"filename": "/data/sound/start/nl/1st-m-backspace.ogg", "start": 1314364, "end": 1335836, "audio": 1}, {"filename": "/data/sound/start/nl/1st-m-cotobylo.ogg", "start": 1335836, "end": 1352693, "audio": 1}, {"filename": "/data/sound/start/nl/1st-m-diky.ogg", "start": 1352693, "end": 1370138, "audio": 1}, {"filename": "/data/sound/start/nl/1st-m-hej.ogg", "start": 1370138, "end": 1390789, "audio": 1}, {"filename": "/data/sound/start/nl/1st-m-hmmm.ogg", "start": 1390789, "end": 1414491, "audio": 1}, {"filename": "/data/sound/start/nl/1st-m-navod4.ogg", "start": 1414491, "end": 1445867, "audio": 1}, {"filename": "/data/sound/start/nl/1st-m-navod6.ogg", "start": 1445867, "end": 1461400, "audio": 1}, {"filename": "/data/sound/start/nl/1st-m-navod8.ogg", "start": 1461400, "end": 1484130, "audio": 1}, {"filename": "/data/sound/start/nl/1st-m-nechtoho.ogg", "start": 1484130, "end": 1506425, "audio": 1}, {"filename": "/data/sound/start/nl/1st-m-nepohnu.ogg", "start": 1506425, "end": 1530315, "audio": 1}, {"filename": "/data/sound/start/nl/1st-m-neprojedu.ogg", "start": 1530315, "end": 1556917, "audio": 1}, {"filename": "/data/sound/start/nl/1st-m-pockej.ogg", "start": 1556917, "end": 1575648, "audio": 1}, {"filename": "/data/sound/start/nl/1st-m-pokud.ogg", "start": 1575648, "end": 1602559, "audio": 1}, {"filename": "/data/sound/start/nl/1st-m-proc.ogg", "start": 1602559, "end": 1619432, "audio": 1}, {"filename": "/data/sound/start/nl/1st-v-chyba.ogg", "start": 1619432, "end": 1652617, "audio": 1}, {"filename": "/data/sound/start/nl/1st-v-davej.ogg", "start": 1652617, "end": 1682363, "audio": 1}, {"filename": "/data/sound/start/nl/1st-v-jedno.ogg", "start": 1682363, "end": 1707013, "audio": 1}, {"filename": "/data/sound/start/nl/1st-v-najit.ogg", "start": 1707013, "end": 1734727, "audio": 1}, {"filename": "/data/sound/start/nl/1st-v-navod1.ogg", "start": 1734727, "end": 1770944, "audio": 1}, {"filename": "/data/sound/start/nl/1st-v-navod5.ogg", "start": 1770944, "end": 1793498, "audio": 1}, {"filename": "/data/sound/start/nl/1st-v-navod7.ogg", "start": 1793498, "end": 1844452, "audio": 1}, {"filename": "/data/sound/start/nl/1st-v-nedostanu.ogg", "start": 1844452, "end": 1872732, "audio": 1}, {"filename": "/data/sound/start/nl/1st-v-nemuzu.ogg", "start": 1872732, "end": 1890663, "audio": 1}, {"filename": "/data/sound/start/nl/1st-v-netusim.ogg", "start": 1890663, "end": 1907281, "audio": 1}, {"filename": "/data/sound/start/nl/1st-v-posunout.ogg", "start": 1907281, "end": 1929455, "audio": 1}, {"filename": "/data/sound/start/nl/1st-v-pribral.ogg", "start": 1929455, "end": 1947909, "audio": 1}, {"filename": "/data/sound/start/nl/1st-v-stiskni.ogg", "start": 1947909, "end": 1973397, "audio": 1}, {"filename": "/data/sound/start/nl/1st-v-takdobre.ogg", "start": 1973397, "end": 1987160, "audio": 1}, {"filename": "/data/sound/start/nl/1st-v-takukaz.ogg", "start": 1987160, "end": 2001166, "audio": 1}, {"filename": "/data/sound/start/nl/1st-v-ven.ogg", "start": 2001166, "end": 2023007, "audio": 1}, {"filename": "/data/sound/start/nl/1st-v-znovu.ogg", "start": 2023007, "end": 2043794, "audio": 1}], "remote_package_size": 2043794, "package_uuid": "614190bb-2dd7-4030-b46f-2c761ebc9283"});

})();
