
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
    var PACKAGE_NAME = 'web/data/magnet.data';
    var REMOTE_PACKAGE_BASE = 'data/magnet.data';
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
Module['FS_createPath']('/data/images', 'magnet', true, true);
Module['FS_createPath']('/data', 'script', true, true);
Module['FS_createPath']('/data/script', 'magnet', true, true);
Module['FS_createPath']('/data', 'sound', true, true);
Module['FS_createPath']('/data/sound', 'magnet', true, true);
Module['FS_createPath']('/data/sound/magnet', 'cs', true, true);
Module['FS_createPath']('/data/sound/magnet', 'nl', true, true);

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
              Module['removeRunDependency']('datafile_web/data/magnet.data');

    };
    Module['addRunDependency']('datafile_web/data/magnet.data');
  
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
 loadPackage({"files": [{"filename": "/data/images/magnet/6-ocel.png", "start": 0, "end": 2162, "audio": 0}, {"filename": "/data/images/magnet/7-ocel.png", "start": 2162, "end": 3029, "audio": 0}, {"filename": "/data/images/magnet/8-ocel.png", "start": 3029, "end": 4831, "audio": 0}, {"filename": "/data/images/magnet/9-ocel.png", "start": 4831, "end": 6955, "audio": 0}, {"filename": "/data/images/magnet/magnety-oba-_00.png", "start": 6955, "end": 11832, "audio": 0}, {"filename": "/data/images/magnet/magnety-oba-_01.png", "start": 11832, "end": 16995, "audio": 0}, {"filename": "/data/images/magnet/magnety-oba-_02.png", "start": 16995, "end": 22264, "audio": 0}, {"filename": "/data/images/magnet/magnety-oba-_03.png", "start": 22264, "end": 27763, "audio": 0}, {"filename": "/data/images/magnet/magnety-oba-_04.png", "start": 27763, "end": 33609, "audio": 0}, {"filename": "/data/images/magnet/paprsky-pozadi.png", "start": 33609, "end": 247640, "audio": 0}, {"filename": "/data/images/magnet/paprsky-w.png", "start": 247640, "end": 367375, "audio": 0}, {"filename": "/data/images/magnet/radio-_00.png", "start": 367375, "end": 371987, "audio": 0}, {"filename": "/data/images/magnet/radio-_01.png", "start": 371987, "end": 376599, "audio": 0}, {"filename": "/data/images/magnet/radio-_02.png", "start": 376599, "end": 381211, "audio": 0}, {"filename": "/data/images/magnet/radio-_03.png", "start": 381211, "end": 385822, "audio": 0}, {"filename": "/data/images/magnet/radio-_04.png", "start": 385822, "end": 390433, "audio": 0}, {"filename": "/data/images/magnet/radio-_05.png", "start": 390433, "end": 395052, "audio": 0}, {"filename": "/data/images/magnet/radio-_06.png", "start": 395052, "end": 399996, "audio": 0}, {"filename": "/data/images/magnet/radio-_07.png", "start": 399996, "end": 404971, "audio": 0}, {"filename": "/data/images/magnet/radio-_08.png", "start": 404971, "end": 409989, "audio": 0}, {"filename": "/data/images/magnet/zbran.png", "start": 409989, "end": 414033, "audio": 0}, {"filename": "/data/script/magnet/code.lua", "start": 414033, "end": 424551, "audio": 0}, {"filename": "/data/script/magnet/dialogs_bg.lua", "start": 424551, "end": 428281, "audio": 0}, {"filename": "/data/script/magnet/dialogs_cs.lua", "start": 428281, "end": 431435, "audio": 0}, {"filename": "/data/script/magnet/dialogs_de.lua", "start": 431435, "end": 434623, "audio": 0}, {"filename": "/data/script/magnet/dialogs_en.lua", "start": 434623, "end": 436518, "audio": 0}, {"filename": "/data/script/magnet/dialogs_es.lua", "start": 436518, "end": 439653, "audio": 0}, {"filename": "/data/script/magnet/dialogs_fr.lua", "start": 439653, "end": 442871, "audio": 0}, {"filename": "/data/script/magnet/dialogs_it.lua", "start": 442871, "end": 446026, "audio": 0}, {"filename": "/data/script/magnet/dialogs.lua", "start": 446026, "end": 446064, "audio": 0}, {"filename": "/data/script/magnet/dialogs_nl.lua", "start": 446064, "end": 449253, "audio": 0}, {"filename": "/data/script/magnet/dialogs_pl.lua", "start": 449253, "end": 452404, "audio": 0}, {"filename": "/data/script/magnet/dialogs_ru.lua", "start": 452404, "end": 456066, "audio": 0}, {"filename": "/data/script/magnet/dialogs_sv.lua", "start": 456066, "end": 459236, "audio": 0}, {"filename": "/data/script/magnet/init.lua", "start": 459236, "end": 459881, "audio": 0}, {"filename": "/data/script/magnet/models.lua", "start": 459881, "end": 462404, "audio": 0}, {"filename": "/data/sound/magnet/cs/pap-m-coje.ogg", "start": 462404, "end": 475340, "audio": 1}, {"filename": "/data/sound/magnet/cs/pap-m-jejedno.ogg", "start": 475340, "end": 493740, "audio": 1}, {"filename": "/data/sound/magnet/cs/pap-m-magnet.ogg", "start": 493740, "end": 523739, "audio": 1}, {"filename": "/data/sound/magnet/cs/pap-m-mraz.ogg", "start": 523739, "end": 542570, "audio": 1}, {"filename": "/data/sound/magnet/cs/pap-m-naucit.ogg", "start": 542570, "end": 567530, "audio": 1}, {"filename": "/data/sound/magnet/cs/pap-m-nechme.ogg", "start": 567530, "end": 578121, "audio": 1}, {"filename": "/data/sound/magnet/cs/pap-m-nedobre.ogg", "start": 578121, "end": 596622, "audio": 1}, {"filename": "/data/sound/magnet/cs/pap-m-nejde.ogg", "start": 596622, "end": 621570, "audio": 1}, {"filename": "/data/sound/magnet/cs/pap-m-nepohnu.ogg", "start": 621570, "end": 636154, "audio": 1}, {"filename": "/data/sound/magnet/cs/pap-m-ocel.ogg", "start": 636154, "end": 656835, "audio": 1}, {"filename": "/data/sound/magnet/cs/pap-m-pistole.ogg", "start": 656835, "end": 671721, "audio": 1}, {"filename": "/data/sound/magnet/cs/pap-m-radio.ogg", "start": 671721, "end": 688001, "audio": 1}, {"filename": "/data/sound/magnet/cs/pap-m-teorie.ogg", "start": 688001, "end": 713490, "audio": 1}, {"filename": "/data/sound/magnet/cs/pap-m-zvlastni.ogg", "start": 713490, "end": 729955, "audio": 1}, {"filename": "/data/sound/magnet/cs/pap-v-divny.ogg", "start": 729955, "end": 744611, "audio": 1}, {"filename": "/data/sound/magnet/cs/pap-v-ha.ogg", "start": 744611, "end": 763124, "audio": 1}, {"filename": "/data/sound/magnet/cs/pap-v-laserova.ogg", "start": 763124, "end": 778598, "audio": 1}, {"filename": "/data/sound/magnet/cs/pap-v-nemir.ogg", "start": 778598, "end": 793943, "audio": 1}, {"filename": "/data/sound/magnet/cs/pap-v-pole.ogg", "start": 793943, "end": 817949, "audio": 1}, {"filename": "/data/sound/magnet/cs/pap-v-potrebovat.ogg", "start": 817949, "end": 835013, "audio": 1}, {"filename": "/data/sound/magnet/cs/pap-v-prekvapeni.ogg", "start": 835013, "end": 856594, "audio": 1}, {"filename": "/data/sound/magnet/cs/pap-v-radio.ogg", "start": 856594, "end": 873905, "audio": 1}, {"filename": "/data/sound/magnet/cs/pap-v-tesno.ogg", "start": 873905, "end": 889066, "audio": 1}, {"filename": "/data/sound/magnet/cs/pap-v-vufu.ogg", "start": 889066, "end": 912095, "audio": 1}, {"filename": "/data/sound/magnet/nl/pap-m-coje.ogg", "start": 912095, "end": 929553, "audio": 1}, {"filename": "/data/sound/magnet/nl/pap-m-jejedno.ogg", "start": 929553, "end": 952164, "audio": 1}, {"filename": "/data/sound/magnet/nl/pap-m-magnet.ogg", "start": 952164, "end": 980517, "audio": 1}, {"filename": "/data/sound/magnet/nl/pap-m-mraz.ogg", "start": 980517, "end": 1000052, "audio": 1}, {"filename": "/data/sound/magnet/nl/pap-m-naucit.ogg", "start": 1000052, "end": 1028611, "audio": 1}, {"filename": "/data/sound/magnet/nl/pap-m-nechme.ogg", "start": 1028611, "end": 1045569, "audio": 1}, {"filename": "/data/sound/magnet/nl/pap-m-nedobre.ogg", "start": 1045569, "end": 1067708, "audio": 1}, {"filename": "/data/sound/magnet/nl/pap-m-nejde.ogg", "start": 1067708, "end": 1096691, "audio": 1}, {"filename": "/data/sound/magnet/nl/pap-m-nepohnu.ogg", "start": 1096691, "end": 1117922, "audio": 1}, {"filename": "/data/sound/magnet/nl/pap-m-ocel.ogg", "start": 1117922, "end": 1140648, "audio": 1}, {"filename": "/data/sound/magnet/nl/pap-m-pistole.ogg", "start": 1140648, "end": 1159257, "audio": 1}, {"filename": "/data/sound/magnet/nl/pap-m-radio.ogg", "start": 1159257, "end": 1178552, "audio": 1}, {"filename": "/data/sound/magnet/nl/pap-m-teorie.ogg", "start": 1178552, "end": 1204379, "audio": 1}, {"filename": "/data/sound/magnet/nl/pap-m-zvlastni.ogg", "start": 1204379, "end": 1222299, "audio": 1}, {"filename": "/data/sound/magnet/nl/pap-v-divny.ogg", "start": 1222299, "end": 1240831, "audio": 1}, {"filename": "/data/sound/magnet/nl/pap-v-ha.ogg", "start": 1240831, "end": 1259913, "audio": 1}, {"filename": "/data/sound/magnet/nl/pap-v-laserova.ogg", "start": 1259913, "end": 1280457, "audio": 1}, {"filename": "/data/sound/magnet/nl/pap-v-nemir.ogg", "start": 1280457, "end": 1301158, "audio": 1}, {"filename": "/data/sound/magnet/nl/pap-v-pole.ogg", "start": 1301158, "end": 1324592, "audio": 1}, {"filename": "/data/sound/magnet/nl/pap-v-potrebovat.ogg", "start": 1324592, "end": 1342950, "audio": 1}, {"filename": "/data/sound/magnet/nl/pap-v-prekvapeni.ogg", "start": 1342950, "end": 1370247, "audio": 1}, {"filename": "/data/sound/magnet/nl/pap-v-radio.ogg", "start": 1370247, "end": 1391832, "audio": 1}, {"filename": "/data/sound/magnet/nl/pap-v-tesno.ogg", "start": 1391832, "end": 1410294, "audio": 1}, {"filename": "/data/sound/magnet/nl/pap-v-vufu.ogg", "start": 1410294, "end": 1434494, "audio": 1}], "remote_package_size": 1434494, "package_uuid": "722724b4-6d26-4b9d-956f-f328e65090cf"});

})();
