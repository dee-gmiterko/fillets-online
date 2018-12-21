
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
    var PACKAGE_NAME = 'web/data/barrel.data';
    var REMOTE_PACKAGE_BASE = 'data/barrel.data';
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
Module['FS_createPath']('/data/images', 'barrel', true, true);
Module['FS_createPath']('/data', 'script', true, true);
Module['FS_createPath']('/data/script', 'barrel', true, true);
Module['FS_createPath']('/data', 'sound', true, true);
Module['FS_createPath']('/data/sound', 'barrel', true, true);
Module['FS_createPath']('/data/sound/barrel', 'cs', true, true);
Module['FS_createPath']('/data/sound/barrel', 'en', true, true);
Module['FS_createPath']('/data/sound/barrel', 'nl', true, true);

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
              Module['removeRunDependency']('datafile_web/data/barrel.data');

    };
    Module['addRunDependency']('datafile_web/data/barrel.data');
  
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
 loadPackage({"files": [{"filename": "/data/images/barrel/12-ocel.png", "start": 0, "end": 1534, "audio": 0}, {"filename": "/data/images/barrel/18-ocel.png", "start": 1534, "end": 3476, "audio": 0}, {"filename": "/data/images/barrel/baget_00.png", "start": 3476, "end": 7510, "audio": 0}, {"filename": "/data/images/barrel/baget_01.png", "start": 7510, "end": 11579, "audio": 0}, {"filename": "/data/images/barrel/barel_00.png", "start": 11579, "end": 60615, "audio": 0}, {"filename": "/data/images/barrel/barel_01.png", "start": 60615, "end": 109804, "audio": 0}, {"filename": "/data/images/barrel/barel_02.png", "start": 109804, "end": 158679, "audio": 0}, {"filename": "/data/images/barrel/barel_03.png", "start": 158679, "end": 207873, "audio": 0}, {"filename": "/data/images/barrel/barel_04.png", "start": 207873, "end": 256973, "audio": 0}, {"filename": "/data/images/barrel/barely-okoli.png", "start": 256973, "end": 620154, "audio": 0}, {"filename": "/data/images/barrel/barely-poz.png", "start": 620154, "end": 961286, "audio": 0}, {"filename": "/data/images/barrel/double1_00.png", "start": 961286, "end": 964632, "audio": 0}, {"filename": "/data/images/barrel/double1_01.png", "start": 964632, "end": 968022, "audio": 0}, {"filename": "/data/images/barrel/double1_02.png", "start": 968022, "end": 971362, "audio": 0}, {"filename": "/data/images/barrel/double1_03.png", "start": 971362, "end": 974653, "audio": 0}, {"filename": "/data/images/barrel/double1_04.png", "start": 974653, "end": 978038, "audio": 0}, {"filename": "/data/images/barrel/double1_05.png", "start": 978038, "end": 981423, "audio": 0}, {"filename": "/data/images/barrel/double1_06.png", "start": 981423, "end": 984826, "audio": 0}, {"filename": "/data/images/barrel/double2_00.png", "start": 984826, "end": 988326, "audio": 0}, {"filename": "/data/images/barrel/double2_01.png", "start": 988326, "end": 991868, "audio": 0}, {"filename": "/data/images/barrel/double2_02.png", "start": 991868, "end": 995319, "audio": 0}, {"filename": "/data/images/barrel/double2_03.png", "start": 995319, "end": 998798, "audio": 0}, {"filename": "/data/images/barrel/double2_04.png", "start": 998798, "end": 1002326, "audio": 0}, {"filename": "/data/images/barrel/double2_05.png", "start": 1002326, "end": 1005901, "audio": 0}, {"filename": "/data/images/barrel/double2_06.png", "start": 1005901, "end": 1009442, "audio": 0}, {"filename": "/data/images/barrel/had_00.png", "start": 1009442, "end": 1019940, "audio": 0}, {"filename": "/data/images/barrel/had_01.png", "start": 1019940, "end": 1030856, "audio": 0}, {"filename": "/data/images/barrel/had_02.png", "start": 1030856, "end": 1042033, "audio": 0}, {"filename": "/data/images/barrel/had_03.png", "start": 1042033, "end": 1053280, "audio": 0}, {"filename": "/data/images/barrel/had_04.png", "start": 1053280, "end": 1063688, "audio": 0}, {"filename": "/data/images/barrel/had_05.png", "start": 1063688, "end": 1074506, "audio": 0}, {"filename": "/data/images/barrel/had_06.png", "start": 1074506, "end": 1085598, "audio": 0}, {"filename": "/data/images/barrel/had_07.png", "start": 1085598, "end": 1096738, "audio": 0}, {"filename": "/data/images/barrel/had_08.png", "start": 1096738, "end": 1107093, "audio": 0}, {"filename": "/data/images/barrel/had_09.png", "start": 1107093, "end": 1117860, "audio": 0}, {"filename": "/data/images/barrel/had_10.png", "start": 1117860, "end": 1128885, "audio": 0}, {"filename": "/data/images/barrel/had_11.png", "start": 1128885, "end": 1139965, "audio": 0}, {"filename": "/data/images/barrel/hlubinna_00.png", "start": 1139965, "end": 1144193, "audio": 0}, {"filename": "/data/images/barrel/hlubinna_01.png", "start": 1144193, "end": 1148385, "audio": 0}, {"filename": "/data/images/barrel/hlubinna_02.png", "start": 1148385, "end": 1152537, "audio": 0}, {"filename": "/data/images/barrel/hlubinna_03.png", "start": 1152537, "end": 1156759, "audio": 0}, {"filename": "/data/images/barrel/hlubinna_04.png", "start": 1156759, "end": 1160936, "audio": 0}, {"filename": "/data/images/barrel/hlubinna_05.png", "start": 1160936, "end": 1165081, "audio": 0}, {"filename": "/data/images/barrel/hlubinna_06.png", "start": 1165081, "end": 1169505, "audio": 0}, {"filename": "/data/images/barrel/hlubinna_07.png", "start": 1169505, "end": 1173809, "audio": 0}, {"filename": "/data/images/barrel/hlubinna_08.png", "start": 1173809, "end": 1178068, "audio": 0}, {"filename": "/data/images/barrel/kachna_00.png", "start": 1178068, "end": 1181293, "audio": 0}, {"filename": "/data/images/barrel/kachna_01.png", "start": 1181293, "end": 1184508, "audio": 0}, {"filename": "/data/images/barrel/kachna_02.png", "start": 1184508, "end": 1187716, "audio": 0}, {"filename": "/data/images/barrel/kachna_03.png", "start": 1187716, "end": 1190939, "audio": 0}, {"filename": "/data/images/barrel/kachna_04.png", "start": 1190939, "end": 1194149, "audio": 0}, {"filename": "/data/images/barrel/kachna_05.png", "start": 1194149, "end": 1197531, "audio": 0}, {"filename": "/data/images/barrel/kachna_06.png", "start": 1197531, "end": 1200879, "audio": 0}, {"filename": "/data/images/barrel/kachna_07.png", "start": 1200879, "end": 1204266, "audio": 0}, {"filename": "/data/images/barrel/kachna_08.png", "start": 1204266, "end": 1207646, "audio": 0}, {"filename": "/data/images/barrel/killer_00.png", "start": 1207646, "end": 1213718, "audio": 0}, {"filename": "/data/images/barrel/killer_01.png", "start": 1213718, "end": 1219803, "audio": 0}, {"filename": "/data/images/barrel/killer_02.png", "start": 1219803, "end": 1225722, "audio": 0}, {"filename": "/data/images/barrel/killer_03.png", "start": 1225722, "end": 1231567, "audio": 0}, {"filename": "/data/images/barrel/killer_04.png", "start": 1231567, "end": 1237464, "audio": 0}, {"filename": "/data/images/barrel/killer_05.png", "start": 1237464, "end": 1243305, "audio": 0}, {"filename": "/data/images/barrel/krab_00.png", "start": 1243305, "end": 1244956, "audio": 0}, {"filename": "/data/images/barrel/krab_01.png", "start": 1244956, "end": 1246602, "audio": 0}, {"filename": "/data/images/barrel/krab_02.png", "start": 1246602, "end": 1248252, "audio": 0}, {"filename": "/data/images/barrel/krab_03.png", "start": 1248252, "end": 1249910, "audio": 0}, {"filename": "/data/images/barrel/krab_04.png", "start": 1249910, "end": 1251554, "audio": 0}, {"filename": "/data/images/barrel/krab_05.png", "start": 1251554, "end": 1253238, "audio": 0}, {"filename": "/data/images/barrel/kukajda_00.png", "start": 1253238, "end": 1256500, "audio": 0}, {"filename": "/data/images/barrel/kukajda_01.png", "start": 1256500, "end": 1259760, "audio": 0}, {"filename": "/data/images/barrel/kukajda_02.png", "start": 1259760, "end": 1262966, "audio": 0}, {"filename": "/data/images/barrel/kukajda_03.png", "start": 1262966, "end": 1266236, "audio": 0}, {"filename": "/data/images/barrel/kukajda_04.png", "start": 1266236, "end": 1269499, "audio": 0}, {"filename": "/data/images/barrel/kukajda_05.png", "start": 1269499, "end": 1272721, "audio": 0}, {"filename": "/data/images/barrel/kukajda_06.png", "start": 1272721, "end": 1275982, "audio": 0}, {"filename": "/data/images/barrel/kukajda_07.png", "start": 1275982, "end": 1279239, "audio": 0}, {"filename": "/data/images/barrel/kukajda_08.png", "start": 1279239, "end": 1282449, "audio": 0}, {"filename": "/data/images/barrel/kukajda_09.png", "start": 1282449, "end": 1285694, "audio": 0}, {"filename": "/data/images/barrel/kukajda_10.png", "start": 1285694, "end": 1288939, "audio": 0}, {"filename": "/data/images/barrel/kukajda_11.png", "start": 1288939, "end": 1292130, "audio": 0}, {"filename": "/data/images/barrel/kukajda_12.png", "start": 1292130, "end": 1295335, "audio": 0}, {"filename": "/data/images/barrel/kukajda_13.png", "start": 1295335, "end": 1298538, "audio": 0}, {"filename": "/data/images/barrel/kukajda_14.png", "start": 1298538, "end": 1301710, "audio": 0}, {"filename": "/data/images/barrel/kukajda_15.png", "start": 1301710, "end": 1304993, "audio": 0}, {"filename": "/data/images/barrel/kukajda_16.png", "start": 1304993, "end": 1308299, "audio": 0}, {"filename": "/data/images/barrel/kukajda_17.png", "start": 1308299, "end": 1311529, "audio": 0}, {"filename": "/data/images/barrel/noha_00.png", "start": 1311529, "end": 1314243, "audio": 0}, {"filename": "/data/images/barrel/noha_01.png", "start": 1314243, "end": 1316905, "audio": 0}, {"filename": "/data/images/barrel/noha_02.png", "start": 1316905, "end": 1319572, "audio": 0}, {"filename": "/data/images/barrel/noha_03.png", "start": 1319572, "end": 1322294, "audio": 0}, {"filename": "/data/images/barrel/noha_04.png", "start": 1322294, "end": 1324955, "audio": 0}, {"filename": "/data/images/barrel/noha_05.png", "start": 1324955, "end": 1327736, "audio": 0}, {"filename": "/data/images/barrel/noha_06.png", "start": 1327736, "end": 1330377, "audio": 0}, {"filename": "/data/images/barrel/noha_07.png", "start": 1330377, "end": 1332982, "audio": 0}, {"filename": "/data/images/barrel/noha_08.png", "start": 1332982, "end": 1335586, "audio": 0}, {"filename": "/data/images/barrel/noha_09.png", "start": 1335586, "end": 1338241, "audio": 0}, {"filename": "/data/images/barrel/noha_10.png", "start": 1338241, "end": 1340843, "audio": 0}, {"filename": "/data/images/barrel/noha_11.png", "start": 1340843, "end": 1343565, "audio": 0}, {"filename": "/data/images/barrel/oko_00.png", "start": 1343565, "end": 1344218, "audio": 0}, {"filename": "/data/images/barrel/oko_01.png", "start": 1344218, "end": 1344835, "audio": 0}, {"filename": "/data/images/barrel/oko_02.png", "start": 1344835, "end": 1345459, "audio": 0}, {"filename": "/data/images/barrel/oko_03.png", "start": 1345459, "end": 1346069, "audio": 0}, {"filename": "/data/images/barrel/oko_04.png", "start": 1346069, "end": 1346714, "audio": 0}, {"filename": "/data/images/barrel/pld_00.png", "start": 1346714, "end": 1357280, "audio": 0}, {"filename": "/data/images/barrel/pld_01.png", "start": 1357280, "end": 1367198, "audio": 0}, {"filename": "/data/images/barrel/pld_02.png", "start": 1367198, "end": 1377733, "audio": 0}, {"filename": "/data/images/barrel/pld_03.png", "start": 1377733, "end": 1388098, "audio": 0}, {"filename": "/data/images/barrel/pld_04.png", "start": 1388098, "end": 1398919, "audio": 0}, {"filename": "/data/images/barrel/pld_05.png", "start": 1398919, "end": 1410020, "audio": 0}, {"filename": "/data/images/barrel/pld_06.png", "start": 1410020, "end": 1420670, "audio": 0}, {"filename": "/data/images/barrel/pld_07.png", "start": 1420670, "end": 1431582, "audio": 0}, {"filename": "/data/images/barrel/pld_08.png", "start": 1431582, "end": 1442820, "audio": 0}, {"filename": "/data/images/barrel/pld_09.png", "start": 1442820, "end": 1453496, "audio": 0}, {"filename": "/data/images/barrel/pld_10.png", "start": 1453496, "end": 1464422, "audio": 0}, {"filename": "/data/images/barrel/pld_11.png", "start": 1464422, "end": 1475584, "audio": 0}, {"filename": "/data/images/barrel/pld_12.png", "start": 1475584, "end": 1486342, "audio": 0}, {"filename": "/data/images/barrel/pld_13.png", "start": 1486342, "end": 1497355, "audio": 0}, {"filename": "/data/images/barrel/pld_14.png", "start": 1497355, "end": 1508700, "audio": 0}, {"filename": "/data/images/barrel/pld_15.png", "start": 1508700, "end": 1519950, "audio": 0}, {"filename": "/data/images/barrel/pldik_00.png", "start": 1519950, "end": 1521809, "audio": 0}, {"filename": "/data/images/barrel/pldik_01.png", "start": 1521809, "end": 1523665, "audio": 0}, {"filename": "/data/images/barrel/pldik_02.png", "start": 1523665, "end": 1525600, "audio": 0}, {"filename": "/data/images/barrel/pldik_03.png", "start": 1525600, "end": 1527525, "audio": 0}, {"filename": "/data/images/barrel/pldik_04.png", "start": 1527525, "end": 1529381, "audio": 0}, {"filename": "/data/images/barrel/pldik_05.png", "start": 1529381, "end": 1531228, "audio": 0}, {"filename": "/data/images/barrel/pldik_06.png", "start": 1531228, "end": 1533061, "audio": 0}, {"filename": "/data/images/barrel/pldik_07.png", "start": 1533061, "end": 1534890, "audio": 0}, {"filename": "/data/images/barrel/pldik_08.png", "start": 1534890, "end": 1536731, "audio": 0}, {"filename": "/data/images/barrel/pldik_09.png", "start": 1536731, "end": 1538570, "audio": 0}, {"filename": "/data/images/barrel/pldik_10.png", "start": 1538570, "end": 1540432, "audio": 0}, {"filename": "/data/images/barrel/pldik_11.png", "start": 1540432, "end": 1542286, "audio": 0}, {"filename": "/data/images/barrel/pldik_12.png", "start": 1542286, "end": 1544259, "audio": 0}, {"filename": "/data/images/barrel/pldik_13.png", "start": 1544259, "end": 1546207, "audio": 0}, {"filename": "/data/images/barrel/poster.png", "start": 1546207, "end": 1678442, "audio": 0}, {"filename": "/data/images/barrel/shark_00.png", "start": 1678442, "end": 1682052, "audio": 0}, {"filename": "/data/images/barrel/shark_01.png", "start": 1682052, "end": 1685846, "audio": 0}, {"filename": "/data/images/barrel/shark_02.png", "start": 1685846, "end": 1689473, "audio": 0}, {"filename": "/data/images/barrel/shark_03.png", "start": 1689473, "end": 1693282, "audio": 0}, {"filename": "/data/script/barrel/code.lua", "start": 1693282, "end": 1727023, "audio": 0}, {"filename": "/data/script/barrel/demo_dialogs_bg.lua", "start": 1727023, "end": 1727691, "audio": 0}, {"filename": "/data/script/barrel/demo_dialogs_cs.lua", "start": 1727691, "end": 1728112, "audio": 0}, {"filename": "/data/script/barrel/demo_dialogs_de_CH.lua", "start": 1728112, "end": 1728665, "audio": 0}, {"filename": "/data/script/barrel/demo_dialogs_de.lua", "start": 1728665, "end": 1729292, "audio": 0}, {"filename": "/data/script/barrel/demo_dialogs_en.lua", "start": 1729292, "end": 1729653, "audio": 0}, {"filename": "/data/script/barrel/demo_dialogs_es.lua", "start": 1729653, "end": 1730258, "audio": 0}, {"filename": "/data/script/barrel/demo_dialogs_fr.lua", "start": 1730258, "end": 1730894, "audio": 0}, {"filename": "/data/script/barrel/demo_dialogs_it.lua", "start": 1730894, "end": 1731492, "audio": 0}, {"filename": "/data/script/barrel/demo_dialogs_nl.lua", "start": 1731492, "end": 1732114, "audio": 0}, {"filename": "/data/script/barrel/demo_dialogs_pl.lua", "start": 1732114, "end": 1732718, "audio": 0}, {"filename": "/data/script/barrel/demo_dialogs_ru.lua", "start": 1732718, "end": 1733435, "audio": 0}, {"filename": "/data/script/barrel/demo_dialogs_sv.lua", "start": 1733435, "end": 1734038, "audio": 0}, {"filename": "/data/script/barrel/demo_poster.lua", "start": 1734038, "end": 1734444, "audio": 0}, {"filename": "/data/script/barrel/dialogs_bg.lua", "start": 1734444, "end": 1741350, "audio": 0}, {"filename": "/data/script/barrel/dialogs_cs.lua", "start": 1741350, "end": 1746526, "audio": 0}, {"filename": "/data/script/barrel/dialogs_de_CH.lua", "start": 1746526, "end": 1746934, "audio": 0}, {"filename": "/data/script/barrel/dialogs_de.lua", "start": 1746934, "end": 1752357, "audio": 0}, {"filename": "/data/script/barrel/dialogs_en.lua", "start": 1752357, "end": 1755789, "audio": 0}, {"filename": "/data/script/barrel/dialogs_es.lua", "start": 1755789, "end": 1761150, "audio": 0}, {"filename": "/data/script/barrel/dialogs_fr.lua", "start": 1761150, "end": 1766560, "audio": 0}, {"filename": "/data/script/barrel/dialogs_it.lua", "start": 1766560, "end": 1771774, "audio": 0}, {"filename": "/data/script/barrel/dialogs.lua", "start": 1771774, "end": 1771812, "audio": 0}, {"filename": "/data/script/barrel/dialogs_nl.lua", "start": 1771812, "end": 1777296, "audio": 0}, {"filename": "/data/script/barrel/dialogs_pl.lua", "start": 1777296, "end": 1782571, "audio": 0}, {"filename": "/data/script/barrel/dialogs_ru.lua", "start": 1782571, "end": 1789413, "audio": 0}, {"filename": "/data/script/barrel/dialogs_sv.lua", "start": 1789413, "end": 1794704, "audio": 0}, {"filename": "/data/script/barrel/init.lua", "start": 1794704, "end": 1795349, "audio": 0}, {"filename": "/data/script/barrel/models.lua", "start": 1795349, "end": 1800496, "audio": 0}, {"filename": "/data/sound/barrel/cs/bar-m-barel.ogg", "start": 1800496, "end": 1829020, "audio": 1}, {"filename": "/data/sound/barrel/cs/bar-m-dost0.ogg", "start": 1829020, "end": 1844810, "audio": 1}, {"filename": "/data/sound/barrel/cs/bar-m-dost1.ogg", "start": 1844810, "end": 1868511, "audio": 1}, {"filename": "/data/sound/barrel/cs/bar-m-fdto.ogg", "start": 1868511, "end": 1888147, "audio": 1}, {"filename": "/data/sound/barrel/cs/bar-m-kachna.ogg", "start": 1888147, "end": 1917021, "audio": 1}, {"filename": "/data/sound/barrel/cs/bar-m-mutanti.ogg", "start": 1917021, "end": 1946789, "audio": 1}, {"filename": "/data/sound/barrel/cs/bar-m-noha.ogg", "start": 1946789, "end": 1982973, "audio": 1}, {"filename": "/data/sound/barrel/cs/bar-m-no.ogg", "start": 1982973, "end": 2001183, "audio": 1}, {"filename": "/data/sound/barrel/cs/bar-m-panb.ogg", "start": 2001183, "end": 2034490, "audio": 1}, {"filename": "/data/sound/barrel/cs/bar-m-pobit.ogg", "start": 2034490, "end": 2078937, "audio": 1}, {"filename": "/data/sound/barrel/cs/bar-m-promin.ogg", "start": 2078937, "end": 2099954, "audio": 1}, {"filename": "/data/sound/barrel/cs/bar-m-pudy.ogg", "start": 2099954, "end": 2134927, "audio": 1}, {"filename": "/data/sound/barrel/cs/bar-m-rada.ogg", "start": 2134927, "end": 2155216, "audio": 1}, {"filename": "/data/sound/barrel/cs/bar-m-rybka.ogg", "start": 2155216, "end": 2174183, "audio": 1}, {"filename": "/data/sound/barrel/cs/bar-m-videt1.ogg", "start": 2174183, "end": 2191138, "audio": 1}, {"filename": "/data/sound/barrel/cs/bar-m-zmeni.ogg", "start": 2191138, "end": 2213282, "audio": 1}, {"filename": "/data/sound/barrel/cs/bar-v-co.ogg", "start": 2213282, "end": 2225385, "audio": 1}, {"filename": "/data/sound/barrel/cs/bar-v-fotka.ogg", "start": 2225385, "end": 2246578, "audio": 1}, {"filename": "/data/sound/barrel/cs/bar-v-genofond.ogg", "start": 2246578, "end": 2280786, "audio": 1}, {"filename": "/data/sound/barrel/cs/bar-v-kdyby0.ogg", "start": 2280786, "end": 2298848, "audio": 1}, {"filename": "/data/sound/barrel/cs/bar-v-kdyby1.ogg", "start": 2298848, "end": 2316127, "audio": 1}, {"filename": "/data/sound/barrel/cs/bar-v-krab.ogg", "start": 2316127, "end": 2360249, "audio": 1}, {"filename": "/data/sound/barrel/cs/bar-v-lih.ogg", "start": 2360249, "end": 2392555, "audio": 1}, {"filename": "/data/sound/barrel/cs/bar-v-pld.ogg", "start": 2392555, "end": 2429651, "audio": 1}, {"filename": "/data/sound/barrel/cs/bar-v-priciny.ogg", "start": 2429651, "end": 2455810, "audio": 1}, {"filename": "/data/sound/barrel/cs/bar-v-sbirka.ogg", "start": 2455810, "end": 2485068, "audio": 1}, {"filename": "/data/sound/barrel/cs/bar-v-sud.ogg", "start": 2485068, "end": 2519184, "audio": 1}, {"filename": "/data/sound/barrel/cs/bar-v-traverza.ogg", "start": 2519184, "end": 2538928, "audio": 1}, {"filename": "/data/sound/barrel/cs/bar-v-ufouni.ogg", "start": 2538928, "end": 2559813, "audio": 1}, {"filename": "/data/sound/barrel/cs/bar-v-videt0.ogg", "start": 2559813, "end": 2576515, "audio": 1}, {"filename": "/data/sound/barrel/cs/bar-x-vypr.ogg", "start": 2576515, "end": 2592276, "audio": 1}, {"filename": "/data/sound/barrel/en/bar-x-gr0.ogg", "start": 2592276, "end": 2604597, "audio": 1}, {"filename": "/data/sound/barrel/en/bar-x-gr1.ogg", "start": 2604597, "end": 2616625, "audio": 1}, {"filename": "/data/sound/barrel/en/bar-x-gr2.ogg", "start": 2616625, "end": 2629203, "audio": 1}, {"filename": "/data/sound/barrel/en/bar-x-kchkch.ogg", "start": 2629203, "end": 2645544, "audio": 1}, {"filename": "/data/sound/barrel/en/bar-x-suck0.ogg", "start": 2645544, "end": 2651341, "audio": 1}, {"filename": "/data/sound/barrel/en/bar-x-suck1.ogg", "start": 2651341, "end": 2656582, "audio": 1}, {"filename": "/data/sound/barrel/en/bar-x-suck2.ogg", "start": 2656582, "end": 2663090, "audio": 1}, {"filename": "/data/sound/barrel/en/bar-x-suck3.ogg", "start": 2663090, "end": 2669797, "audio": 1}, {"filename": "/data/sound/barrel/en/bar-x-suckano.ogg", "start": 2669797, "end": 2681895, "audio": 1}, {"filename": "/data/sound/barrel/en/bar-x-suckne.ogg", "start": 2681895, "end": 2696744, "audio": 1}, {"filename": "/data/sound/barrel/en/bar-x-tup.ogg", "start": 2696744, "end": 2702668, "audio": 1}, {"filename": "/data/sound/barrel/en/bar-x-zzz.ogg", "start": 2702668, "end": 2710676, "audio": 1}, {"filename": "/data/sound/barrel/nl/bar-m-barel.ogg", "start": 2710676, "end": 2736887, "audio": 1}, {"filename": "/data/sound/barrel/nl/bar-m-dost0.ogg", "start": 2736887, "end": 2758478, "audio": 1}, {"filename": "/data/sound/barrel/nl/bar-m-dost1.ogg", "start": 2758478, "end": 2783412, "audio": 1}, {"filename": "/data/sound/barrel/nl/bar-m-fdto.ogg", "start": 2783412, "end": 2807417, "audio": 1}, {"filename": "/data/sound/barrel/nl/bar-m-kachna.ogg", "start": 2807417, "end": 2841874, "audio": 1}, {"filename": "/data/sound/barrel/nl/bar-m-mutanti.ogg", "start": 2841874, "end": 2874212, "audio": 1}, {"filename": "/data/sound/barrel/nl/bar-m-noha.ogg", "start": 2874212, "end": 2904649, "audio": 1}, {"filename": "/data/sound/barrel/nl/bar-m-no.ogg", "start": 2904649, "end": 2923288, "audio": 1}, {"filename": "/data/sound/barrel/nl/bar-m-panb.ogg", "start": 2923288, "end": 2953765, "audio": 1}, {"filename": "/data/sound/barrel/nl/bar-m-pobit.ogg", "start": 2953765, "end": 3002112, "audio": 1}, {"filename": "/data/sound/barrel/nl/bar-m-promin.ogg", "start": 3002112, "end": 3021725, "audio": 1}, {"filename": "/data/sound/barrel/nl/bar-m-pudy.ogg", "start": 3021725, "end": 3051953, "audio": 1}, {"filename": "/data/sound/barrel/nl/bar-m-rada.ogg", "start": 3051953, "end": 3072581, "audio": 1}, {"filename": "/data/sound/barrel/nl/bar-m-rybka.ogg", "start": 3072581, "end": 3096375, "audio": 1}, {"filename": "/data/sound/barrel/nl/bar-m-videt1.ogg", "start": 3096375, "end": 3120832, "audio": 1}, {"filename": "/data/sound/barrel/nl/bar-m-zmeni.ogg", "start": 3120832, "end": 3144948, "audio": 1}, {"filename": "/data/sound/barrel/nl/bar-v-co.ogg", "start": 3144948, "end": 3163040, "audio": 1}, {"filename": "/data/sound/barrel/nl/bar-v-fotka.ogg", "start": 3163040, "end": 3186486, "audio": 1}, {"filename": "/data/sound/barrel/nl/bar_v_fotka.ogg", "start": 3186486, "end": 3195431, "audio": 1}, {"filename": "/data/sound/barrel/nl/bar-v-genofond.ogg", "start": 3195431, "end": 3240589, "audio": 1}, {"filename": "/data/sound/barrel/nl/bar-v-kdyby0.ogg", "start": 3240589, "end": 3262481, "audio": 1}, {"filename": "/data/sound/barrel/nl/bar-v-kdyby1.ogg", "start": 3262481, "end": 3287897, "audio": 1}, {"filename": "/data/sound/barrel/nl/bar-v-krab.ogg", "start": 3287897, "end": 3331520, "audio": 1}, {"filename": "/data/sound/barrel/nl/bar-v-lih.ogg", "start": 3331520, "end": 3365913, "audio": 1}, {"filename": "/data/sound/barrel/nl/bar-v-pld.ogg", "start": 3365913, "end": 3412760, "audio": 1}, {"filename": "/data/sound/barrel/nl/bar-v-priciny.ogg", "start": 3412760, "end": 3450663, "audio": 1}, {"filename": "/data/sound/barrel/nl/bar-v-sbirka.ogg", "start": 3450663, "end": 3490078, "audio": 1}, {"filename": "/data/sound/barrel/nl/bar-v-sud.ogg", "start": 3490078, "end": 3527433, "audio": 1}, {"filename": "/data/sound/barrel/nl/bar-v-traverza.ogg", "start": 3527433, "end": 3555521, "audio": 1}, {"filename": "/data/sound/barrel/nl/bar-v-ufouni.ogg", "start": 3555521, "end": 3579781, "audio": 1}, {"filename": "/data/sound/barrel/nl/bar-v-videt0.ogg", "start": 3579781, "end": 3602976, "audio": 1}], "remote_package_size": 3602976, "package_uuid": "75dd0188-d077-415b-af74-d6c6174e0832"});

})();
