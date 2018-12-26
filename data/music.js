
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
    var PACKAGE_NAME = 'web/data/music.data';
    var REMOTE_PACKAGE_BASE = 'data/music.data';
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
Module['FS_createPath']('/data/images', 'music', true, true);
Module['FS_createPath']('/data', 'script', true, true);
Module['FS_createPath']('/data/script', 'music', true, true);
Module['FS_createPath']('/data', 'sound', true, true);
Module['FS_createPath']('/data/sound', 'music', true, true);
Module['FS_createPath']('/data/sound/music', 'cs', true, true);
Module['FS_createPath']('/data/sound/music', 'en', true, true);
Module['FS_createPath']('/data/sound/music', 'nl', true, true);

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
              Module['removeRunDependency']('datafile_web/data/music.data');

    };
    Module['addRunDependency']('datafile_web/data/music.data');
  
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
 loadPackage({"files": [{"filename": "/data/images/music/amp_00.png", "start": 0, "end": 1727, "audio": 0}, {"filename": "/data/images/music/amp_01.png", "start": 1727, "end": 3148, "audio": 0}, {"filename": "/data/images/music/amp_02.png", "start": 3148, "end": 4309, "audio": 0}, {"filename": "/data/images/music/amp_03.png", "start": 4309, "end": 5554, "audio": 0}, {"filename": "/data/images/music/amp_04.png", "start": 5554, "end": 6720, "audio": 0}, {"filename": "/data/images/music/amp_05.png", "start": 6720, "end": 8143, "audio": 0}, {"filename": "/data/images/music/amp_06.png", "start": 8143, "end": 9862, "audio": 0}, {"filename": "/data/images/music/amp_07.png", "start": 9862, "end": 11628, "audio": 0}, {"filename": "/data/images/music/amp_08.png", "start": 11628, "end": 13096, "audio": 0}, {"filename": "/data/images/music/amp_09.png", "start": 13096, "end": 15021, "audio": 0}, {"filename": "/data/images/music/hlava_00.png", "start": 15021, "end": 18631, "audio": 0}, {"filename": "/data/images/music/hlava_01.png", "start": 18631, "end": 22297, "audio": 0}, {"filename": "/data/images/music/hlava_02.png", "start": 22297, "end": 25856, "audio": 0}, {"filename": "/data/images/music/hlava_03.png", "start": 25856, "end": 29538, "audio": 0}, {"filename": "/data/images/music/hlava_04.png", "start": 29538, "end": 33127, "audio": 0}, {"filename": "/data/images/music/hlava_05.png", "start": 33127, "end": 36710, "audio": 0}, {"filename": "/data/images/music/hlava_06.png", "start": 36710, "end": 40274, "audio": 0}, {"filename": "/data/images/music/hlava_07.png", "start": 40274, "end": 43809, "audio": 0}, {"filename": "/data/images/music/hlava_08.png", "start": 43809, "end": 47377, "audio": 0}, {"filename": "/data/images/music/hlava_09.png", "start": 47377, "end": 50986, "audio": 0}, {"filename": "/data/images/music/hlava_10.png", "start": 50986, "end": 54596, "audio": 0}, {"filename": "/data/images/music/hlava_11.png", "start": 54596, "end": 58282, "audio": 0}, {"filename": "/data/images/music/hlava_12.png", "start": 58282, "end": 61879, "audio": 0}, {"filename": "/data/images/music/hlava_13.png", "start": 61879, "end": 65456, "audio": 0}, {"filename": "/data/images/music/hlava_14.png", "start": 65456, "end": 69082, "audio": 0}, {"filename": "/data/images/music/hlava_15.png", "start": 69082, "end": 72783, "audio": 0}, {"filename": "/data/images/music/hlava_16.png", "start": 72783, "end": 76386, "audio": 0}, {"filename": "/data/images/music/hlava_17.png", "start": 76386, "end": 79993, "audio": 0}, {"filename": "/data/images/music/hlava_18.png", "start": 79993, "end": 83585, "audio": 0}, {"filename": "/data/images/music/hlava_19.png", "start": 83585, "end": 87269, "audio": 0}, {"filename": "/data/images/music/hlava_m-_00.png", "start": 87269, "end": 87985, "audio": 0}, {"filename": "/data/images/music/hlava_m-_01.png", "start": 87985, "end": 88710, "audio": 0}, {"filename": "/data/images/music/hlava_m-_02.png", "start": 88710, "end": 89446, "audio": 0}, {"filename": "/data/images/music/krab_00.png", "start": 89446, "end": 90529, "audio": 0}, {"filename": "/data/images/music/krab_01.png", "start": 90529, "end": 91607, "audio": 0}, {"filename": "/data/images/music/krab_02.png", "start": 91607, "end": 92671, "audio": 0}, {"filename": "/data/images/music/krab_03.png", "start": 92671, "end": 93743, "audio": 0}, {"filename": "/data/images/music/krab_04.png", "start": 93743, "end": 94821, "audio": 0}, {"filename": "/data/images/music/krab_05.png", "start": 94821, "end": 95902, "audio": 0}, {"filename": "/data/images/music/lebka.png", "start": 95902, "end": 97719, "audio": 0}, {"filename": "/data/images/music/sloupek.png", "start": 97719, "end": 98781, "audio": 0}, {"filename": "/data/images/music/stalagnat.png", "start": 98781, "end": 102700, "audio": 0}, {"filename": "/data/images/music/stalagnit.png", "start": 102700, "end": 105405, "audio": 0}, {"filename": "/data/images/music/stalaktit.png", "start": 105405, "end": 107613, "audio": 0}, {"filename": "/data/images/music/ves-12-tmp.png", "start": 107613, "end": 114193, "audio": 0}, {"filename": "/data/images/music/ves-17-tmp.png", "start": 114193, "end": 114691, "audio": 0}, {"filename": "/data/images/music/ves-8-tmp.png", "start": 114691, "end": 115558, "audio": 0}, {"filename": "/data/images/music/ves-p.png", "start": 115558, "end": 383648, "audio": 0}, {"filename": "/data/images/music/ves-w.png", "start": 383648, "end": 573609, "audio": 0}, {"filename": "/data/script/music/code.lua", "start": 573609, "end": 588865, "audio": 0}, {"filename": "/data/script/music/dialogs_bg.lua", "start": 588865, "end": 590143, "audio": 0}, {"filename": "/data/script/music/dialogs_cs.lua", "start": 590143, "end": 591033, "audio": 0}, {"filename": "/data/script/music/dialogs_de.lua", "start": 591033, "end": 591963, "audio": 0}, {"filename": "/data/script/music/dialogs_en.lua", "start": 591963, "end": 592664, "audio": 0}, {"filename": "/data/script/music/dialogs_es.lua", "start": 592664, "end": 593583, "audio": 0}, {"filename": "/data/script/music/dialogs_fr.lua", "start": 593583, "end": 594531, "audio": 0}, {"filename": "/data/script/music/dialogs_it.lua", "start": 594531, "end": 595416, "audio": 0}, {"filename": "/data/script/music/dialogs.lua", "start": 595416, "end": 595454, "audio": 0}, {"filename": "/data/script/music/dialogs_nl.lua", "start": 595454, "end": 596384, "audio": 0}, {"filename": "/data/script/music/dialogs_pl.lua", "start": 596384, "end": 597278, "audio": 0}, {"filename": "/data/script/music/dialogs_ru.lua", "start": 597278, "end": 598639, "audio": 0}, {"filename": "/data/script/music/dialogs_sv.lua", "start": 598639, "end": 599548, "audio": 0}, {"filename": "/data/script/music/init.lua", "start": 599548, "end": 600192, "audio": 0}, {"filename": "/data/script/music/models.lua", "start": 600192, "end": 603911, "audio": 0}, {"filename": "/data/sound/music/cs/ves-hs-hrajeme.ogg", "start": 603911, "end": 622878, "audio": 1}, {"filename": "/data/sound/music/cs/ves-m-dik.ogg", "start": 622878, "end": 646727, "audio": 1}, {"filename": "/data/sound/music/cs/ves-m-krab.ogg", "start": 646727, "end": 662070, "audio": 1}, {"filename": "/data/sound/music/cs/ves-m-uz.ogg", "start": 662070, "end": 674761, "audio": 1}, {"filename": "/data/sound/music/cs/ves-v-pokoj.ogg", "start": 674761, "end": 685182, "audio": 1}, {"filename": "/data/sound/music/cs/ves-v-stejne.ogg", "start": 685182, "end": 702597, "audio": 1}, {"filename": "/data/sound/music/cs/ves-v-veci.ogg", "start": 702597, "end": 722799, "audio": 1}, {"filename": "/data/sound/music/cs/ves-v-vyp.ogg", "start": 722799, "end": 739414, "audio": 1}, {"filename": "/data/sound/music/en/sp-smrt.ogg", "start": 739414, "end": 746553, "audio": 1}, {"filename": "/data/sound/music/en/ves-ampliony.ogg", "start": 746553, "end": 826291, "audio": 1}, {"filename": "/data/sound/music/en/ves-hs-papa.ogg", "start": 826291, "end": 899423, "audio": 1}, {"filename": "/data/sound/music/nl/ves-m-dik.ogg", "start": 899423, "end": 925092, "audio": 1}, {"filename": "/data/sound/music/nl/ves-m-krab.ogg", "start": 925092, "end": 941878, "audio": 1}, {"filename": "/data/sound/music/nl/ves-m-uz.ogg", "start": 941878, "end": 959748, "audio": 1}, {"filename": "/data/sound/music/nl/ves-v-pokoj.ogg", "start": 959748, "end": 975871, "audio": 1}, {"filename": "/data/sound/music/nl/ves-v-stejne.ogg", "start": 975871, "end": 994687, "audio": 1}, {"filename": "/data/sound/music/nl/ves-v-veci.ogg", "start": 994687, "end": 1018640, "audio": 1}, {"filename": "/data/sound/music/nl/ves-v-vyp.ogg", "start": 1018640, "end": 1037179, "audio": 1}], "remote_package_size": 1037179, "package_uuid": "7507c85e-407a-40d0-8748-6e511aba4134"});

})();
