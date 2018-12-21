
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
    var PACKAGE_NAME = 'web/data/briefcase.data';
    var REMOTE_PACKAGE_BASE = 'data/briefcase.data';
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
Module['FS_createPath']('/data/images', 'briefcase', true, true);
Module['FS_createPath']('/data/images', 'demo_briefcase', true, true);
Module['FS_createPath']('/data', 'script', true, true);
Module['FS_createPath']('/data/script', 'briefcase', true, true);
Module['FS_createPath']('/data', 'sound', true, true);
Module['FS_createPath']('/data/sound', 'briefcase', true, true);
Module['FS_createPath']('/data/sound/briefcase', 'cs', true, true);
Module['FS_createPath']('/data/sound/briefcase', 'nl', true, true);

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
              Module['removeRunDependency']('datafile_web/data/briefcase.data');

    };
    Module['addRunDependency']('datafile_web/data/briefcase.data');
  
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
 loadPackage({"files": [{"filename": "/data/images/briefcase/10-ocel.png", "start": 0, "end": 603, "audio": 0}, {"filename": "/data/images/briefcase/4-ocel.png", "start": 603, "end": 2186, "audio": 0}, {"filename": "/data/images/briefcase/cedule.png", "start": 2186, "end": 8395, "audio": 0}, {"filename": "/data/images/briefcase/kanystr.png", "start": 8395, "end": 10608, "audio": 0}, {"filename": "/data/images/briefcase/kladivo.png", "start": 10608, "end": 13388, "audio": 0}, {"filename": "/data/images/briefcase/kleste.png", "start": 13388, "end": 17745, "audio": 0}, {"filename": "/data/images/briefcase/kufr_00.png", "start": 17745, "end": 25220, "audio": 0}, {"filename": "/data/images/briefcase/kufr_01.png", "start": 25220, "end": 35700, "audio": 0}, {"filename": "/data/images/briefcase/kufr_02.png", "start": 35700, "end": 48549, "audio": 0}, {"filename": "/data/images/briefcase/kufr_03.png", "start": 48549, "end": 63475, "audio": 0}, {"filename": "/data/images/briefcase/kufr_04.png", "start": 63475, "end": 79735, "audio": 0}, {"filename": "/data/images/briefcase/kufr_05.png", "start": 79735, "end": 88127, "audio": 0}, {"filename": "/data/images/briefcase/kufr_06.png", "start": 88127, "end": 96762, "audio": 0}, {"filename": "/data/images/briefcase/kufr_07.png", "start": 96762, "end": 106810, "audio": 0}, {"filename": "/data/images/briefcase/kufr_08.png", "start": 106810, "end": 116919, "audio": 0}, {"filename": "/data/images/briefcase/kufr_09.png", "start": 116919, "end": 127264, "audio": 0}, {"filename": "/data/images/briefcase/kufr_10.png", "start": 127264, "end": 136648, "audio": 0}, {"filename": "/data/images/briefcase/kufrik-p.png", "start": 136648, "end": 875082, "audio": 0}, {"filename": "/data/images/briefcase/kufrik-w.png", "start": 875082, "end": 1358528, "audio": 0}, {"filename": "/data/images/briefcase/matka_a.png", "start": 1358528, "end": 1359165, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_000.png", "start": 1359165, "end": 1363384, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_001.png", "start": 1363384, "end": 1364931, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_002.png", "start": 1364931, "end": 1366478, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_003.png", "start": 1366478, "end": 1369435, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_004.png", "start": 1369435, "end": 1381383, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_005.png", "start": 1381383, "end": 1398065, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_006.png", "start": 1398065, "end": 1411173, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_007.png", "start": 1411173, "end": 1423217, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_008.png", "start": 1423217, "end": 1432838, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_009.png", "start": 1432838, "end": 1438323, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_010.png", "start": 1438323, "end": 1447392, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_011.png", "start": 1447392, "end": 1458807, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_012.png", "start": 1458807, "end": 1470509, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_013.png", "start": 1470509, "end": 1483040, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_014.png", "start": 1483040, "end": 1494280, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_015.png", "start": 1494280, "end": 1502358, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_016.png", "start": 1502358, "end": 1512463, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_017.png", "start": 1512463, "end": 1524449, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_018.png", "start": 1524449, "end": 1536779, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_019.png", "start": 1536779, "end": 1549013, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_020.png", "start": 1549013, "end": 1559641, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_021.png", "start": 1559641, "end": 1565715, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_022.png", "start": 1565715, "end": 1575536, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_023.png", "start": 1575536, "end": 1587325, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_024.png", "start": 1587325, "end": 1599333, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_025.png", "start": 1599333, "end": 1611955, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_026.png", "start": 1611955, "end": 1623256, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_027.png", "start": 1623256, "end": 1631659, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_028.png", "start": 1631659, "end": 1642061, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_029.png", "start": 1642061, "end": 1654746, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_030.png", "start": 1654746, "end": 1667307, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_031.png", "start": 1667307, "end": 1679364, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_032.png", "start": 1679364, "end": 1688948, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_033.png", "start": 1688948, "end": 1694468, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_034.png", "start": 1694468, "end": 1703604, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_035.png", "start": 1703604, "end": 1715067, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_036.png", "start": 1715067, "end": 1726828, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_037.png", "start": 1726828, "end": 1739365, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_038.png", "start": 1739365, "end": 1750600, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_039.png", "start": 1750600, "end": 1758676, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_040.png", "start": 1758676, "end": 1768791, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_041.png", "start": 1768791, "end": 1780786, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_042.png", "start": 1780786, "end": 1793016, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_043.png", "start": 1793016, "end": 1805187, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_044.png", "start": 1805187, "end": 1815778, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_045.png", "start": 1815778, "end": 1821807, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_046.png", "start": 1821807, "end": 1831586, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_047.png", "start": 1831586, "end": 1843333, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_048.png", "start": 1843333, "end": 1855324, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_049.png", "start": 1855324, "end": 1867973, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_050.png", "start": 1867973, "end": 1879235, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_051.png", "start": 1879235, "end": 1887630, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_052.png", "start": 1887630, "end": 1889564, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_053.png", "start": 1889564, "end": 1891623, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_054.png", "start": 1891623, "end": 1893500, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_055.png", "start": 1893500, "end": 1895571, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_056.png", "start": 1895571, "end": 1959185, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_057.png", "start": 1959185, "end": 1985865, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_058.png", "start": 1985865, "end": 2009213, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_059.png", "start": 2009213, "end": 2036156, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_060.png", "start": 2036156, "end": 2063450, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_061.png", "start": 2063450, "end": 2072159, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_062.png", "start": 2072159, "end": 2093305, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_062__ru.png", "start": 2093305, "end": 2123078, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_063.png", "start": 2123078, "end": 2153318, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_064.png", "start": 2153318, "end": 2154970, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_065.png", "start": 2154970, "end": 2156627, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_066.png", "start": 2156627, "end": 2158287, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_067.png", "start": 2158287, "end": 2159904, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_068.png", "start": 2159904, "end": 2161569, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_069.png", "start": 2161569, "end": 2163262, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_070.png", "start": 2163262, "end": 2164858, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_071.png", "start": 2164858, "end": 2166468, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_072.png", "start": 2166468, "end": 2168548, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_073.png", "start": 2168548, "end": 2170228, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_074.png", "start": 2170228, "end": 2172696, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_075.png", "start": 2172696, "end": 2174725, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_076.png", "start": 2174725, "end": 2179573, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_077.png", "start": 2179573, "end": 2181763, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_078.png", "start": 2181763, "end": 2183393, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_079.png", "start": 2183393, "end": 2185192, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_080.png", "start": 2185192, "end": 2186864, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_081.png", "start": 2186864, "end": 2188551, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_082.png", "start": 2188551, "end": 2190442, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_083.png", "start": 2190442, "end": 2192129, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_084.png", "start": 2192129, "end": 2193978, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_085.png", "start": 2193978, "end": 2196021, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_086.png", "start": 2196021, "end": 2198037, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_087.png", "start": 2198037, "end": 2200095, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_088.png", "start": 2200095, "end": 2201784, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_089.png", "start": 2201784, "end": 2205367, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_090.png", "start": 2205367, "end": 2208367, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_091.png", "start": 2208367, "end": 2210834, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_092.png", "start": 2210834, "end": 2212501, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_093.png", "start": 2212501, "end": 2214155, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_094.png", "start": 2214155, "end": 2215708, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_095.png", "start": 2215708, "end": 2250233, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_096.png", "start": 2250233, "end": 2280233, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_097.png", "start": 2280233, "end": 2303242, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_098.png", "start": 2303242, "end": 2325101, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_099.png", "start": 2325101, "end": 2344681, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_100.png", "start": 2344681, "end": 2362286, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_101.png", "start": 2362286, "end": 2378489, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_102.png", "start": 2378489, "end": 2393309, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_103.png", "start": 2393309, "end": 2407036, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_104.png", "start": 2407036, "end": 2419031, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_105.png", "start": 2419031, "end": 2429545, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_106.png", "start": 2429545, "end": 2438308, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_107.png", "start": 2438308, "end": 2445896, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_108.png", "start": 2445896, "end": 2452612, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_109.png", "start": 2452612, "end": 2458369, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_110.png", "start": 2458369, "end": 2463327, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_111.png", "start": 2463327, "end": 2467308, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_112.png", "start": 2467308, "end": 2470617, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_113.png", "start": 2470617, "end": 2473324, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_114.png", "start": 2473324, "end": 2476519, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_115.png", "start": 2476519, "end": 2479637, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_116.png", "start": 2479637, "end": 2482367, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_117.png", "start": 2482367, "end": 2485074, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_118.png", "start": 2485074, "end": 2488269, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_119.png", "start": 2488269, "end": 2491387, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_120.png", "start": 2491387, "end": 2494117, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_121.png", "start": 2494117, "end": 2496824, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_122.png", "start": 2496824, "end": 2500019, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_123.png", "start": 2500019, "end": 2503137, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_124.png", "start": 2503137, "end": 2505867, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_125.png", "start": 2505867, "end": 2527027, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_125__ru.png", "start": 2527027, "end": 2556800, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_126.png", "start": 2556800, "end": 2586555, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_127.png", "start": 2586555, "end": 2588366, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_128.png", "start": 2588366, "end": 2590709, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_129.png", "start": 2590709, "end": 2593629, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_130.png", "start": 2593629, "end": 2597135, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_131.png", "start": 2597135, "end": 2601291, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_132.png", "start": 2601291, "end": 2605989, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_133.png", "start": 2605989, "end": 2611114, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_134.png", "start": 2611114, "end": 2616634, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_135.png", "start": 2616634, "end": 2622373, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_136.png", "start": 2622373, "end": 2628247, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_137.png", "start": 2628247, "end": 2634250, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_138.png", "start": 2634250, "end": 2639955, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_139.png", "start": 2639955, "end": 2646343, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_140.png", "start": 2646343, "end": 2652629, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_141.png", "start": 2652629, "end": 2657673, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_142.png", "start": 2657673, "end": 2663143, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_143.png", "start": 2663143, "end": 2668478, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_144.png", "start": 2668478, "end": 2673275, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_145.png", "start": 2673275, "end": 2678379, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_146.png", "start": 2678379, "end": 2683778, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_147.png", "start": 2683778, "end": 2689648, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_148.png", "start": 2689648, "end": 2695205, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_149.png", "start": 2695205, "end": 2701009, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_150.png", "start": 2701009, "end": 2706755, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_151.png", "start": 2706755, "end": 2712155, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_152.png", "start": 2712155, "end": 2717823, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_153.png", "start": 2717823, "end": 2724584, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_154.png", "start": 2724584, "end": 2731775, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_155.png", "start": 2731775, "end": 2738601, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_156.png", "start": 2738601, "end": 2744891, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_157.png", "start": 2744891, "end": 2749725, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_158.png", "start": 2749725, "end": 2754106, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_159.png", "start": 2754106, "end": 2757649, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_160.png", "start": 2757649, "end": 2761218, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_161.png", "start": 2761218, "end": 2764787, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_162.png", "start": 2764787, "end": 2768333, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_163.png", "start": 2768333, "end": 2771857, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_164.png", "start": 2771857, "end": 2775387, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_165.png", "start": 2775387, "end": 2778914, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_166.png", "start": 2778914, "end": 2782533, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_167.png", "start": 2782533, "end": 2785440, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_168.png", "start": 2785440, "end": 2788411, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_169.png", "start": 2788411, "end": 2790895, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_170.png", "start": 2790895, "end": 2836011, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_171.png", "start": 2836011, "end": 2842376, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_172.png", "start": 2842376, "end": 2844322, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_173.png", "start": 2844322, "end": 2864507, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_174.png", "start": 2864507, "end": 2869954, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_175.png", "start": 2869954, "end": 2875209, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_176.png", "start": 2875209, "end": 2896534, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_177.png", "start": 2896534, "end": 2917947, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_178.png", "start": 2917947, "end": 2923740, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_179.png", "start": 2923740, "end": 2928185, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_180.png", "start": 2928185, "end": 2933808, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_181.png", "start": 2933808, "end": 2940844, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_182.png", "start": 2940844, "end": 2948194, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_183.png", "start": 2948194, "end": 2950500, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_184.png", "start": 2950500, "end": 2952772, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_185.png", "start": 2952772, "end": 2955905, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_186.png", "start": 2955905, "end": 2971902, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_187.png", "start": 2971902, "end": 2973948, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_188.png", "start": 2973948, "end": 2977262, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_189.png", "start": 2977262, "end": 2982017, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_190.png", "start": 2982017, "end": 2987823, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_191.png", "start": 2987823, "end": 2994509, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_192.png", "start": 2994509, "end": 3001615, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_193.png", "start": 3001615, "end": 3010691, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_194.png", "start": 3010691, "end": 3019580, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_195.png", "start": 3019580, "end": 3027965, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_196.png", "start": 3027965, "end": 3040085, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_197.png", "start": 3040085, "end": 3066132, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_198.png", "start": 3066132, "end": 3090064, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_199.png", "start": 3090064, "end": 3114202, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_200.png", "start": 3114202, "end": 3138119, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_201.png", "start": 3138119, "end": 3161396, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_202.png", "start": 3161396, "end": 3184349, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_203.png", "start": 3184349, "end": 3206768, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_204.png", "start": 3206768, "end": 3228867, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_205.png", "start": 3228867, "end": 3250480, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_206.png", "start": 3250480, "end": 3271544, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_207.png", "start": 3271544, "end": 3292455, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_208.png", "start": 3292455, "end": 3313717, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_209.png", "start": 3313717, "end": 3330943, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_210.png", "start": 3330943, "end": 3343505, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_211.png", "start": 3343505, "end": 3353103, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_212.png", "start": 3353103, "end": 3360928, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_213.png", "start": 3360928, "end": 3367507, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_214.png", "start": 3367507, "end": 3373172, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_215.png", "start": 3373172, "end": 3378207, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_216.png", "start": 3378207, "end": 3382723, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_217.png", "start": 3382723, "end": 3386845, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_218.png", "start": 3386845, "end": 3390602, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_219.png", "start": 3390602, "end": 3393965, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_220.png", "start": 3393965, "end": 3452025, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_221.png", "start": 3452025, "end": 3492613, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_222.png", "start": 3492613, "end": 3534607, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_223.png", "start": 3534607, "end": 3594399, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_224.png", "start": 3594399, "end": 3601437, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_225.png", "start": 3601437, "end": 3608354, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_226.png", "start": 3608354, "end": 3615361, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_227.png", "start": 3615361, "end": 3622293, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_228.png", "start": 3622293, "end": 3629390, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_229.png", "start": 3629390, "end": 3636385, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_230.png", "start": 3636385, "end": 3643490, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_231.png", "start": 3643490, "end": 3650450, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_232.png", "start": 3650450, "end": 3657486, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_233.png", "start": 3657486, "end": 3664407, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_234.png", "start": 3664407, "end": 3671410, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_235.png", "start": 3671410, "end": 3678330, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_236.png", "start": 3678330, "end": 3685447, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_237.png", "start": 3685447, "end": 3692464, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_238.png", "start": 3692464, "end": 3699579, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_239.png", "start": 3699579, "end": 3706512, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_240.png", "start": 3706512, "end": 3713576, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_241.png", "start": 3713576, "end": 3720510, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_242.png", "start": 3720510, "end": 3727513, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_243.png", "start": 3727513, "end": 3734433, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_244.png", "start": 3734433, "end": 3741550, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_245.png", "start": 3741550, "end": 3748567, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_246.png", "start": 3748567, "end": 3755682, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_247.png", "start": 3755682, "end": 3763565, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_248.png", "start": 3763565, "end": 3765521, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_249.png", "start": 3765521, "end": 3768462, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_250.png", "start": 3768462, "end": 3771776, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_251.png", "start": 3771776, "end": 3775341, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_252.png", "start": 3775341, "end": 3779067, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_253.png", "start": 3779067, "end": 3783406, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_254.png", "start": 3783406, "end": 3788335, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_255.png", "start": 3788335, "end": 3793495, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_256.png", "start": 3793495, "end": 3799563, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_257.png", "start": 3799563, "end": 3806321, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_258.png", "start": 3806321, "end": 3819539, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_259.png", "start": 3819539, "end": 3832854, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_260.png", "start": 3832854, "end": 3844516, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_261.png", "start": 3844516, "end": 3856776, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_262.png", "start": 3856776, "end": 3869141, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_263.png", "start": 3869141, "end": 3881461, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_264.png", "start": 3881461, "end": 3893655, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_265.png", "start": 3893655, "end": 3910204, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_266.png", "start": 3910204, "end": 3927946, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_267.png", "start": 3927946, "end": 3947106, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_268.png", "start": 3947106, "end": 3968246, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_269.png", "start": 3968246, "end": 3991046, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_270.png", "start": 3991046, "end": 4014815, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_271.png", "start": 4014815, "end": 4038273, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_272.png", "start": 4038273, "end": 4061181, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_273.png", "start": 4061181, "end": 4083694, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_274.png", "start": 4083694, "end": 4105571, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_275.png", "start": 4105571, "end": 4126061, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_276.png", "start": 4126061, "end": 4147728, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_277.png", "start": 4147728, "end": 4170159, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_278.png", "start": 4170159, "end": 4192828, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_279.png", "start": 4192828, "end": 4215360, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_280.png", "start": 4215360, "end": 4217574, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_281.png", "start": 4217574, "end": 4220712, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_282.png", "start": 4220712, "end": 4226381, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_283.png", "start": 4226381, "end": 4234319, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_284.png", "start": 4234319, "end": 4243840, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_285.png", "start": 4243840, "end": 4254004, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_286.png", "start": 4254004, "end": 4266167, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_287.png", "start": 4266167, "end": 4280797, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_288.png", "start": 4280797, "end": 4296532, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_289.png", "start": 4296532, "end": 4312962, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_290.png", "start": 4312962, "end": 4327487, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_291.png", "start": 4327487, "end": 4365319, "audio": 0}, {"filename": "/data/images/demo_briefcase/demo_292.png", "start": 4365319, "end": 4374802, "audio": 0}, {"filename": "/data/images/demo_briefcase/kufr256.png", "start": 4374802, "end": 4470718, "audio": 0}, {"filename": "/data/script/briefcase/brief_dialogs_bg.lua", "start": 4470718, "end": 4476120, "audio": 0}, {"filename": "/data/script/briefcase/brief_dialogs_cs.lua", "start": 4476120, "end": 4480146, "audio": 0}, {"filename": "/data/script/briefcase/brief_dialogs_de_CH.lua", "start": 4480146, "end": 4481714, "audio": 0}, {"filename": "/data/script/briefcase/brief_dialogs_de.lua", "start": 4481714, "end": 4486057, "audio": 0}, {"filename": "/data/script/briefcase/brief_dialogs_en.lua", "start": 4486057, "end": 4488254, "audio": 0}, {"filename": "/data/script/briefcase/brief_dialogs_eo.lua", "start": 4488254, "end": 4492111, "audio": 0}, {"filename": "/data/script/briefcase/brief_dialogs_es.lua", "start": 4492111, "end": 4496375, "audio": 0}, {"filename": "/data/script/briefcase/brief_dialogs_fr.lua", "start": 4496375, "end": 4500626, "audio": 0}, {"filename": "/data/script/briefcase/brief_dialogs_it.lua", "start": 4500626, "end": 4504837, "audio": 0}, {"filename": "/data/script/briefcase/brief_dialogs_nl.lua", "start": 4504837, "end": 4509145, "audio": 0}, {"filename": "/data/script/briefcase/brief_dialogs_pl.lua", "start": 4509145, "end": 4513333, "audio": 0}, {"filename": "/data/script/briefcase/brief_dialogs_ru.lua", "start": 4513333, "end": 4518697, "audio": 0}, {"filename": "/data/script/briefcase/brief_dialogs_sl.lua", "start": 4518697, "end": 4522729, "audio": 0}, {"filename": "/data/script/briefcase/brief_dialogs_sv.lua", "start": 4522729, "end": 4526849, "audio": 0}, {"filename": "/data/script/briefcase/code.lua", "start": 4526849, "end": 4535315, "audio": 0}, {"filename": "/data/script/briefcase/demo_briefcase.lua", "start": 4535315, "end": 4539473, "audio": 0}, {"filename": "/data/script/briefcase/demo_help.lua", "start": 4539473, "end": 4550216, "audio": 0}, {"filename": "/data/script/briefcase/dialogs_bg.lua", "start": 4550216, "end": 4558883, "audio": 0}, {"filename": "/data/script/briefcase/dialogs_cs.lua", "start": 4558883, "end": 4565763, "audio": 0}, {"filename": "/data/script/briefcase/dialogs_de_CH.lua", "start": 4565763, "end": 4566142, "audio": 0}, {"filename": "/data/script/briefcase/dialogs_de.lua", "start": 4566142, "end": 4573527, "audio": 0}, {"filename": "/data/script/briefcase/dialogs_en.lua", "start": 4573527, "end": 4577537, "audio": 0}, {"filename": "/data/script/briefcase/dialogs_es.lua", "start": 4577537, "end": 4584842, "audio": 0}, {"filename": "/data/script/briefcase/dialogs_fr.lua", "start": 4584842, "end": 4592237, "audio": 0}, {"filename": "/data/script/briefcase/dialogs_it.lua", "start": 4592237, "end": 4599342, "audio": 0}, {"filename": "/data/script/briefcase/dialogs.lua", "start": 4599342, "end": 4599380, "audio": 0}, {"filename": "/data/script/briefcase/dialogs_nl.lua", "start": 4599380, "end": 4606646, "audio": 0}, {"filename": "/data/script/briefcase/dialogs_pl.lua", "start": 4606646, "end": 4613872, "audio": 0}, {"filename": "/data/script/briefcase/dialogs_ru.lua", "start": 4613872, "end": 4623087, "audio": 0}, {"filename": "/data/script/briefcase/dialogs_sl.lua", "start": 4623087, "end": 4630073, "audio": 0}, {"filename": "/data/script/briefcase/dialogs_sv.lua", "start": 4630073, "end": 4637234, "audio": 0}, {"filename": "/data/script/briefcase/init.lua", "start": 4637234, "end": 4637882, "audio": 0}, {"filename": "/data/script/briefcase/models.lua", "start": 4637882, "end": 4641139, "audio": 0}, {"filename": "/data/sound/briefcase/cs/help10.ogg", "start": 4641139, "end": 4680587, "audio": 1}, {"filename": "/data/sound/briefcase/cs/help11.ogg", "start": 4680587, "end": 4704062, "audio": 1}, {"filename": "/data/sound/briefcase/cs/help12.ogg", "start": 4704062, "end": 4735809, "audio": 1}, {"filename": "/data/sound/briefcase/cs/help13.ogg", "start": 4735809, "end": 4779458, "audio": 1}, {"filename": "/data/sound/briefcase/cs/help14.ogg", "start": 4779458, "end": 4811936, "audio": 1}, {"filename": "/data/sound/briefcase/cs/help15.ogg", "start": 4811936, "end": 4833332, "audio": 1}, {"filename": "/data/sound/briefcase/cs/help16.ogg", "start": 4833332, "end": 4879768, "audio": 1}, {"filename": "/data/sound/briefcase/cs/help17.ogg", "start": 4879768, "end": 4894559, "audio": 1}, {"filename": "/data/sound/briefcase/cs/help18.ogg", "start": 4894559, "end": 4929922, "audio": 1}, {"filename": "/data/sound/briefcase/cs/help19.ogg", "start": 4929922, "end": 4968000, "audio": 1}, {"filename": "/data/sound/briefcase/cs/help1.ogg", "start": 4968000, "end": 5008464, "audio": 1}, {"filename": "/data/sound/briefcase/cs/help20.ogg", "start": 5008464, "end": 5039311, "audio": 1}, {"filename": "/data/sound/briefcase/cs/help21.ogg", "start": 5039311, "end": 5067299, "audio": 1}, {"filename": "/data/sound/briefcase/cs/help22.ogg", "start": 5067299, "end": 5117271, "audio": 1}, {"filename": "/data/sound/briefcase/cs/help23.ogg", "start": 5117271, "end": 5184623, "audio": 1}, {"filename": "/data/sound/briefcase/cs/help2.ogg", "start": 5184623, "end": 5223387, "audio": 1}, {"filename": "/data/sound/briefcase/cs/help3.ogg", "start": 5223387, "end": 5244910, "audio": 1}, {"filename": "/data/sound/briefcase/cs/help4.ogg", "start": 5244910, "end": 5260033, "audio": 1}, {"filename": "/data/sound/briefcase/cs/help5.ogg", "start": 5260033, "end": 5283383, "audio": 1}, {"filename": "/data/sound/briefcase/cs/help6.ogg", "start": 5283383, "end": 5316929, "audio": 1}, {"filename": "/data/sound/briefcase/cs/help7.ogg", "start": 5316929, "end": 5354273, "audio": 1}, {"filename": "/data/sound/briefcase/cs/help8.ogg", "start": 5354273, "end": 5377146, "audio": 1}, {"filename": "/data/sound/briefcase/cs/help9.ogg", "start": 5377146, "end": 5409032, "audio": 1}, {"filename": "/data/sound/briefcase/cs/kd-bermudy.ogg", "start": 5409032, "end": 5465089, "audio": 1}, {"filename": "/data/sound/briefcase/cs/kd-elektr.ogg", "start": 5465089, "end": 5525416, "audio": 1}, {"filename": "/data/sound/briefcase/cs/kd-gral.ogg", "start": 5525416, "end": 5549700, "audio": 1}, {"filename": "/data/sound/briefcase/cs/kd-mesto.ogg", "start": 5549700, "end": 5617070, "audio": 1}, {"filename": "/data/sound/briefcase/cs/kd-pocitac.ogg", "start": 5617070, "end": 5690106, "audio": 1}, {"filename": "/data/sound/briefcase/cs/kd-silver.ogg", "start": 5690106, "end": 5771917, "audio": 1}, {"filename": "/data/sound/briefcase/cs/kd-ufo.ogg", "start": 5771917, "end": 5883297, "audio": 1}, {"filename": "/data/sound/briefcase/cs/kd-uvod.ogg", "start": 5883297, "end": 5944542, "audio": 1}, {"filename": "/data/sound/briefcase/cs/kd-zaver.ogg", "start": 5944542, "end": 6003543, "audio": 1}, {"filename": "/data/sound/briefcase/cs/kd-zelva.ogg", "start": 6003543, "end": 6079432, "audio": 1}, {"filename": "/data/sound/briefcase/cs/kd-znici.ogg", "start": 6079432, "end": 6098905, "audio": 1}, {"filename": "/data/sound/briefcase/cs/kuf-m-disk.ogg", "start": 6098905, "end": 6116660, "audio": 1}, {"filename": "/data/sound/briefcase/cs/kuf-m-dodilny.ogg", "start": 6116660, "end": 6149097, "audio": 1}, {"filename": "/data/sound/briefcase/cs/kuf-m-je.ogg", "start": 6149097, "end": 6166638, "audio": 1}, {"filename": "/data/sound/briefcase/cs/kuf-m-kousek.ogg", "start": 6166638, "end": 6188832, "audio": 1}, {"filename": "/data/sound/briefcase/cs/kuf-m-nezvednu.ogg", "start": 6188832, "end": 6204358, "audio": 1}, {"filename": "/data/sound/briefcase/cs/kuf-m-pravda.ogg", "start": 6204358, "end": 6215220, "audio": 1}, {"filename": "/data/sound/briefcase/cs/kuf-m-ven.ogg", "start": 6215220, "end": 6237839, "audio": 1}, {"filename": "/data/sound/briefcase/cs/kuf-v-doprace.ogg", "start": 6237839, "end": 6254100, "audio": 1}, {"filename": "/data/sound/briefcase/cs/kuf-v-dotoho.ogg", "start": 6254100, "end": 6274476, "audio": 1}, {"filename": "/data/sound/briefcase/cs/kuf-v-hod.ogg", "start": 6274476, "end": 6291365, "audio": 1}, {"filename": "/data/sound/briefcase/cs/kuf-v-jeste.ogg", "start": 6291365, "end": 6308738, "audio": 1}, {"filename": "/data/sound/briefcase/cs/kuf-v-napad.ogg", "start": 6308738, "end": 6320311, "audio": 1}, {"filename": "/data/sound/briefcase/cs/kuf-v-noco.ogg", "start": 6320311, "end": 6334376, "audio": 1}, {"filename": "/data/sound/briefcase/cs/kuf-v-restart.ogg", "start": 6334376, "end": 6352560, "audio": 1}, {"filename": "/data/sound/briefcase/cs/kuf-v-ukol.ogg", "start": 6352560, "end": 6374553, "audio": 1}, {"filename": "/data/sound/briefcase/nl/help10.ogg", "start": 6374553, "end": 6409732, "audio": 1}, {"filename": "/data/sound/briefcase/nl/help11.ogg", "start": 6409732, "end": 6435140, "audio": 1}, {"filename": "/data/sound/briefcase/nl/help12.ogg", "start": 6435140, "end": 6469487, "audio": 1}, {"filename": "/data/sound/briefcase/nl/help13.ogg", "start": 6469487, "end": 6501257, "audio": 1}, {"filename": "/data/sound/briefcase/nl/help14.ogg", "start": 6501257, "end": 6540128, "audio": 1}, {"filename": "/data/sound/briefcase/nl/help15.ogg", "start": 6540128, "end": 6563660, "audio": 1}, {"filename": "/data/sound/briefcase/nl/help16.ogg", "start": 6563660, "end": 6599411, "audio": 1}, {"filename": "/data/sound/briefcase/nl/help17.ogg", "start": 6599411, "end": 6632293, "audio": 1}, {"filename": "/data/sound/briefcase/nl/help18.ogg", "start": 6632293, "end": 6666963, "audio": 1}, {"filename": "/data/sound/briefcase/nl/help19.ogg", "start": 6666963, "end": 6713697, "audio": 1}, {"filename": "/data/sound/briefcase/nl/help1.ogg", "start": 6713697, "end": 6754016, "audio": 1}, {"filename": "/data/sound/briefcase/nl/help20.ogg", "start": 6754016, "end": 6787856, "audio": 1}, {"filename": "/data/sound/briefcase/nl/help21.ogg", "start": 6787856, "end": 6818496, "audio": 1}, {"filename": "/data/sound/briefcase/nl/help22.ogg", "start": 6818496, "end": 6859767, "audio": 1}, {"filename": "/data/sound/briefcase/nl/help23.ogg", "start": 6859767, "end": 6908194, "audio": 1}, {"filename": "/data/sound/briefcase/nl/help2.ogg", "start": 6908194, "end": 6949066, "audio": 1}, {"filename": "/data/sound/briefcase/nl/help3.ogg", "start": 6949066, "end": 6971453, "audio": 1}, {"filename": "/data/sound/briefcase/nl/help4.ogg", "start": 6971453, "end": 6993034, "audio": 1}, {"filename": "/data/sound/briefcase/nl/help5.ogg", "start": 6993034, "end": 7016226, "audio": 1}, {"filename": "/data/sound/briefcase/nl/help6.ogg", "start": 7016226, "end": 7042698, "audio": 1}, {"filename": "/data/sound/briefcase/nl/help7.ogg", "start": 7042698, "end": 7082002, "audio": 1}, {"filename": "/data/sound/briefcase/nl/help8.ogg", "start": 7082002, "end": 7110478, "audio": 1}, {"filename": "/data/sound/briefcase/nl/help9.ogg", "start": 7110478, "end": 7137921, "audio": 1}, {"filename": "/data/sound/briefcase/nl/kuf-m-disk.ogg", "start": 7137921, "end": 7159111, "audio": 1}, {"filename": "/data/sound/briefcase/nl/kuf-m-dodilny.ogg", "start": 7159111, "end": 7194193, "audio": 1}, {"filename": "/data/sound/briefcase/nl/kuf-m-je.ogg", "start": 7194193, "end": 7211223, "audio": 1}, {"filename": "/data/sound/briefcase/nl/kuf-m-kousek.ogg", "start": 7211223, "end": 7233895, "audio": 1}, {"filename": "/data/sound/briefcase/nl/kuf-m-nezvednu.ogg", "start": 7233895, "end": 7257227, "audio": 1}, {"filename": "/data/sound/briefcase/nl/kuf-m-pravda.ogg", "start": 7257227, "end": 7271994, "audio": 1}, {"filename": "/data/sound/briefcase/nl/kuf-m-ven.ogg", "start": 7271994, "end": 7295027, "audio": 1}, {"filename": "/data/sound/briefcase/nl/kuf-v-doprace.ogg", "start": 7295027, "end": 7315455, "audio": 1}, {"filename": "/data/sound/briefcase/nl/kuf-v-dotoho.ogg", "start": 7315455, "end": 7335034, "audio": 1}, {"filename": "/data/sound/briefcase/nl/kuf-v-hod.ogg", "start": 7335034, "end": 7366467, "audio": 1}, {"filename": "/data/sound/briefcase/nl/kuf-v-jeste.ogg", "start": 7366467, "end": 7387110, "audio": 1}, {"filename": "/data/sound/briefcase/nl/kuf-v-napad.ogg", "start": 7387110, "end": 7402821, "audio": 1}, {"filename": "/data/sound/briefcase/nl/kuf-v-noco.ogg", "start": 7402821, "end": 7426203, "audio": 1}, {"filename": "/data/sound/briefcase/nl/kuf-v-restart.ogg", "start": 7426203, "end": 7447893, "audio": 1}, {"filename": "/data/sound/briefcase/nl/kuf-v-ukol.ogg", "start": 7447893, "end": 7474919, "audio": 1}], "remote_package_size": 7474919, "package_uuid": "df90dc84-65c8-48ae-969f-4f89f58b21b6"});

})();
