
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
    var PACKAGE_NAME = 'web/data/city.data';
    var REMOTE_PACKAGE_BASE = 'data/city.data';
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
Module['FS_createPath']('/data/images', 'city', true, true);
Module['FS_createPath']('/data', 'script', true, true);
Module['FS_createPath']('/data/script', 'city', true, true);
Module['FS_createPath']('/data', 'sound', true, true);
Module['FS_createPath']('/data/sound', 'city', true, true);
Module['FS_createPath']('/data/sound/city', 'cs', true, true);
Module['FS_createPath']('/data/sound/city', 'en', true, true);
Module['FS_createPath']('/data/sound/city', 'nl', true, true);

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
              Module['removeRunDependency']('datafile_web/data/city.data');

    };
    Module['addRunDependency']('datafile_web/data/city.data');
  
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
 loadPackage({"files": [{"filename": "/data/images/city/2-ocel.png", "start": 0, "end": 909, "audio": 0}, {"filename": "/data/images/city/3-ocel.png", "start": 909, "end": 1829, "audio": 0}, {"filename": "/data/images/city/hlava_00.png", "start": 1829, "end": 5439, "audio": 0}, {"filename": "/data/images/city/hlava_01.png", "start": 5439, "end": 9105, "audio": 0}, {"filename": "/data/images/city/hlava_02.png", "start": 9105, "end": 12664, "audio": 0}, {"filename": "/data/images/city/hlava_03.png", "start": 12664, "end": 16346, "audio": 0}, {"filename": "/data/images/city/hlava_04.png", "start": 16346, "end": 19935, "audio": 0}, {"filename": "/data/images/city/hlava_05.png", "start": 19935, "end": 23518, "audio": 0}, {"filename": "/data/images/city/hlava_06.png", "start": 23518, "end": 27082, "audio": 0}, {"filename": "/data/images/city/hlava_07.png", "start": 27082, "end": 30617, "audio": 0}, {"filename": "/data/images/city/hlava_08.png", "start": 30617, "end": 34185, "audio": 0}, {"filename": "/data/images/city/hlava_09.png", "start": 34185, "end": 37794, "audio": 0}, {"filename": "/data/images/city/hlava_10.png", "start": 37794, "end": 41404, "audio": 0}, {"filename": "/data/images/city/hlava_11.png", "start": 41404, "end": 45090, "audio": 0}, {"filename": "/data/images/city/hlava_12.png", "start": 45090, "end": 48687, "audio": 0}, {"filename": "/data/images/city/hlava_13.png", "start": 48687, "end": 52264, "audio": 0}, {"filename": "/data/images/city/hlava_14.png", "start": 52264, "end": 55890, "audio": 0}, {"filename": "/data/images/city/hlava_15.png", "start": 55890, "end": 59591, "audio": 0}, {"filename": "/data/images/city/hlava_16.png", "start": 59591, "end": 63194, "audio": 0}, {"filename": "/data/images/city/hlava_17.png", "start": 63194, "end": 66801, "audio": 0}, {"filename": "/data/images/city/hlava_18.png", "start": 66801, "end": 70393, "audio": 0}, {"filename": "/data/images/city/hlava_19.png", "start": 70393, "end": 74077, "audio": 0}, {"filename": "/data/images/city/krab_00.png", "start": 74077, "end": 75160, "audio": 0}, {"filename": "/data/images/city/krab_01.png", "start": 75160, "end": 76238, "audio": 0}, {"filename": "/data/images/city/krab_02.png", "start": 76238, "end": 77302, "audio": 0}, {"filename": "/data/images/city/krab_03.png", "start": 77302, "end": 78374, "audio": 0}, {"filename": "/data/images/city/krab_04.png", "start": 78374, "end": 79452, "audio": 0}, {"filename": "/data/images/city/krab_05.png", "start": 79452, "end": 80533, "audio": 0}, {"filename": "/data/images/city/krab_06.png", "start": 80533, "end": 81664, "audio": 0}, {"filename": "/data/images/city/krab_07.png", "start": 81664, "end": 82781, "audio": 0}, {"filename": "/data/images/city/krab_08.png", "start": 82781, "end": 83848, "audio": 0}, {"filename": "/data/images/city/krab_09.png", "start": 83848, "end": 84958, "audio": 0}, {"filename": "/data/images/city/maly_snek_00.png", "start": 84958, "end": 85632, "audio": 0}, {"filename": "/data/images/city/maly_snek_01.png", "start": 85632, "end": 86329, "audio": 0}, {"filename": "/data/images/city/maly_snek_02.png", "start": 86329, "end": 87046, "audio": 0}, {"filename": "/data/images/city/maly_snek_03.png", "start": 87046, "end": 87706, "audio": 0}, {"filename": "/data/images/city/ornament.png", "start": 87706, "end": 91950, "audio": 0}, {"filename": "/data/images/city/prekladb.png", "start": 91950, "end": 96899, "audio": 0}, {"filename": "/data/images/city/preklad.png", "start": 96899, "end": 101809, "audio": 0}, {"filename": "/data/images/city/ruka.png", "start": 101809, "end": 105167, "audio": 0}, {"filename": "/data/images/city/vitejte1-p.png", "start": 105167, "end": 409670, "audio": 0}, {"filename": "/data/images/city/vitejte1-w.png", "start": 409670, "end": 619550, "audio": 0}, {"filename": "/data/script/city/code.lua", "start": 619550, "end": 648822, "audio": 0}, {"filename": "/data/script/city/dialogs_bg.lua", "start": 648822, "end": 657569, "audio": 0}, {"filename": "/data/script/city/dialogs_cs.lua", "start": 657569, "end": 664511, "audio": 0}, {"filename": "/data/script/city/dialogs_de_CH.lua", "start": 664511, "end": 664847, "audio": 0}, {"filename": "/data/script/city/dialogs_de.lua", "start": 664847, "end": 672181, "audio": 0}, {"filename": "/data/script/city/dialogs_en.lua", "start": 672181, "end": 676351, "audio": 0}, {"filename": "/data/script/city/dialogs_es.lua", "start": 676351, "end": 683701, "audio": 0}, {"filename": "/data/script/city/dialogs_fr.lua", "start": 683701, "end": 690972, "audio": 0}, {"filename": "/data/script/city/dialogs_it.lua", "start": 690972, "end": 698379, "audio": 0}, {"filename": "/data/script/city/dialogs.lua", "start": 698379, "end": 698417, "audio": 0}, {"filename": "/data/script/city/dialogs_nl.lua", "start": 698417, "end": 705606, "audio": 0}, {"filename": "/data/script/city/dialogs_pl.lua", "start": 705606, "end": 712631, "audio": 0}, {"filename": "/data/script/city/dialogs_ru.lua", "start": 712631, "end": 721351, "audio": 0}, {"filename": "/data/script/city/dialogs_sl.lua", "start": 721351, "end": 728392, "audio": 0}, {"filename": "/data/script/city/dialogs_sv.lua", "start": 728392, "end": 735416, "audio": 0}, {"filename": "/data/script/city/init.lua", "start": 735416, "end": 736059, "audio": 0}, {"filename": "/data/script/city/models.lua", "start": 736059, "end": 739707, "audio": 0}, {"filename": "/data/sound/city/cs/vit-hs-demoni0.ogg", "start": 739707, "end": 819300, "audio": 1}, {"filename": "/data/sound/city/cs/vit-hs-dite0.ogg", "start": 819300, "end": 881987, "audio": 1}, {"filename": "/data/sound/city/cs/vit-hs-jidelna1.ogg", "start": 881987, "end": 926680, "audio": 1}, {"filename": "/data/sound/city/cs/vit-hs-jidelna2.ogg", "start": 926680, "end": 938132, "audio": 1}, {"filename": "/data/sound/city/cs/vit-hs-kacir.ogg", "start": 938132, "end": 1024888, "audio": 1}, {"filename": "/data/sound/city/cs/vit-hs-klid1.ogg", "start": 1024888, "end": 1055977, "audio": 1}, {"filename": "/data/sound/city/cs/vit-hs-klid2.ogg", "start": 1055977, "end": 1077775, "audio": 1}, {"filename": "/data/sound/city/cs/vit-hs-klid3.ogg", "start": 1077775, "end": 1109004, "audio": 1}, {"filename": "/data/sound/city/cs/vit-hs-klid4.ogg", "start": 1109004, "end": 1130696, "audio": 1}, {"filename": "/data/sound/city/cs/vit-hs-lod0.ogg", "start": 1130696, "end": 1187421, "audio": 1}, {"filename": "/data/sound/city/cs/vit-hs-pojis0.ogg", "start": 1187421, "end": 1270985, "audio": 1}, {"filename": "/data/sound/city/cs/vit-hs-reklama1.ogg", "start": 1270985, "end": 1283998, "audio": 1}, {"filename": "/data/sound/city/cs/vit-hs-reklama2.ogg", "start": 1283998, "end": 1317558, "audio": 1}, {"filename": "/data/sound/city/cs/vit-hs-reklama3.ogg", "start": 1317558, "end": 1332969, "audio": 1}, {"filename": "/data/sound/city/cs/vit-hs-reklama4.ogg", "start": 1332969, "end": 1376412, "audio": 1}, {"filename": "/data/sound/city/cs/vit-hs-reklama5.ogg", "start": 1376412, "end": 1395586, "audio": 1}, {"filename": "/data/sound/city/cs/vit-hs-soud0.ogg", "start": 1395586, "end": 1451692, "audio": 1}, {"filename": "/data/sound/city/cs/vit-hs-vitejteA.ogg", "start": 1451692, "end": 1481576, "audio": 1}, {"filename": "/data/sound/city/cs/vit-hs-vitejteB.ogg", "start": 1481576, "end": 1522512, "audio": 1}, {"filename": "/data/sound/city/cs/vit-hs-vitejteC.ogg", "start": 1522512, "end": 1556271, "audio": 1}, {"filename": "/data/sound/city/cs/vit-hs-vitejteD.ogg", "start": 1556271, "end": 1598570, "audio": 1}, {"filename": "/data/sound/city/cs/vit-hs-vodovod0.ogg", "start": 1598570, "end": 1645535, "audio": 1}, {"filename": "/data/sound/city/cs/vit-m-hlava.ogg", "start": 1645535, "end": 1662363, "audio": 1}, {"filename": "/data/sound/city/cs/vit-m-jak.ogg", "start": 1662363, "end": 1682257, "audio": 1}, {"filename": "/data/sound/city/cs/vit-m-jakze.ogg", "start": 1682257, "end": 1704564, "audio": 1}, {"filename": "/data/sound/city/cs/vit-m-nebo.ogg", "start": 1704564, "end": 1722150, "audio": 1}, {"filename": "/data/sound/city/cs/vit-m-nechutne.ogg", "start": 1722150, "end": 1736071, "audio": 1}, {"filename": "/data/sound/city/cs/vit-m-nezkusime.ogg", "start": 1736071, "end": 1753171, "audio": 1}, {"filename": "/data/sound/city/cs/vit-m-tak.ogg", "start": 1753171, "end": 1761261, "audio": 1}, {"filename": "/data/sound/city/cs/vit-m-vecnost.ogg", "start": 1761261, "end": 1783394, "audio": 1}, {"filename": "/data/sound/city/cs/vit-v-automat.ogg", "start": 1783394, "end": 1811335, "audio": 1}, {"filename": "/data/sound/city/cs/vit-v-hlava.ogg", "start": 1811335, "end": 1829269, "audio": 1}, {"filename": "/data/sound/city/cs/vit-v-krabi.ogg", "start": 1829269, "end": 1854035, "audio": 1}, {"filename": "/data/sound/city/cs/vit-v-nevsimla.ogg", "start": 1854035, "end": 1882266, "audio": 1}, {"filename": "/data/sound/city/cs/vit-v-noa.ogg", "start": 1882266, "end": 1893571, "audio": 1}, {"filename": "/data/sound/city/cs/vit-v-pockej.ogg", "start": 1893571, "end": 1913097, "audio": 1}, {"filename": "/data/sound/city/cs/vit-v-proc.ogg", "start": 1913097, "end": 1946545, "audio": 1}, {"filename": "/data/sound/city/cs/vit-v-vazne.ogg", "start": 1946545, "end": 1961986, "audio": 1}, {"filename": "/data/sound/city/en/vit-x-beg.ogg", "start": 1961986, "end": 1973198, "audio": 1}, {"filename": "/data/sound/city/en/vit-x-end.ogg", "start": 1973198, "end": 1983823, "audio": 1}, {"filename": "/data/sound/city/nl/vit-m-hlava.ogg", "start": 1983823, "end": 2001137, "audio": 1}, {"filename": "/data/sound/city/nl/vit-m-jak.ogg", "start": 2001137, "end": 2025464, "audio": 1}, {"filename": "/data/sound/city/nl/vit-m-jakze.ogg", "start": 2025464, "end": 2047024, "audio": 1}, {"filename": "/data/sound/city/nl/vit-m-nebo.ogg", "start": 2047024, "end": 2064091, "audio": 1}, {"filename": "/data/sound/city/nl/vit-m-nechutne.ogg", "start": 2064091, "end": 2081442, "audio": 1}, {"filename": "/data/sound/city/nl/vit-m-nezkusime.ogg", "start": 2081442, "end": 2105459, "audio": 1}, {"filename": "/data/sound/city/nl/vit-m-tak.ogg", "start": 2105459, "end": 2120047, "audio": 1}, {"filename": "/data/sound/city/nl/vit-m-vecnost.ogg", "start": 2120047, "end": 2145056, "audio": 1}, {"filename": "/data/sound/city/nl/vit-v-automat.ogg", "start": 2145056, "end": 2180371, "audio": 1}, {"filename": "/data/sound/city/nl/vit-v-hlava.ogg", "start": 2180371, "end": 2202278, "audio": 1}, {"filename": "/data/sound/city/nl/vit-v-krabi.ogg", "start": 2202278, "end": 2228931, "audio": 1}, {"filename": "/data/sound/city/nl/vit-v-nevsimla.ogg", "start": 2228931, "end": 2262848, "audio": 1}, {"filename": "/data/sound/city/nl/vit-v-noa.ogg", "start": 2262848, "end": 2279817, "audio": 1}, {"filename": "/data/sound/city/nl/vit-v-pockej.ogg", "start": 2279817, "end": 2302577, "audio": 1}, {"filename": "/data/sound/city/nl/vit-v-proc.ogg", "start": 2302577, "end": 2344034, "audio": 1}, {"filename": "/data/sound/city/nl/vit-v-vazne.ogg", "start": 2344034, "end": 2362431, "audio": 1}], "remote_package_size": 2362431, "package_uuid": "a6e45475-f859-4924-a1f3-e0c1691076c0"});

})();
