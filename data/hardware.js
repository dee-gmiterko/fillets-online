
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
    var PACKAGE_NAME = 'web/data/hardware.data';
    var REMOTE_PACKAGE_BASE = 'data/hardware.data';
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
Module['FS_createPath']('/data/images', 'hardware', true, true);
Module['FS_createPath']('/data', 'script', true, true);
Module['FS_createPath']('/data/script', 'hardware', true, true);
Module['FS_createPath']('/data', 'sound', true, true);
Module['FS_createPath']('/data/sound', 'hardware', true, true);
Module['FS_createPath']('/data/sound/hardware', 'cs', true, true);
Module['FS_createPath']('/data/sound/hardware', 'nl', true, true);

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
              Module['removeRunDependency']('datafile_web/data/hardware.data');

    };
    Module['addRunDependency']('datafile_web/data/hardware.data');
  
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
 loadPackage({"files": [{"filename": "/data/images/hardware/pozadi2.png", "start": 0, "end": 226968, "audio": 0}, {"filename": "/data/images/hardware/procesor1.png", "start": 226968, "end": 233484, "audio": 0}, {"filename": "/data/images/hardware/procesor2.png", "start": 233484, "end": 237890, "audio": 0}, {"filename": "/data/images/hardware/procesor3.png", "start": 237890, "end": 244271, "audio": 0}, {"filename": "/data/images/hardware/procesor4.png", "start": 244271, "end": 250829, "audio": 0}, {"filename": "/data/images/hardware/procesor5.png", "start": 250829, "end": 255173, "audio": 0}, {"filename": "/data/images/hardware/procesor6.png", "start": 255173, "end": 259538, "audio": 0}, {"filename": "/data/images/hardware/procesor7.png", "start": 259538, "end": 265876, "audio": 0}, {"filename": "/data/images/hardware/procesor8.png", "start": 265876, "end": 270058, "audio": 0}, {"filename": "/data/images/hardware/puzzle-w.png", "start": 270058, "end": 332543, "audio": 0}, {"filename": "/data/images/hardware/val0.png", "start": 332543, "end": 335061, "audio": 0}, {"filename": "/data/images/hardware/val1.png", "start": 335061, "end": 337888, "audio": 0}, {"filename": "/data/images/hardware/val2.png", "start": 337888, "end": 340735, "audio": 0}, {"filename": "/data/images/hardware/val3.png", "start": 340735, "end": 343316, "audio": 0}, {"filename": "/data/images/hardware/val4.png", "start": 343316, "end": 346273, "audio": 0}, {"filename": "/data/images/hardware/val5.png", "start": 346273, "end": 349300, "audio": 0}, {"filename": "/data/images/hardware/val6.png", "start": 349300, "end": 352344, "audio": 0}, {"filename": "/data/images/hardware/val7.png", "start": 352344, "end": 355046, "audio": 0}, {"filename": "/data/images/hardware/val-spec.png", "start": 355046, "end": 358741, "audio": 0}, {"filename": "/data/script/hardware/code.lua", "start": 358741, "end": 362753, "audio": 0}, {"filename": "/data/script/hardware/dialogs_bg.lua", "start": 362753, "end": 365050, "audio": 0}, {"filename": "/data/script/hardware/dialogs_cs.lua", "start": 365050, "end": 367077, "audio": 0}, {"filename": "/data/script/hardware/dialogs_de.lua", "start": 367077, "end": 369142, "audio": 0}, {"filename": "/data/script/hardware/dialogs_en.lua", "start": 369142, "end": 370372, "audio": 0}, {"filename": "/data/script/hardware/dialogs_es.lua", "start": 370372, "end": 372440, "audio": 0}, {"filename": "/data/script/hardware/dialogs_fr.lua", "start": 372440, "end": 374567, "audio": 0}, {"filename": "/data/script/hardware/dialogs_it.lua", "start": 374567, "end": 376551, "audio": 0}, {"filename": "/data/script/hardware/dialogs.lua", "start": 376551, "end": 376589, "audio": 0}, {"filename": "/data/script/hardware/dialogs_nl.lua", "start": 376589, "end": 378644, "audio": 0}, {"filename": "/data/script/hardware/dialogs_pl.lua", "start": 378644, "end": 380625, "audio": 0}, {"filename": "/data/script/hardware/dialogs_ru.lua", "start": 380625, "end": 382964, "audio": 0}, {"filename": "/data/script/hardware/dialogs_sv.lua", "start": 382964, "end": 385006, "audio": 0}, {"filename": "/data/script/hardware/init.lua", "start": 385006, "end": 385653, "audio": 0}, {"filename": "/data/script/hardware/models.lua", "start": 385653, "end": 389436, "audio": 0}, {"filename": "/data/sound/hardware/cs/pz-m-co.ogg", "start": 389436, "end": 404343, "audio": 1}, {"filename": "/data/sound/hardware/cs/pz-m-nech.ogg", "start": 404343, "end": 414954, "audio": 1}, {"filename": "/data/sound/hardware/cs/pz-m-nepasuje.ogg", "start": 414954, "end": 428774, "audio": 1}, {"filename": "/data/sound/hardware/cs/pz-m-pocitace.ogg", "start": 428774, "end": 469090, "audio": 1}, {"filename": "/data/sound/hardware/cs/pz-m-spoje1.ogg", "start": 469090, "end": 487567, "audio": 1}, {"filename": "/data/sound/hardware/cs/pz-m-spoje2.ogg", "start": 487567, "end": 507622, "audio": 1}, {"filename": "/data/sound/hardware/cs/pz-m-spoje3.ogg", "start": 507622, "end": 525435, "audio": 1}, {"filename": "/data/sound/hardware/cs/pz-m-vylez.ogg", "start": 525435, "end": 535916, "audio": 1}, {"filename": "/data/sound/hardware/cs/pz-v-co1.ogg", "start": 535916, "end": 557385, "audio": 1}, {"filename": "/data/sound/hardware/cs/pz-v-co2.ogg", "start": 557385, "end": 571121, "audio": 1}, {"filename": "/data/sound/hardware/cs/pz-v-dat.ogg", "start": 571121, "end": 588436, "audio": 1}, {"filename": "/data/sound/hardware/cs/pz-v-hej.ogg", "start": 588436, "end": 615092, "audio": 1}, {"filename": "/data/sound/hardware/cs/pz-v-klice1.ogg", "start": 615092, "end": 635512, "audio": 1}, {"filename": "/data/sound/hardware/cs/pz-v-klice2.ogg", "start": 635512, "end": 653867, "audio": 1}, {"filename": "/data/sound/hardware/cs/pz-v-zaskladanej.ogg", "start": 653867, "end": 671955, "audio": 1}, {"filename": "/data/sound/hardware/cs/pz-x-pocitac.ogg", "start": 671955, "end": 725768, "audio": 1}, {"filename": "/data/sound/hardware/nl/pz-m-co.ogg", "start": 725768, "end": 742139, "audio": 1}, {"filename": "/data/sound/hardware/nl/pz-m-nech.ogg", "start": 742139, "end": 757768, "audio": 1}, {"filename": "/data/sound/hardware/nl/pz-m-nepasuje.ogg", "start": 757768, "end": 776080, "audio": 1}, {"filename": "/data/sound/hardware/nl/pz-m-pocitace.ogg", "start": 776080, "end": 809019, "audio": 1}, {"filename": "/data/sound/hardware/nl/pz-m-spoje1.ogg", "start": 809019, "end": 827027, "audio": 1}, {"filename": "/data/sound/hardware/nl/pz-m-spoje2.ogg", "start": 827027, "end": 846724, "audio": 1}, {"filename": "/data/sound/hardware/nl/pz-m-spoje3.ogg", "start": 846724, "end": 866744, "audio": 1}, {"filename": "/data/sound/hardware/nl/pz-m-vylez.ogg", "start": 866744, "end": 883482, "audio": 1}, {"filename": "/data/sound/hardware/nl/pz-v-co1.ogg", "start": 883482, "end": 903054, "audio": 1}, {"filename": "/data/sound/hardware/nl/pz-v-co2.ogg", "start": 903054, "end": 921712, "audio": 1}, {"filename": "/data/sound/hardware/nl/pz-v-dat.ogg", "start": 921712, "end": 945041, "audio": 1}, {"filename": "/data/sound/hardware/nl/pz-v-hej.ogg", "start": 945041, "end": 971998, "audio": 1}, {"filename": "/data/sound/hardware/nl/pz-v-klice1.ogg", "start": 971998, "end": 997224, "audio": 1}, {"filename": "/data/sound/hardware/nl/pz-v-klice2.ogg", "start": 997224, "end": 1018350, "audio": 1}, {"filename": "/data/sound/hardware/nl/pz-v-zaskladanej.ogg", "start": 1018350, "end": 1039495, "audio": 1}], "remote_package_size": 1039495, "package_uuid": "dc469225-1933-4f9c-a3d2-87b9f358d4bf"});

})();
