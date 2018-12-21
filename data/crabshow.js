
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
    var PACKAGE_NAME = 'web/data/crabshow.data';
    var REMOTE_PACKAGE_BASE = 'data/crabshow.data';
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
Module['FS_createPath']('/data/images', 'crabshow', true, true);
Module['FS_createPath']('/data', 'script', true, true);
Module['FS_createPath']('/data/script', 'crabshow', true, true);
Module['FS_createPath']('/data', 'sound', true, true);
Module['FS_createPath']('/data/sound', 'crabshow', true, true);
Module['FS_createPath']('/data/sound/crabshow', 'cs', true, true);
Module['FS_createPath']('/data/sound/crabshow', 'nl', true, true);

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
              Module['removeRunDependency']('datafile_web/data/crabshow.data');

    };
    Module['addRunDependency']('datafile_web/data/crabshow.data');
  
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
 loadPackage({"files": [{"filename": "/data/images/crabshow/6-ocel.png", "start": 0, "end": 867, "audio": 0}, {"filename": "/data/images/crabshow/anticka_hlava_00.png", "start": 867, "end": 5075, "audio": 0}, {"filename": "/data/images/crabshow/anticka_hlava_01.png", "start": 5075, "end": 9203, "audio": 0}, {"filename": "/data/images/crabshow/anticka_hlava_02.png", "start": 9203, "end": 13407, "audio": 0}, {"filename": "/data/images/crabshow/anticka_hlava_03.png", "start": 13407, "end": 17543, "audio": 0}, {"filename": "/data/images/crabshow/anticka_hlava_ulomena.png", "start": 17543, "end": 21396, "audio": 0}, {"filename": "/data/images/crabshow/balonek_00.png", "start": 21396, "end": 21933, "audio": 0}, {"filename": "/data/images/crabshow/balonek_01.png", "start": 21933, "end": 22470, "audio": 0}, {"filename": "/data/images/crabshow/balonek_02.png", "start": 22470, "end": 22999, "audio": 0}, {"filename": "/data/images/crabshow/balonek_03.png", "start": 22999, "end": 23538, "audio": 0}, {"filename": "/data/images/crabshow/hlava_00.png", "start": 23538, "end": 27148, "audio": 0}, {"filename": "/data/images/crabshow/hlava_01.png", "start": 27148, "end": 30814, "audio": 0}, {"filename": "/data/images/crabshow/hlava_02.png", "start": 30814, "end": 34373, "audio": 0}, {"filename": "/data/images/crabshow/hlava_03.png", "start": 34373, "end": 38055, "audio": 0}, {"filename": "/data/images/crabshow/hlava_04.png", "start": 38055, "end": 41644, "audio": 0}, {"filename": "/data/images/crabshow/hlava_05.png", "start": 41644, "end": 45227, "audio": 0}, {"filename": "/data/images/crabshow/hlava_06.png", "start": 45227, "end": 48791, "audio": 0}, {"filename": "/data/images/crabshow/hlava_07.png", "start": 48791, "end": 52326, "audio": 0}, {"filename": "/data/images/crabshow/hlava_08.png", "start": 52326, "end": 55894, "audio": 0}, {"filename": "/data/images/crabshow/hlava_09.png", "start": 55894, "end": 59503, "audio": 0}, {"filename": "/data/images/crabshow/hlava_10.png", "start": 59503, "end": 63113, "audio": 0}, {"filename": "/data/images/crabshow/hlava_11.png", "start": 63113, "end": 66799, "audio": 0}, {"filename": "/data/images/crabshow/hlava_12.png", "start": 66799, "end": 70396, "audio": 0}, {"filename": "/data/images/crabshow/hlava_13.png", "start": 70396, "end": 73973, "audio": 0}, {"filename": "/data/images/crabshow/hlava_14.png", "start": 73973, "end": 77599, "audio": 0}, {"filename": "/data/images/crabshow/hlava_15.png", "start": 77599, "end": 81300, "audio": 0}, {"filename": "/data/images/crabshow/hlava_16.png", "start": 81300, "end": 84903, "audio": 0}, {"filename": "/data/images/crabshow/hlava_17.png", "start": 84903, "end": 88510, "audio": 0}, {"filename": "/data/images/crabshow/hlava_18.png", "start": 88510, "end": 92102, "audio": 0}, {"filename": "/data/images/crabshow/hlava_19.png", "start": 92102, "end": 95786, "audio": 0}, {"filename": "/data/images/crabshow/kr_00.png", "start": 95786, "end": 100870, "audio": 0}, {"filename": "/data/images/crabshow/kr_01.png", "start": 100870, "end": 106034, "audio": 0}, {"filename": "/data/images/crabshow/kr_02.png", "start": 106034, "end": 111093, "audio": 0}, {"filename": "/data/images/crabshow/kr_03.png", "start": 111093, "end": 116111, "audio": 0}, {"filename": "/data/images/crabshow/kr_04.png", "start": 116111, "end": 121269, "audio": 0}, {"filename": "/data/images/crabshow/kr_05.png", "start": 121269, "end": 126274, "audio": 0}, {"filename": "/data/images/crabshow/kr_06.png", "start": 126274, "end": 131618, "audio": 0}, {"filename": "/data/images/crabshow/kr_07.png", "start": 131618, "end": 137044, "audio": 0}, {"filename": "/data/images/crabshow/kr_08.png", "start": 137044, "end": 142373, "audio": 0}, {"filename": "/data/images/crabshow/kr_09.png", "start": 142373, "end": 147648, "audio": 0}, {"filename": "/data/images/crabshow/kr_10.png", "start": 147648, "end": 153073, "audio": 0}, {"filename": "/data/images/crabshow/kr_11.png", "start": 153073, "end": 158338, "audio": 0}, {"filename": "/data/images/crabshow/kr_12.png", "start": 158338, "end": 163539, "audio": 0}, {"filename": "/data/images/crabshow/kr_13.png", "start": 163539, "end": 168824, "audio": 0}, {"filename": "/data/images/crabshow/kr_14.png", "start": 168824, "end": 174005, "audio": 0}, {"filename": "/data/images/crabshow/kr_15.png", "start": 174005, "end": 179140, "audio": 0}, {"filename": "/data/images/crabshow/kr_16.png", "start": 179140, "end": 184417, "audio": 0}, {"filename": "/data/images/crabshow/kr_17.png", "start": 184417, "end": 189541, "audio": 0}, {"filename": "/data/images/crabshow/krab_00.png", "start": 189541, "end": 190624, "audio": 0}, {"filename": "/data/images/crabshow/krab_01.png", "start": 190624, "end": 191702, "audio": 0}, {"filename": "/data/images/crabshow/krab_02.png", "start": 191702, "end": 192766, "audio": 0}, {"filename": "/data/images/crabshow/krab_03.png", "start": 192766, "end": 193838, "audio": 0}, {"filename": "/data/images/crabshow/krab_04.png", "start": 193838, "end": 194916, "audio": 0}, {"filename": "/data/images/crabshow/krab_05.png", "start": 194916, "end": 195997, "audio": 0}, {"filename": "/data/images/crabshow/secret-p.png", "start": 195997, "end": 476744, "audio": 0}, {"filename": "/data/images/crabshow/secret-w.png", "start": 476744, "end": 632069, "audio": 0}, {"filename": "/data/images/crabshow/shrimp_00.png", "start": 632069, "end": 634474, "audio": 0}, {"filename": "/data/images/crabshow/shrimp_01.png", "start": 634474, "end": 636897, "audio": 0}, {"filename": "/data/images/crabshow/shrimp_02.png", "start": 636897, "end": 639308, "audio": 0}, {"filename": "/data/images/crabshow/shrimp_03.png", "start": 639308, "end": 641718, "audio": 0}, {"filename": "/data/images/crabshow/shrimp_04.png", "start": 641718, "end": 644118, "audio": 0}, {"filename": "/data/images/crabshow/zed-big.png", "start": 644118, "end": 645430, "audio": 0}, {"filename": "/data/images/crabshow/zed-small.png", "start": 645430, "end": 646154, "audio": 0}, {"filename": "/data/script/crabshow/code.lua", "start": 646154, "end": 664027, "audio": 0}, {"filename": "/data/script/crabshow/dialogs_bg.lua", "start": 664027, "end": 667643, "audio": 0}, {"filename": "/data/script/crabshow/dialogs_cs.lua", "start": 667643, "end": 670704, "audio": 0}, {"filename": "/data/script/crabshow/dialogs_de_CH.lua", "start": 670704, "end": 670812, "audio": 0}, {"filename": "/data/script/crabshow/dialogs_de.lua", "start": 670812, "end": 673952, "audio": 0}, {"filename": "/data/script/crabshow/dialogs_en.lua", "start": 673952, "end": 675804, "audio": 0}, {"filename": "/data/script/crabshow/dialogs_es.lua", "start": 675804, "end": 679029, "audio": 0}, {"filename": "/data/script/crabshow/dialogs_fr.lua", "start": 679029, "end": 682221, "audio": 0}, {"filename": "/data/script/crabshow/dialogs_it.lua", "start": 682221, "end": 685314, "audio": 0}, {"filename": "/data/script/crabshow/dialogs.lua", "start": 685314, "end": 685352, "audio": 0}, {"filename": "/data/script/crabshow/dialogs_nl.lua", "start": 685352, "end": 688504, "audio": 0}, {"filename": "/data/script/crabshow/dialogs_pl.lua", "start": 688504, "end": 691633, "audio": 0}, {"filename": "/data/script/crabshow/dialogs_ru.lua", "start": 691633, "end": 695403, "audio": 0}, {"filename": "/data/script/crabshow/dialogs_sv.lua", "start": 695403, "end": 698481, "audio": 0}, {"filename": "/data/script/crabshow/init.lua", "start": 698481, "end": 699128, "audio": 0}, {"filename": "/data/script/crabshow/models.lua", "start": 699128, "end": 703165, "audio": 0}, {"filename": "/data/sound/crabshow/cs/sec-m-balonky.ogg", "start": 703165, "end": 722084, "audio": 1}, {"filename": "/data/sound/crabshow/cs/sec-m-dole0.ogg", "start": 722084, "end": 735921, "audio": 1}, {"filename": "/data/sound/crabshow/cs/sec-m-dole1.ogg", "start": 735921, "end": 752651, "audio": 1}, {"filename": "/data/sound/crabshow/cs/sec-m-kamen.ogg", "start": 752651, "end": 779887, "audio": 1}, {"filename": "/data/sound/crabshow/cs/sec-m-krab.ogg", "start": 779887, "end": 802983, "audio": 1}, {"filename": "/data/sound/crabshow/cs/sec-m-pocity.ogg", "start": 802983, "end": 830799, "audio": 1}, {"filename": "/data/sound/crabshow/cs/sec-m-program.ogg", "start": 830799, "end": 877392, "audio": 1}, {"filename": "/data/sound/crabshow/cs/sec-m-situace.ogg", "start": 877392, "end": 899380, "audio": 1}, {"filename": "/data/sound/crabshow/cs/sec-m-ven0.ogg", "start": 899380, "end": 919135, "audio": 1}, {"filename": "/data/sound/crabshow/cs/sec-m-ven1.ogg", "start": 919135, "end": 937312, "audio": 1}, {"filename": "/data/sound/crabshow/cs/sec-v-ktery.ogg", "start": 937312, "end": 952222, "audio": 1}, {"filename": "/data/sound/crabshow/cs/sec-v-mesto.ogg", "start": 952222, "end": 973884, "audio": 1}, {"filename": "/data/sound/crabshow/cs/sec-v-normalni0.ogg", "start": 973884, "end": 989189, "audio": 1}, {"filename": "/data/sound/crabshow/cs/sec-v-normalni1.ogg", "start": 989189, "end": 1004686, "audio": 1}, {"filename": "/data/sound/crabshow/cs/sec-v-oci.ogg", "start": 1004686, "end": 1043918, "audio": 1}, {"filename": "/data/sound/crabshow/cs/sec-v-pocit.ogg", "start": 1043918, "end": 1063652, "audio": 1}, {"filename": "/data/sound/crabshow/cs/sec-v-pockej.ogg", "start": 1063652, "end": 1099575, "audio": 1}, {"filename": "/data/sound/crabshow/cs/sec-v-socha.ogg", "start": 1099575, "end": 1123697, "audio": 1}, {"filename": "/data/sound/crabshow/cs/sec-v-ven0.ogg", "start": 1123697, "end": 1142100, "audio": 1}, {"filename": "/data/sound/crabshow/cs/sec-v-ven1.ogg", "start": 1142100, "end": 1157884, "audio": 1}, {"filename": "/data/sound/crabshow/cs/sec-v-ven2.ogg", "start": 1157884, "end": 1178438, "audio": 1}, {"filename": "/data/sound/crabshow/cs/sec-v-zavreny.ogg", "start": 1178438, "end": 1202197, "audio": 1}, {"filename": "/data/sound/crabshow/nl/sec-m-balonky.ogg", "start": 1202197, "end": 1220090, "audio": 1}, {"filename": "/data/sound/crabshow/nl/sec-m-dole0.ogg", "start": 1220090, "end": 1236218, "audio": 1}, {"filename": "/data/sound/crabshow/nl/sec-m-dole1.ogg", "start": 1236218, "end": 1253161, "audio": 1}, {"filename": "/data/sound/crabshow/nl/sec-m-kamen.ogg", "start": 1253161, "end": 1275956, "audio": 1}, {"filename": "/data/sound/crabshow/nl/sec-m-krab.ogg", "start": 1275956, "end": 1295179, "audio": 1}, {"filename": "/data/sound/crabshow/nl/sec-m-pocity.ogg", "start": 1295179, "end": 1322830, "audio": 1}, {"filename": "/data/sound/crabshow/nl/sec-m-program.ogg", "start": 1322830, "end": 1358736, "audio": 1}, {"filename": "/data/sound/crabshow/nl/sec-m-situace.ogg", "start": 1358736, "end": 1383919, "audio": 1}, {"filename": "/data/sound/crabshow/nl/sec-m-ven0.ogg", "start": 1383919, "end": 1401388, "audio": 1}, {"filename": "/data/sound/crabshow/nl/sec-m-ven1.ogg", "start": 1401388, "end": 1419311, "audio": 1}, {"filename": "/data/sound/crabshow/nl/sec-v-ktery.ogg", "start": 1419311, "end": 1435843, "audio": 1}, {"filename": "/data/sound/crabshow/nl/sec-v-mesto.ogg", "start": 1435843, "end": 1460310, "audio": 1}, {"filename": "/data/sound/crabshow/nl/sec-v-normalni0.ogg", "start": 1460310, "end": 1478473, "audio": 1}, {"filename": "/data/sound/crabshow/nl/sec-v-normalni1.ogg", "start": 1478473, "end": 1497995, "audio": 1}, {"filename": "/data/sound/crabshow/nl/sec-v-oci.ogg", "start": 1497995, "end": 1546386, "audio": 1}, {"filename": "/data/sound/crabshow/nl/sec-v-pocit.ogg", "start": 1546386, "end": 1570360, "audio": 1}, {"filename": "/data/sound/crabshow/nl/sec-v-pockej.ogg", "start": 1570360, "end": 1604979, "audio": 1}, {"filename": "/data/sound/crabshow/nl/sec-v-socha.ogg", "start": 1604979, "end": 1632653, "audio": 1}, {"filename": "/data/sound/crabshow/nl/sec-v-ven0.ogg", "start": 1632653, "end": 1651415, "audio": 1}, {"filename": "/data/sound/crabshow/nl/sec-v-ven1.ogg", "start": 1651415, "end": 1667576, "audio": 1}, {"filename": "/data/sound/crabshow/nl/sec-v-ven2.ogg", "start": 1667576, "end": 1684221, "audio": 1}, {"filename": "/data/sound/crabshow/nl/sec-v-zavreny.ogg", "start": 1684221, "end": 1705924, "audio": 1}], "remote_package_size": 1705924, "package_uuid": "5aed152d-079b-4b80-9a8a-e2932b1b5d73"});

})();
