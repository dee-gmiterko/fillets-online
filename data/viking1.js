
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
    var PACKAGE_NAME = 'web/data/viking1.data';
    var REMOTE_PACKAGE_BASE = 'data/viking1.data';
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
Module['FS_createPath']('/data/images', 'viking1', true, true);
Module['FS_createPath']('/data', 'script', true, true);
Module['FS_createPath']('/data/script', 'viking1', true, true);
Module['FS_createPath']('/data', 'sound', true, true);
Module['FS_createPath']('/data/sound', 'viking1', true, true);
Module['FS_createPath']('/data/sound/viking1', 'cs', true, true);
Module['FS_createPath']('/data/sound/viking1', 'en', true, true);
Module['FS_createPath']('/data/sound/viking1', 'nl', true, true);

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
              Module['removeRunDependency']('datafile_web/data/viking1.data');

    };
    Module['addRunDependency']('datafile_web/data/viking1.data');
  
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
 loadPackage({"files": [{"filename": "/data/images/viking1/drakar1-p.png", "start": 0, "end": 173627, "audio": 0}, {"filename": "/data/images/viking1/drakar1-w.png", "start": 173627, "end": 385957, "audio": 0}, {"filename": "/data/images/viking1/lebzna1.png", "start": 385957, "end": 387761, "audio": 0}, {"filename": "/data/images/viking1/maly_snek_00.png", "start": 387761, "end": 388435, "audio": 0}, {"filename": "/data/images/viking1/maly_snek_01.png", "start": 388435, "end": 389132, "audio": 0}, {"filename": "/data/images/viking1/maly_snek_02.png", "start": 389132, "end": 389849, "audio": 0}, {"filename": "/data/images/viking1/maly_snek_03.png", "start": 389849, "end": 390509, "audio": 0}, {"filename": "/data/images/viking1/sekera1.png", "start": 390509, "end": 394378, "audio": 0}, {"filename": "/data/images/viking1/sekera2.png", "start": 394378, "end": 398272, "audio": 0}, {"filename": "/data/images/viking1/stit-na_vysku.png", "start": 398272, "end": 399721, "audio": 0}, {"filename": "/data/images/viking1/stit_zepredu.png", "start": 399721, "end": 402950, "audio": 0}, {"filename": "/data/images/viking1/vik1_00.png", "start": 402950, "end": 409759, "audio": 0}, {"filename": "/data/images/viking1/vik1_01.png", "start": 409759, "end": 416545, "audio": 0}, {"filename": "/data/images/viking1/vik1_02.png", "start": 416545, "end": 423342, "audio": 0}, {"filename": "/data/images/viking1/vik1_03.png", "start": 423342, "end": 429989, "audio": 0}, {"filename": "/data/images/viking1/vik1_04.png", "start": 429989, "end": 436722, "audio": 0}, {"filename": "/data/images/viking1/vik2_00.png", "start": 436722, "end": 442926, "audio": 0}, {"filename": "/data/images/viking1/vik2_01.png", "start": 442926, "end": 449312, "audio": 0}, {"filename": "/data/images/viking1/vik2_02.png", "start": 449312, "end": 455659, "audio": 0}, {"filename": "/data/images/viking1/vik2_03.png", "start": 455659, "end": 462001, "audio": 0}, {"filename": "/data/images/viking1/vik2_04.png", "start": 462001, "end": 468311, "audio": 0}, {"filename": "/data/images/viking1/vik5_00.png", "start": 468311, "end": 474527, "audio": 0}, {"filename": "/data/images/viking1/vik5_01.png", "start": 474527, "end": 480791, "audio": 0}, {"filename": "/data/images/viking1/vik5_02.png", "start": 480791, "end": 487399, "audio": 0}, {"filename": "/data/images/viking1/vik5_03.png", "start": 487399, "end": 493824, "audio": 0}, {"filename": "/data/images/viking1/vik6_00.png", "start": 493824, "end": 500771, "audio": 0}, {"filename": "/data/images/viking1/vik6_01.png", "start": 500771, "end": 507700, "audio": 0}, {"filename": "/data/images/viking1/vik6_02.png", "start": 507700, "end": 514638, "audio": 0}, {"filename": "/data/images/viking1/vik6_03.png", "start": 514638, "end": 521559, "audio": 0}, {"filename": "/data/images/viking1/vik7_00.png", "start": 521559, "end": 528014, "audio": 0}, {"filename": "/data/images/viking1/vik7_01.png", "start": 528014, "end": 534479, "audio": 0}, {"filename": "/data/images/viking1/vik7_02.png", "start": 534479, "end": 541136, "audio": 0}, {"filename": "/data/images/viking1/vik7_03.png", "start": 541136, "end": 547794, "audio": 0}, {"filename": "/data/images/viking1/vik7_04.png", "start": 547794, "end": 554074, "audio": 0}, {"filename": "/data/images/viking1/vik7_05.png", "start": 554074, "end": 560354, "audio": 0}, {"filename": "/data/images/viking1/vik7_06.png", "start": 560354, "end": 566612, "audio": 0}, {"filename": "/data/images/viking1/vik7_07.png", "start": 566612, "end": 572880, "audio": 0}, {"filename": "/data/script/viking1/code.lua", "start": 572880, "end": 585191, "audio": 0}, {"filename": "/data/script/viking1/dialogs_bg.lua", "start": 585191, "end": 588289, "audio": 0}, {"filename": "/data/script/viking1/dialogs_cs.lua", "start": 588289, "end": 590602, "audio": 0}, {"filename": "/data/script/viking1/dialogs_de.lua", "start": 590602, "end": 593105, "audio": 0}, {"filename": "/data/script/viking1/dialogs_en.lua", "start": 593105, "end": 594798, "audio": 0}, {"filename": "/data/script/viking1/dialogs_es.lua", "start": 594798, "end": 597283, "audio": 0}, {"filename": "/data/script/viking1/dialogs_fr.lua", "start": 597283, "end": 599790, "audio": 0}, {"filename": "/data/script/viking1/dialogs_it.lua", "start": 599790, "end": 602167, "audio": 0}, {"filename": "/data/script/viking1/dialogs.lua", "start": 602167, "end": 602205, "audio": 0}, {"filename": "/data/script/viking1/dialogs_nl.lua", "start": 602205, "end": 604662, "audio": 0}, {"filename": "/data/script/viking1/dialogs_pl.lua", "start": 604662, "end": 607008, "audio": 0}, {"filename": "/data/script/viking1/dialogs_ru.lua", "start": 607008, "end": 610171, "audio": 0}, {"filename": "/data/script/viking1/dialogs_sv.lua", "start": 610171, "end": 612547, "audio": 0}, {"filename": "/data/script/viking1/init.lua", "start": 612547, "end": 613193, "audio": 0}, {"filename": "/data/script/viking1/models.lua", "start": 613193, "end": 616177, "audio": 0}, {"filename": "/data/sound/viking1/cs/d1-1-hudba0.ogg", "start": 616177, "end": 634472, "audio": 1}, {"filename": "/data/sound/viking1/cs/d1-1-hudba1.ogg", "start": 634472, "end": 651368, "audio": 1}, {"filename": "/data/sound/viking1/cs/d1-1-hudba2.ogg", "start": 651368, "end": 668135, "audio": 1}, {"filename": "/data/sound/viking1/cs/d1-2-brb0.ogg", "start": 668135, "end": 682065, "audio": 1}, {"filename": "/data/sound/viking1/cs/d1-2-brb1.ogg", "start": 682065, "end": 697270, "audio": 1}, {"filename": "/data/sound/viking1/cs/d1-2-brb2.ogg", "start": 697270, "end": 713979, "audio": 1}, {"filename": "/data/sound/viking1/cs/d1-3-brb0.ogg", "start": 713979, "end": 730488, "audio": 1}, {"filename": "/data/sound/viking1/cs/d1-3-brb1.ogg", "start": 730488, "end": 746883, "audio": 1}, {"filename": "/data/sound/viking1/cs/d1-3-brb2.ogg", "start": 746883, "end": 763835, "audio": 1}, {"filename": "/data/sound/viking1/cs/d1-4-brb0.ogg", "start": 763835, "end": 784267, "audio": 1}, {"filename": "/data/sound/viking1/cs/d1-4-brb1.ogg", "start": 784267, "end": 803327, "audio": 1}, {"filename": "/data/sound/viking1/cs/d1-4-brb2.ogg", "start": 803327, "end": 822281, "audio": 1}, {"filename": "/data/sound/viking1/cs/d1-5-nevadi0.ogg", "start": 822281, "end": 847581, "audio": 1}, {"filename": "/data/sound/viking1/cs/d1-5-nevadi1.ogg", "start": 847581, "end": 873093, "audio": 1}, {"filename": "/data/sound/viking1/cs/d1-5-nevadi2.ogg", "start": 873093, "end": 903523, "audio": 1}, {"filename": "/data/sound/viking1/cs/dr-m-hruza.ogg", "start": 903523, "end": 925491, "audio": 1}, {"filename": "/data/sound/viking1/cs/dr-m-musela.ogg", "start": 925491, "end": 956188, "audio": 1}, {"filename": "/data/sound/viking1/cs/dr-m-tojesnad.ogg", "start": 956188, "end": 971934, "audio": 1}, {"filename": "/data/sound/viking1/cs/dr-v-jiste.ogg", "start": 971934, "end": 990821, "audio": 1}, {"filename": "/data/sound/viking1/cs/dr-v-mozna.ogg", "start": 990821, "end": 1027619, "audio": 1}, {"filename": "/data/sound/viking1/en/d1-z-b1.ogg", "start": 1027619, "end": 1066239, "audio": 1}, {"filename": "/data/sound/viking1/en/d1-z-b2.ogg", "start": 1066239, "end": 1100725, "audio": 1}, {"filename": "/data/sound/viking1/en/d1-z-b3.ogg", "start": 1100725, "end": 1139283, "audio": 1}, {"filename": "/data/sound/viking1/en/d1-z-p1.ogg", "start": 1139283, "end": 1176601, "audio": 1}, {"filename": "/data/sound/viking1/en/d1-z-p2.ogg", "start": 1176601, "end": 1215616, "audio": 1}, {"filename": "/data/sound/viking1/en/d1-z-v0.ogg", "start": 1215616, "end": 1253000, "audio": 1}, {"filename": "/data/sound/viking1/en/d1-z-v1.ogg", "start": 1253000, "end": 1290355, "audio": 1}, {"filename": "/data/sound/viking1/en/d1-z-v2.ogg", "start": 1290355, "end": 1328106, "audio": 1}, {"filename": "/data/sound/viking1/nl/dr-m-hruza.ogg", "start": 1328106, "end": 1355664, "audio": 1}, {"filename": "/data/sound/viking1/nl/dr-m-musela.ogg", "start": 1355664, "end": 1380583, "audio": 1}, {"filename": "/data/sound/viking1/nl/dr-m-tojesnad.ogg", "start": 1380583, "end": 1401233, "audio": 1}, {"filename": "/data/sound/viking1/nl/dr-v-jiste.ogg", "start": 1401233, "end": 1421354, "audio": 1}, {"filename": "/data/sound/viking1/nl/dr-v-mozna.ogg", "start": 1421354, "end": 1466275, "audio": 1}], "remote_package_size": 1466275, "package_uuid": "4b36c9f7-9ba8-4d5d-861c-094fe9dfa8a1"});

})();
