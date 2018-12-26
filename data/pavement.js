
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
    var PACKAGE_NAME = 'web/data/pavement.data';
    var REMOTE_PACKAGE_BASE = 'data/pavement.data';
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
Module['FS_createPath']('/data/images', 'pavement', true, true);
Module['FS_createPath']('/data', 'script', true, true);
Module['FS_createPath']('/data/script', 'pavement', true, true);
Module['FS_createPath']('/data', 'sound', true, true);
Module['FS_createPath']('/data/sound', 'pavement', true, true);
Module['FS_createPath']('/data/sound/pavement', 'cs', true, true);
Module['FS_createPath']('/data/sound/pavement', 'en', true, true);
Module['FS_createPath']('/data/sound/pavement', 'nl', true, true);

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
              Module['removeRunDependency']('datafile_web/data/pavement.data');

    };
    Module['addRunDependency']('datafile_web/data/pavement.data');
  
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
 loadPackage({"files": [{"filename": "/data/images/pavement/atikaa.png", "start": 0, "end": 1718, "audio": 0}, {"filename": "/data/images/pavement/atikab.png", "start": 1718, "end": 4123, "audio": 0}, {"filename": "/data/images/pavement/atikac.png", "start": 4123, "end": 5887, "audio": 0}, {"filename": "/data/images/pavement/atikad.png", "start": 5887, "end": 8210, "audio": 0}, {"filename": "/data/images/pavement/chobotnice_00.png", "start": 8210, "end": 12686, "audio": 0}, {"filename": "/data/images/pavement/chobotnice_01.png", "start": 12686, "end": 17009, "audio": 0}, {"filename": "/data/images/pavement/chobotnice_02.png", "start": 17009, "end": 21397, "audio": 0}, {"filename": "/data/images/pavement/chobotnice_03.png", "start": 21397, "end": 25803, "audio": 0}, {"filename": "/data/images/pavement/chobotnice_04.png", "start": 25803, "end": 30094, "audio": 0}, {"filename": "/data/images/pavement/chobotnice_05.png", "start": 30094, "end": 34430, "audio": 0}, {"filename": "/data/images/pavement/chobotnice_06.png", "start": 34430, "end": 38594, "audio": 0}, {"filename": "/data/images/pavement/chobotnice_07.png", "start": 38594, "end": 42673, "audio": 0}, {"filename": "/data/images/pavement/chobotnice_08.png", "start": 42673, "end": 46808, "audio": 0}, {"filename": "/data/images/pavement/diry-10-tmp.png", "start": 46808, "end": 47504, "audio": 0}, {"filename": "/data/images/pavement/diry-11-tmp.png", "start": 47504, "end": 48200, "audio": 0}, {"filename": "/data/images/pavement/diry-12-tmp.png", "start": 48200, "end": 50993, "audio": 0}, {"filename": "/data/images/pavement/diry-13-tmp.png", "start": 50993, "end": 52098, "audio": 0}, {"filename": "/data/images/pavement/diry-14-tmp.png", "start": 52098, "end": 52701, "audio": 0}, {"filename": "/data/images/pavement/diry-9-tmp.png", "start": 52701, "end": 53397, "audio": 0}, {"filename": "/data/images/pavement/diry-p.png", "start": 53397, "end": 389303, "audio": 0}, {"filename": "/data/images/pavement/diry-w.png", "start": 389303, "end": 707916, "audio": 0}, {"filename": "/data/images/pavement/hlava_00.png", "start": 707916, "end": 711526, "audio": 0}, {"filename": "/data/images/pavement/hlava_01.png", "start": 711526, "end": 715192, "audio": 0}, {"filename": "/data/images/pavement/hlava_02.png", "start": 715192, "end": 718751, "audio": 0}, {"filename": "/data/images/pavement/hlava_03.png", "start": 718751, "end": 722433, "audio": 0}, {"filename": "/data/images/pavement/hlava_04.png", "start": 722433, "end": 726022, "audio": 0}, {"filename": "/data/images/pavement/hlava_05.png", "start": 726022, "end": 729605, "audio": 0}, {"filename": "/data/images/pavement/hlava_06.png", "start": 729605, "end": 733169, "audio": 0}, {"filename": "/data/images/pavement/hlava_07.png", "start": 733169, "end": 736704, "audio": 0}, {"filename": "/data/images/pavement/hlava_08.png", "start": 736704, "end": 740272, "audio": 0}, {"filename": "/data/images/pavement/hlava_09.png", "start": 740272, "end": 743881, "audio": 0}, {"filename": "/data/images/pavement/hlava_10.png", "start": 743881, "end": 747491, "audio": 0}, {"filename": "/data/images/pavement/hlava_11.png", "start": 747491, "end": 751177, "audio": 0}, {"filename": "/data/images/pavement/hlava_12.png", "start": 751177, "end": 754774, "audio": 0}, {"filename": "/data/images/pavement/hlava_13.png", "start": 754774, "end": 758351, "audio": 0}, {"filename": "/data/images/pavement/hlava_14.png", "start": 758351, "end": 761977, "audio": 0}, {"filename": "/data/images/pavement/hlava_15.png", "start": 761977, "end": 765678, "audio": 0}, {"filename": "/data/images/pavement/hlava_16.png", "start": 765678, "end": 769281, "audio": 0}, {"filename": "/data/images/pavement/hlava_17.png", "start": 769281, "end": 772888, "audio": 0}, {"filename": "/data/images/pavement/hlava_18.png", "start": 772888, "end": 776480, "audio": 0}, {"filename": "/data/images/pavement/hlava_19.png", "start": 776480, "end": 780164, "audio": 0}, {"filename": "/data/images/pavement/hlava_m-_00.png", "start": 780164, "end": 780880, "audio": 0}, {"filename": "/data/images/pavement/hlava_m-_01.png", "start": 780880, "end": 781605, "audio": 0}, {"filename": "/data/images/pavement/hlava_m-_02.png", "start": 781605, "end": 782341, "audio": 0}, {"filename": "/data/images/pavement/hlavice.png", "start": 782341, "end": 784498, "audio": 0}, {"filename": "/data/images/pavement/maly_snek_00.png", "start": 784498, "end": 785172, "audio": 0}, {"filename": "/data/images/pavement/maly_snek_01.png", "start": 785172, "end": 785869, "audio": 0}, {"filename": "/data/images/pavement/maly_snek_02.png", "start": 785869, "end": 786586, "audio": 0}, {"filename": "/data/images/pavement/maly_snek_03.png", "start": 786586, "end": 787246, "audio": 0}, {"filename": "/data/images/pavement/most.png", "start": 787246, "end": 794782, "audio": 0}, {"filename": "/data/images/pavement/patka.png", "start": 794782, "end": 797475, "audio": 0}, {"filename": "/data/images/pavement/preklad.png", "start": 797475, "end": 802385, "audio": 0}, {"filename": "/data/images/pavement/sloupek_a.png", "start": 802385, "end": 803637, "audio": 0}, {"filename": "/data/images/pavement/sloupek_b.png", "start": 803637, "end": 804699, "audio": 0}, {"filename": "/data/images/pavement/sloupek_c.png", "start": 804699, "end": 805552, "audio": 0}, {"filename": "/data/script/pavement/code.lua", "start": 805552, "end": 821454, "audio": 0}, {"filename": "/data/script/pavement/dialogs_bg.lua", "start": 821454, "end": 825338, "audio": 0}, {"filename": "/data/script/pavement/dialogs_cs.lua", "start": 825338, "end": 828438, "audio": 0}, {"filename": "/data/script/pavement/dialogs_de_CH.lua", "start": 828438, "end": 828547, "audio": 0}, {"filename": "/data/script/pavement/dialogs_de.lua", "start": 828547, "end": 831741, "audio": 0}, {"filename": "/data/script/pavement/dialogs_en.lua", "start": 831741, "end": 833776, "audio": 0}, {"filename": "/data/script/pavement/dialogs_es.lua", "start": 833776, "end": 836911, "audio": 0}, {"filename": "/data/script/pavement/dialogs_fr.lua", "start": 836911, "end": 840043, "audio": 0}, {"filename": "/data/script/pavement/dialogs_it.lua", "start": 840043, "end": 843163, "audio": 0}, {"filename": "/data/script/pavement/dialogs.lua", "start": 843163, "end": 843201, "audio": 0}, {"filename": "/data/script/pavement/dialogs_nl.lua", "start": 843201, "end": 846461, "audio": 0}, {"filename": "/data/script/pavement/dialogs_pl.lua", "start": 846461, "end": 849596, "audio": 0}, {"filename": "/data/script/pavement/dialogs_ru.lua", "start": 849596, "end": 853543, "audio": 0}, {"filename": "/data/script/pavement/dialogs_sv.lua", "start": 853543, "end": 856646, "audio": 0}, {"filename": "/data/script/pavement/init.lua", "start": 856646, "end": 857293, "audio": 0}, {"filename": "/data/script/pavement/models.lua", "start": 857293, "end": 862058, "audio": 0}, {"filename": "/data/sound/pavement/cs/dir-hs-konec0.ogg", "start": 862058, "end": 884426, "audio": 1}, {"filename": "/data/sound/pavement/cs/dir-hs-konec1.ogg", "start": 884426, "end": 918798, "audio": 1}, {"filename": "/data/sound/pavement/cs/dir-hs-konec2.ogg", "start": 918798, "end": 961348, "audio": 1}, {"filename": "/data/sound/pavement/cs/dir-hs-konec3.ogg", "start": 961348, "end": 985555, "audio": 1}, {"filename": "/data/sound/pavement/cs/dir-hs-konec4.ogg", "start": 985555, "end": 1011126, "audio": 1}, {"filename": "/data/sound/pavement/cs/dir-hs-konec5.ogg", "start": 1011126, "end": 1048056, "audio": 1}, {"filename": "/data/sound/pavement/cs/dir-hs-konec6.ogg", "start": 1048056, "end": 1086006, "audio": 1}, {"filename": "/data/sound/pavement/cs/dir-hs-konec7.ogg", "start": 1086006, "end": 1112761, "audio": 1}, {"filename": "/data/sound/pavement/cs/dir-hs-konec8.ogg", "start": 1112761, "end": 1140658, "audio": 1}, {"filename": "/data/sound/pavement/cs/dir-hs-uvod0.ogg", "start": 1140658, "end": 1159395, "audio": 1}, {"filename": "/data/sound/pavement/cs/dir-hs-uvod1.ogg", "start": 1159395, "end": 1177813, "audio": 1}, {"filename": "/data/sound/pavement/cs/dir-hs-uvod2.ogg", "start": 1177813, "end": 1198932, "audio": 1}, {"filename": "/data/sound/pavement/cs/dir-hs-uvod3.ogg", "start": 1198932, "end": 1226045, "audio": 1}, {"filename": "/data/sound/pavement/cs/dir-hs-uvod4.ogg", "start": 1226045, "end": 1260356, "audio": 1}, {"filename": "/data/sound/pavement/cs/dir-m-rada0.ogg", "start": 1260356, "end": 1275962, "audio": 1}, {"filename": "/data/sound/pavement/cs/dir-m-rada1.ogg", "start": 1275962, "end": 1290854, "audio": 1}, {"filename": "/data/sound/pavement/cs/dir-m-rada2.ogg", "start": 1290854, "end": 1302724, "audio": 1}, {"filename": "/data/sound/pavement/cs/dir-m-rada3.ogg", "start": 1302724, "end": 1319418, "audio": 1}, {"filename": "/data/sound/pavement/cs/dir-m-rada4.ogg", "start": 1319418, "end": 1341322, "audio": 1}, {"filename": "/data/sound/pavement/cs/dir-v-rada0.ogg", "start": 1341322, "end": 1360916, "audio": 1}, {"filename": "/data/sound/pavement/cs/dir-v-rada1.ogg", "start": 1360916, "end": 1377529, "audio": 1}, {"filename": "/data/sound/pavement/cs/dir-v-rada2.ogg", "start": 1377529, "end": 1395385, "audio": 1}, {"filename": "/data/sound/pavement/cs/dir-v-rada3.ogg", "start": 1395385, "end": 1419980, "audio": 1}, {"filename": "/data/sound/pavement/cs/dir-v-rada4.ogg", "start": 1419980, "end": 1438476, "audio": 1}, {"filename": "/data/sound/pavement/en/k1-chob-1.ogg", "start": 1438476, "end": 1450808, "audio": 1}, {"filename": "/data/sound/pavement/en/k1-chob-2.ogg", "start": 1450808, "end": 1460848, "audio": 1}, {"filename": "/data/sound/pavement/en/k1-chob-3.ogg", "start": 1460848, "end": 1474742, "audio": 1}, {"filename": "/data/sound/pavement/en/k1-chob-p.ogg", "start": 1474742, "end": 1484304, "audio": 1}, {"filename": "/data/sound/pavement/en/k1-x-vrz.ogg", "start": 1484304, "end": 1490183, "audio": 1}, {"filename": "/data/sound/pavement/nl/dir-m-rada0.ogg", "start": 1490183, "end": 1507330, "audio": 1}, {"filename": "/data/sound/pavement/nl/dir-m-rada1.ogg", "start": 1507330, "end": 1524485, "audio": 1}, {"filename": "/data/sound/pavement/nl/dir-m-rada2.ogg", "start": 1524485, "end": 1539627, "audio": 1}, {"filename": "/data/sound/pavement/nl/dir-m-rada3.ogg", "start": 1539627, "end": 1557077, "audio": 1}, {"filename": "/data/sound/pavement/nl/dir-m-rada4.ogg", "start": 1557077, "end": 1579526, "audio": 1}, {"filename": "/data/sound/pavement/nl/dir-v-rada0.ogg", "start": 1579526, "end": 1601168, "audio": 1}, {"filename": "/data/sound/pavement/nl/dir-v-rada1.ogg", "start": 1601168, "end": 1617770, "audio": 1}, {"filename": "/data/sound/pavement/nl/dir-v-rada2.ogg", "start": 1617770, "end": 1637385, "audio": 1}, {"filename": "/data/sound/pavement/nl/dir-v-rada3.ogg", "start": 1637385, "end": 1665176, "audio": 1}, {"filename": "/data/sound/pavement/nl/dir-v-rada4.ogg", "start": 1665176, "end": 1690879, "audio": 1}], "remote_package_size": 1690879, "package_uuid": "06097fb6-f8bc-4d02-94de-100dd54ebff0"});

})();
