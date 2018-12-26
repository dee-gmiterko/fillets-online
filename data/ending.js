
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
    var PACKAGE_NAME = 'web/data/ending.data';
    var REMOTE_PACKAGE_BASE = 'data/ending.data';
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
Module['FS_createPath']('/data/images', 'ending', true, true);
Module['FS_createPath']('/data', 'script', true, true);
Module['FS_createPath']('/data/script', 'ending', true, true);
Module['FS_createPath']('/data', 'sound', true, true);
Module['FS_createPath']('/data/sound', 'ending', true, true);
Module['FS_createPath']('/data/sound/ending', 'cs', true, true);
Module['FS_createPath']('/data/sound/ending', 'en', true, true);
Module['FS_createPath']('/data/sound/ending', 'nl', true, true);

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
              Module['removeRunDependency']('datafile_web/data/ending.data');

    };
    Module['addRunDependency']('datafile_web/data/ending.data');
  
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
 loadPackage({"files": [{"filename": "/data/images/ending/pldik_00.png", "start": 0, "end": 1859, "audio": 0}, {"filename": "/data/images/ending/pldik_01.png", "start": 1859, "end": 3715, "audio": 0}, {"filename": "/data/images/ending/pldik_02.png", "start": 3715, "end": 5650, "audio": 0}, {"filename": "/data/images/ending/pldik_03.png", "start": 5650, "end": 7575, "audio": 0}, {"filename": "/data/images/ending/pldik_04.png", "start": 7575, "end": 9431, "audio": 0}, {"filename": "/data/images/ending/pldik_05.png", "start": 9431, "end": 11278, "audio": 0}, {"filename": "/data/images/ending/pldik_06.png", "start": 11278, "end": 13111, "audio": 0}, {"filename": "/data/images/ending/pldik_07.png", "start": 13111, "end": 14940, "audio": 0}, {"filename": "/data/images/ending/pldik_08.png", "start": 14940, "end": 16781, "audio": 0}, {"filename": "/data/images/ending/pldik_09.png", "start": 16781, "end": 18620, "audio": 0}, {"filename": "/data/images/ending/pldik_10.png", "start": 18620, "end": 20482, "audio": 0}, {"filename": "/data/images/ending/pldik_11.png", "start": 20482, "end": 22336, "audio": 0}, {"filename": "/data/images/ending/pldik_12.png", "start": 22336, "end": 24309, "audio": 0}, {"filename": "/data/images/ending/pldik_13.png", "start": 24309, "end": 26257, "audio": 0}, {"filename": "/data/images/ending/polstar.png", "start": 26257, "end": 27798, "audio": 0}, {"filename": "/data/images/ending/poster.png", "start": 27798, "end": 175169, "audio": 0}, {"filename": "/data/images/ending/prvni-p.png", "start": 175169, "end": 360203, "audio": 0}, {"filename": "/data/images/ending/prvni-w.png", "start": 360203, "end": 584362, "audio": 0}, {"filename": "/data/images/ending/stul.png", "start": 584362, "end": 588594, "audio": 0}, {"filename": "/data/images/ending/zidle_m.png", "start": 588594, "end": 592789, "audio": 0}, {"filename": "/data/images/ending/zidle_v.png", "start": 592789, "end": 597003, "audio": 0}, {"filename": "/data/script/ending/code.lua", "start": 597003, "end": 606996, "audio": 0}, {"filename": "/data/script/ending/demo_dialogs_bg.lua", "start": 606996, "end": 608615, "audio": 0}, {"filename": "/data/script/ending/demo_dialogs_cs.lua", "start": 608615, "end": 609387, "audio": 0}, {"filename": "/data/script/ending/demo_dialogs_de.lua", "start": 609387, "end": 610716, "audio": 0}, {"filename": "/data/script/ending/demo_dialogs_en.lua", "start": 610716, "end": 611413, "audio": 0}, {"filename": "/data/script/ending/demo_dialogs_es.lua", "start": 611413, "end": 612720, "audio": 0}, {"filename": "/data/script/ending/demo_dialogs_fr.lua", "start": 612720, "end": 614039, "audio": 0}, {"filename": "/data/script/ending/demo_dialogs_it.lua", "start": 614039, "end": 615333, "audio": 0}, {"filename": "/data/script/ending/demo_dialogs_nl.lua", "start": 615333, "end": 616691, "audio": 0}, {"filename": "/data/script/ending/demo_dialogs_pl.lua", "start": 616691, "end": 618078, "audio": 0}, {"filename": "/data/script/ending/demo_dialogs_ru.lua", "start": 618078, "end": 619833, "audio": 0}, {"filename": "/data/script/ending/demo_dialogs_sv.lua", "start": 619833, "end": 621132, "audio": 0}, {"filename": "/data/script/ending/demo_poster.lua", "start": 621132, "end": 621573, "audio": 0}, {"filename": "/data/script/ending/dialogs_bg.lua", "start": 621573, "end": 626128, "audio": 0}, {"filename": "/data/script/ending/dialogs_cs.lua", "start": 626128, "end": 629884, "audio": 0}, {"filename": "/data/script/ending/dialogs_de_CH.lua", "start": 629884, "end": 630907, "audio": 0}, {"filename": "/data/script/ending/dialogs_de.lua", "start": 630907, "end": 633371, "audio": 0}, {"filename": "/data/script/ending/dialogs_en.lua", "start": 633371, "end": 635843, "audio": 0}, {"filename": "/data/script/ending/dialogs_es.lua", "start": 635843, "end": 638260, "audio": 0}, {"filename": "/data/script/ending/dialogs_fr.lua", "start": 638260, "end": 640771, "audio": 0}, {"filename": "/data/script/ending/dialogs_it.lua", "start": 640771, "end": 643164, "audio": 0}, {"filename": "/data/script/ending/dialogs.lua", "start": 643164, "end": 643202, "audio": 0}, {"filename": "/data/script/ending/dialogs_nl.lua", "start": 643202, "end": 645653, "audio": 0}, {"filename": "/data/script/ending/dialogs_pl.lua", "start": 645653, "end": 649482, "audio": 0}, {"filename": "/data/script/ending/dialogs_ru.lua", "start": 649482, "end": 654115, "audio": 0}, {"filename": "/data/script/ending/dialogs_sv.lua", "start": 654115, "end": 656477, "audio": 0}, {"filename": "/data/script/ending/init.lua", "start": 656477, "end": 657122, "audio": 0}, {"filename": "/data/script/ending/models.lua", "start": 657122, "end": 658897, "audio": 0}, {"filename": "/data/sound/ending/cs/z-c-100.ogg", "start": 658897, "end": 668898, "audio": 1}, {"filename": "/data/sound/ending/cs/z-c-10.ogg", "start": 668898, "end": 677634, "audio": 1}, {"filename": "/data/sound/ending/cs/z-c-11.ogg", "start": 677634, "end": 687866, "audio": 1}, {"filename": "/data/sound/ending/cs/z-c-12.ogg", "start": 687866, "end": 697275, "audio": 1}, {"filename": "/data/sound/ending/cs/z-c-13.ogg", "start": 697275, "end": 707223, "audio": 1}, {"filename": "/data/sound/ending/cs/z-c-14.ogg", "start": 707223, "end": 717132, "audio": 1}, {"filename": "/data/sound/ending/cs/z-c-15.ogg", "start": 717132, "end": 727081, "audio": 1}, {"filename": "/data/sound/ending/cs/z-c-16.ogg", "start": 727081, "end": 737564, "audio": 1}, {"filename": "/data/sound/ending/cs/z-c-17.ogg", "start": 737564, "end": 747853, "audio": 1}, {"filename": "/data/sound/ending/cs/z-c-18.ogg", "start": 747853, "end": 757917, "audio": 1}, {"filename": "/data/sound/ending/cs/z-c-19.ogg", "start": 757917, "end": 768496, "audio": 1}, {"filename": "/data/sound/ending/cs/z-c-1.ogg", "start": 768496, "end": 777855, "audio": 1}, {"filename": "/data/sound/ending/cs/z-c-200.ogg", "start": 777855, "end": 789386, "audio": 1}, {"filename": "/data/sound/ending/cs/z-c-20.ogg", "start": 789386, "end": 798712, "audio": 1}, {"filename": "/data/sound/ending/cs/z-c-2.ogg", "start": 798712, "end": 806544, "audio": 1}, {"filename": "/data/sound/ending/cs/z-c-30.ogg", "start": 806544, "end": 815923, "audio": 1}, {"filename": "/data/sound/ending/cs/z-c-3.ogg", "start": 815923, "end": 824630, "audio": 1}, {"filename": "/data/sound/ending/cs/z-c-40.ogg", "start": 824630, "end": 835377, "audio": 1}, {"filename": "/data/sound/ending/cs/z-c-4.ogg", "start": 835377, "end": 844873, "audio": 1}, {"filename": "/data/sound/ending/cs/z-c-50.ogg", "start": 844873, "end": 854863, "audio": 1}, {"filename": "/data/sound/ending/cs/z-c-5.ogg", "start": 854863, "end": 862905, "audio": 1}, {"filename": "/data/sound/ending/cs/z-c-60.ogg", "start": 862905, "end": 874107, "audio": 1}, {"filename": "/data/sound/ending/cs/z-c-6.ogg", "start": 874107, "end": 881670, "audio": 1}, {"filename": "/data/sound/ending/cs/z-c-70.ogg", "start": 881670, "end": 893346, "audio": 1}, {"filename": "/data/sound/ending/cs/z-c-7.ogg", "start": 893346, "end": 901759, "audio": 1}, {"filename": "/data/sound/ending/cs/z-c-80.ogg", "start": 901759, "end": 912762, "audio": 1}, {"filename": "/data/sound/ending/cs/z-c-8.ogg", "start": 912762, "end": 920389, "audio": 1}, {"filename": "/data/sound/ending/cs/z-c-90.ogg", "start": 920389, "end": 931155, "audio": 1}, {"filename": "/data/sound/ending/cs/z-c-9.ogg", "start": 931155, "end": 939658, "audio": 1}, {"filename": "/data/sound/ending/cs/z-c-hodin.ogg", "start": 939658, "end": 948791, "audio": 1}, {"filename": "/data/sound/ending/cs/z-c-konkretne.ogg", "start": 948791, "end": 960214, "audio": 1}, {"filename": "/data/sound/ending/cs/z-c-set.ogg", "start": 960214, "end": 969507, "audio": 1}, {"filename": "/data/sound/ending/cs/z-c-sta.ogg", "start": 969507, "end": 979601, "audio": 1}, {"filename": "/data/sound/ending/cs/z-c-tisice.ogg", "start": 979601, "end": 989656, "audio": 1}, {"filename": "/data/sound/ending/cs/z-c-tisic.ogg", "start": 989656, "end": 999269, "audio": 1}, {"filename": "/data/sound/ending/cs/z-m-dlouho.ogg", "start": 999269, "end": 1022408, "audio": 1}, {"filename": "/data/sound/ending/cs/z-m-nemluv.ogg", "start": 1022408, "end": 1059399, "audio": 1}, {"filename": "/data/sound/ending/cs/z-m-netusi.ogg", "start": 1059399, "end": 1094791, "audio": 1}, {"filename": "/data/sound/ending/cs/z-m-oblicej.ogg", "start": 1094791, "end": 1148750, "audio": 1}, {"filename": "/data/sound/ending/cs/z-m-pocit.ogg", "start": 1148750, "end": 1173677, "audio": 1}, {"filename": "/data/sound/ending/cs/z-o-blahoprejeme.ogg", "start": 1173677, "end": 1189342, "audio": 1}, {"filename": "/data/sound/ending/cs/z-v-doma.ogg", "start": 1189342, "end": 1206092, "audio": 1}, {"filename": "/data/sound/ending/cs/z-v-forky.ogg", "start": 1206092, "end": 1239960, "audio": 1}, {"filename": "/data/sound/ending/cs/z-v-pozdrav.ogg", "start": 1239960, "end": 1319552, "audio": 1}, {"filename": "/data/sound/ending/cs/z-v-sef.ogg", "start": 1319552, "end": 1346997, "audio": 1}, {"filename": "/data/sound/ending/cs/z-v-slyset.ogg", "start": 1346997, "end": 1365325, "audio": 1}, {"filename": "/data/sound/ending/en/bar-x-suck0.ogg", "start": 1365325, "end": 1371122, "audio": 1}, {"filename": "/data/sound/ending/en/bar-x-suck1.ogg", "start": 1371122, "end": 1376363, "audio": 1}, {"filename": "/data/sound/ending/en/bar-x-suck2.ogg", "start": 1376363, "end": 1382871, "audio": 1}, {"filename": "/data/sound/ending/en/bar-x-suck3.ogg", "start": 1382871, "end": 1389578, "audio": 1}, {"filename": "/data/sound/ending/en/bar-x-suckano.ogg", "start": 1389578, "end": 1401676, "audio": 1}, {"filename": "/data/sound/ending/nl/z-m-dlouho.ogg", "start": 1401676, "end": 1423440, "audio": 1}, {"filename": "/data/sound/ending/nl/z-m-nemluv.ogg", "start": 1423440, "end": 1463119, "audio": 1}, {"filename": "/data/sound/ending/nl/z-m-netusi.ogg", "start": 1463119, "end": 1486825, "audio": 1}, {"filename": "/data/sound/ending/nl/z-m-oblicej.ogg", "start": 1486825, "end": 1526881, "audio": 1}, {"filename": "/data/sound/ending/nl/z-m-pocit.ogg", "start": 1526881, "end": 1552005, "audio": 1}, {"filename": "/data/sound/ending/nl/z-v-doma.ogg", "start": 1552005, "end": 1572029, "audio": 1}, {"filename": "/data/sound/ending/nl/z-v-forky.ogg", "start": 1572029, "end": 1605053, "audio": 1}, {"filename": "/data/sound/ending/nl/z-v-pozdrav.ogg", "start": 1605053, "end": 1680237, "audio": 1}, {"filename": "/data/sound/ending/nl/z-v-sef.ogg", "start": 1680237, "end": 1711214, "audio": 1}, {"filename": "/data/sound/ending/nl/z-v-slyset.ogg", "start": 1711214, "end": 1735175, "audio": 1}], "remote_package_size": 1735175, "package_uuid": "1e57676d-7663-49af-a139-d926fbfcd669"});

})();
