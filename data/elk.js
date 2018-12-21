
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
    var PACKAGE_NAME = 'web/data/elk.data';
    var REMOTE_PACKAGE_BASE = 'data/elk.data';
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
Module['FS_createPath']('/data/images', 'elk', true, true);
Module['FS_createPath']('/data', 'script', true, true);
Module['FS_createPath']('/data/script', 'elk', true, true);
Module['FS_createPath']('/data', 'sound', true, true);
Module['FS_createPath']('/data/sound', 'elk', true, true);
Module['FS_createPath']('/data/sound/elk', 'cs', true, true);
Module['FS_createPath']('/data/sound/elk', 'en', true, true);
Module['FS_createPath']('/data/sound/elk', 'nl', true, true);

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
              Module['removeRunDependency']('datafile_web/data/elk.data');

    };
    Module['addRunDependency']('datafile_web/data/elk.data');
  
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
 loadPackage({"files": [{"filename": "/data/images/elk/4-ocel.png", "start": 0, "end": 1447, "audio": 0}, {"filename": "/data/images/elk/9-ocel.png", "start": 1447, "end": 5148, "audio": 0}, {"filename": "/data/images/elk/deutsche-okoli.png", "start": 5148, "end": 304734, "audio": 0}, {"filename": "/data/images/elk/deutsche-pozadi.png", "start": 304734, "end": 547991, "audio": 0}, {"filename": "/data/images/elk/los_00.png", "start": 547991, "end": 562994, "audio": 0}, {"filename": "/data/images/elk/los_01.png", "start": 562994, "end": 578112, "audio": 0}, {"filename": "/data/images/elk/los_02.png", "start": 578112, "end": 593213, "audio": 0}, {"filename": "/data/images/elk/los_03.png", "start": 593213, "end": 608350, "audio": 0}, {"filename": "/data/images/elk/los_04.png", "start": 608350, "end": 624265, "audio": 0}, {"filename": "/data/images/elk/los_05.png", "start": 624265, "end": 640348, "audio": 0}, {"filename": "/data/images/elk/los_06.png", "start": 640348, "end": 656512, "audio": 0}, {"filename": "/data/images/elk/los_07.png", "start": 656512, "end": 672745, "audio": 0}, {"filename": "/data/images/elk/maly_snek_00.png", "start": 672745, "end": 673419, "audio": 0}, {"filename": "/data/images/elk/maly_snek_01.png", "start": 673419, "end": 674116, "audio": 0}, {"filename": "/data/images/elk/maly_snek_02.png", "start": 674116, "end": 674833, "audio": 0}, {"filename": "/data/images/elk/maly_snek_03.png", "start": 674833, "end": 675493, "audio": 0}, {"filename": "/data/images/elk/naboj.png", "start": 675493, "end": 676486, "audio": 0}, {"filename": "/data/images/elk/papoucha_00.png", "start": 676486, "end": 678439, "audio": 0}, {"filename": "/data/images/elk/papoucha_01.png", "start": 678439, "end": 680413, "audio": 0}, {"filename": "/data/script/elk/code.lua", "start": 680413, "end": 691262, "audio": 0}, {"filename": "/data/script/elk/dialogs_bg.lua", "start": 691262, "end": 694596, "audio": 0}, {"filename": "/data/script/elk/dialogs_cs.lua", "start": 694596, "end": 696534, "audio": 0}, {"filename": "/data/script/elk/dialogs_de_CH.lua", "start": 696534, "end": 696702, "audio": 0}, {"filename": "/data/script/elk/dialogs_de.lua", "start": 696702, "end": 698697, "audio": 0}, {"filename": "/data/script/elk/dialogs_en.lua", "start": 698697, "end": 700577, "audio": 0}, {"filename": "/data/script/elk/dialogs_es.lua", "start": 700577, "end": 701635, "audio": 0}, {"filename": "/data/script/elk/dialogs_fr.lua", "start": 701635, "end": 702709, "audio": 0}, {"filename": "/data/script/elk/dialogs_it.lua", "start": 702709, "end": 704652, "audio": 0}, {"filename": "/data/script/elk/dialogs.lua", "start": 704652, "end": 704690, "audio": 0}, {"filename": "/data/script/elk/dialogs_nl.lua", "start": 704690, "end": 706701, "audio": 0}, {"filename": "/data/script/elk/dialogs_pl.lua", "start": 706701, "end": 708635, "audio": 0}, {"filename": "/data/script/elk/dialogs_ru.lua", "start": 708635, "end": 712012, "audio": 0}, {"filename": "/data/script/elk/dialogs_sv.lua", "start": 712012, "end": 713994, "audio": 0}, {"filename": "/data/script/elk/init.lua", "start": 713994, "end": 714636, "audio": 0}, {"filename": "/data/script/elk/models.lua", "start": 714636, "end": 717527, "audio": 0}, {"filename": "/data/sound/elk/cs/deu-m-bojovat.ogg", "start": 717527, "end": 742151, "audio": 1}, {"filename": "/data/sound/elk/cs/deu-m-valka.ogg", "start": 742151, "end": 758996, "audio": 1}, {"filename": "/data/sound/elk/cs/deu-m-zvlastni.ogg", "start": 758996, "end": 787450, "audio": 1}, {"filename": "/data/sound/elk/cs/deu-v-losa.ogg", "start": 787450, "end": 796213, "audio": 1}, {"filename": "/data/sound/elk/cs/deu-v-nepratelstvi.ogg", "start": 796213, "end": 813128, "audio": 1}, {"filename": "/data/sound/elk/cs/deu-v-radsi.ogg", "start": 813128, "end": 837241, "audio": 1}, {"filename": "/data/sound/elk/cs/deu-v-slysel.ogg", "start": 837241, "end": 854884, "audio": 1}, {"filename": "/data/sound/elk/en/deu-l-ja.ogg", "start": 854884, "end": 871647, "audio": 1}, {"filename": "/data/sound/elk/en/deu-l-los0.ogg", "start": 871647, "end": 885833, "audio": 1}, {"filename": "/data/sound/elk/en/deu-l-los1.ogg", "start": 885833, "end": 901322, "audio": 1}, {"filename": "/data/sound/elk/en/deu-l-los.ogg", "start": 901322, "end": 915519, "audio": 1}, {"filename": "/data/sound/elk/en/deu-l-necital.ogg", "start": 915519, "end": 945911, "audio": 1}, {"filename": "/data/sound/elk/en/deu-l-nesmotrel.ogg", "start": 945911, "end": 969062, "audio": 1}, {"filename": "/data/sound/elk/en/deu-l-neznaju.ogg", "start": 969062, "end": 992099, "audio": 1}, {"filename": "/data/sound/elk/en/deu-l-pozalsta.ogg", "start": 992099, "end": 1015095, "audio": 1}, {"filename": "/data/sound/elk/en/deu-l-tovarisci.ogg", "start": 1015095, "end": 1091455, "audio": 1}, {"filename": "/data/sound/elk/en/deu-l-zivjot.ogg", "start": 1091455, "end": 1130264, "audio": 1}, {"filename": "/data/sound/elk/en/deu-p-jawohl.ogg", "start": 1130264, "end": 1142272, "audio": 1}, {"filename": "/data/sound/elk/en/deu-p-los.ogg", "start": 1142272, "end": 1155375, "audio": 1}, {"filename": "/data/sound/elk/en/deu-p-ordnung.ogg", "start": 1155375, "end": 1174268, "audio": 1}, {"filename": "/data/sound/elk/en/deu-p-schnell.ogg", "start": 1174268, "end": 1188414, "audio": 1}, {"filename": "/data/sound/elk/en/deu-p-skoll.ogg", "start": 1188414, "end": 1199743, "audio": 1}, {"filename": "/data/sound/elk/en/deu-p-stimmt.ogg", "start": 1199743, "end": 1213353, "audio": 1}, {"filename": "/data/sound/elk/en/deu-p-streng.ogg", "start": 1213353, "end": 1226252, "audio": 1}, {"filename": "/data/sound/elk/en/deu-p-trinken0.ogg", "start": 1226252, "end": 1251499, "audio": 1}, {"filename": "/data/sound/elk/en/deu-p-trinken1.ogg", "start": 1251499, "end": 1275447, "audio": 1}, {"filename": "/data/sound/elk/nl/deu-m-bojovat.ogg", "start": 1275447, "end": 1303036, "audio": 1}, {"filename": "/data/sound/elk/nl/deu-m-valka.ogg", "start": 1303036, "end": 1325470, "audio": 1}, {"filename": "/data/sound/elk/nl/deu-m-zvlastni.ogg", "start": 1325470, "end": 1352126, "audio": 1}, {"filename": "/data/sound/elk/nl/deu-v-losa.ogg", "start": 1352126, "end": 1366609, "audio": 1}, {"filename": "/data/sound/elk/nl/deu-v-nepratelstvi.ogg", "start": 1366609, "end": 1385077, "audio": 1}, {"filename": "/data/sound/elk/nl/deu-v-radsi.ogg", "start": 1385077, "end": 1414403, "audio": 1}, {"filename": "/data/sound/elk/nl/deu-v-slysel.ogg", "start": 1414403, "end": 1441583, "audio": 1}], "remote_package_size": 1441583, "package_uuid": "35d7b271-d24c-4540-8210-43c97c0b2af0"});

})();
