
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
    var PACKAGE_NAME = 'web/data/library.data';
    var REMOTE_PACKAGE_BASE = 'data/library.data';
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
Module['FS_createPath']('/data/images', 'library', true, true);
Module['FS_createPath']('/data', 'script', true, true);
Module['FS_createPath']('/data/script', 'library', true, true);
Module['FS_createPath']('/data', 'sound', true, true);
Module['FS_createPath']('/data/sound', 'library', true, true);
Module['FS_createPath']('/data/sound/library', 'cs', true, true);
Module['FS_createPath']('/data/sound/library', 'nl', true, true);

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
              Module['removeRunDependency']('datafile_web/data/library.data');

    };
    Module['addRunDependency']('datafile_web/data/library.data');
  
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
 loadPackage({"files": [{"filename": "/data/images/library/4-ocel.png", "start": 0, "end": 1770, "audio": 0}, {"filename": "/data/images/library/kniha-a.png", "start": 1770, "end": 3300, "audio": 0}, {"filename": "/data/images/library/kniha-b.png", "start": 3300, "end": 4708, "audio": 0}, {"filename": "/data/images/library/kniha-c.png", "start": 4708, "end": 6144, "audio": 0}, {"filename": "/data/images/library/kniha-lezi-a.png", "start": 6144, "end": 7405, "audio": 0}, {"filename": "/data/images/library/kniha-lezi-b.png", "start": 7405, "end": 8679, "audio": 0}, {"filename": "/data/images/library/kniha-mala-a.png", "start": 8679, "end": 9641, "audio": 0}, {"filename": "/data/images/library/kniha-mala.png", "start": 9641, "end": 10615, "audio": 0}, {"filename": "/data/images/library/kniha-tlusta.png", "start": 10615, "end": 13409, "audio": 0}, {"filename": "/data/images/library/mapa_v.png", "start": 13409, "end": 14961, "audio": 0}, {"filename": "/data/images/library/ostnatec_00.png", "start": 14961, "end": 17460, "audio": 0}, {"filename": "/data/images/library/ostnatec_01.png", "start": 17460, "end": 19962, "audio": 0}, {"filename": "/data/images/library/ostnatec_02.png", "start": 19962, "end": 22465, "audio": 0}, {"filename": "/data/images/library/vrak-okoli.png", "start": 22465, "end": 257866, "audio": 0}, {"filename": "/data/images/library/vrak-pozadi.png", "start": 257866, "end": 474673, "audio": 0}, {"filename": "/data/script/library/code.lua", "start": 474673, "end": 480974, "audio": 0}, {"filename": "/data/script/library/dialogs_bg.lua", "start": 480974, "end": 486747, "audio": 0}, {"filename": "/data/script/library/dialogs_cs.lua", "start": 486747, "end": 491532, "audio": 0}, {"filename": "/data/script/library/dialogs_de_CH.lua", "start": 491532, "end": 491878, "audio": 0}, {"filename": "/data/script/library/dialogs_de.lua", "start": 491878, "end": 496944, "audio": 0}, {"filename": "/data/script/library/dialogs_en.lua", "start": 496944, "end": 499865, "audio": 0}, {"filename": "/data/script/library/dialogs_es.lua", "start": 499865, "end": 504759, "audio": 0}, {"filename": "/data/script/library/dialogs_fr.lua", "start": 504759, "end": 509744, "audio": 0}, {"filename": "/data/script/library/dialogs_it.lua", "start": 509744, "end": 514677, "audio": 0}, {"filename": "/data/script/library/dialogs.lua", "start": 514677, "end": 514715, "audio": 0}, {"filename": "/data/script/library/dialogs_nl.lua", "start": 514715, "end": 519706, "audio": 0}, {"filename": "/data/script/library/dialogs_pl.lua", "start": 519706, "end": 524545, "audio": 0}, {"filename": "/data/script/library/dialogs_ru.lua", "start": 524545, "end": 530473, "audio": 0}, {"filename": "/data/script/library/dialogs_sv.lua", "start": 530473, "end": 535288, "audio": 0}, {"filename": "/data/script/library/init.lua", "start": 535288, "end": 535934, "audio": 0}, {"filename": "/data/script/library/models.lua", "start": 535934, "end": 539322, "audio": 0}, {"filename": "/data/sound/library/cs/vrak-m-cteni0.ogg", "start": 539322, "end": 570508, "audio": 1}, {"filename": "/data/sound/library/cs/vrak-m-cteni1.ogg", "start": 570508, "end": 598903, "audio": 1}, {"filename": "/data/sound/library/cs/vrak-m-cteni2.ogg", "start": 598903, "end": 628768, "audio": 1}, {"filename": "/data/sound/library/cs/vrak-m-knihy0.ogg", "start": 628768, "end": 643279, "audio": 1}, {"filename": "/data/sound/library/cs/vrak-m-knihy1.ogg", "start": 643279, "end": 656758, "audio": 1}, {"filename": "/data/sound/library/cs/vrak-m-knihy2.ogg", "start": 656758, "end": 672792, "audio": 1}, {"filename": "/data/sound/library/cs/vrak-m-knihy3.ogg", "start": 672792, "end": 687513, "audio": 1}, {"filename": "/data/sound/library/cs/vrak-m-knihy4.ogg", "start": 687513, "end": 705279, "audio": 1}, {"filename": "/data/sound/library/cs/vrak-m-knihy5.ogg", "start": 705279, "end": 723213, "audio": 1}, {"filename": "/data/sound/library/cs/vrak-m-knihy6.ogg", "start": 723213, "end": 739112, "audio": 1}, {"filename": "/data/sound/library/cs/vrak-m-kupovat0.ogg", "start": 739112, "end": 759757, "audio": 1}, {"filename": "/data/sound/library/cs/vrak-m-kupovat1.ogg", "start": 759757, "end": 786878, "audio": 1}, {"filename": "/data/sound/library/cs/vrak-m-naco.ogg", "start": 786878, "end": 800103, "audio": 1}, {"filename": "/data/sound/library/cs/vrak-m-ocel.ogg", "start": 800103, "end": 822347, "audio": 1}, {"filename": "/data/sound/library/cs/vrak-m-ostnatec.ogg", "start": 822347, "end": 839274, "audio": 1}, {"filename": "/data/sound/library/cs/vrak-m-pohadky.ogg", "start": 839274, "end": 860614, "audio": 1}, {"filename": "/data/sound/library/cs/vrak-m-predmety.ogg", "start": 860614, "end": 885876, "audio": 1}, {"filename": "/data/sound/library/cs/vrak-m-restart.ogg", "start": 885876, "end": 904641, "audio": 1}, {"filename": "/data/sound/library/cs/vrak-m-vrak0.ogg", "start": 904641, "end": 927162, "audio": 1}, {"filename": "/data/sound/library/cs/vrak-m-vrak1.ogg", "start": 927162, "end": 944883, "audio": 1}, {"filename": "/data/sound/library/cs/vrak-m-vrak2.ogg", "start": 944883, "end": 963415, "audio": 1}, {"filename": "/data/sound/library/cs/vrak-m-zivocich.ogg", "start": 963415, "end": 978242, "audio": 1}, {"filename": "/data/sound/library/cs/vrak-v-knihy0.ogg", "start": 978242, "end": 997005, "audio": 1}, {"filename": "/data/sound/library/cs/vrak-v-knihy1.ogg", "start": 997005, "end": 1010917, "audio": 1}, {"filename": "/data/sound/library/cs/vrak-v-knihy2.ogg", "start": 1010917, "end": 1024580, "audio": 1}, {"filename": "/data/sound/library/cs/vrak-v-knihy3.ogg", "start": 1024580, "end": 1041553, "audio": 1}, {"filename": "/data/sound/library/cs/vrak-v-knihy4.ogg", "start": 1041553, "end": 1058677, "audio": 1}, {"filename": "/data/sound/library/cs/vrak-v-nevejdu0.ogg", "start": 1058677, "end": 1072178, "audio": 1}, {"filename": "/data/sound/library/cs/vrak-v-nevejdu1.ogg", "start": 1072178, "end": 1085165, "audio": 1}, {"filename": "/data/sound/library/cs/vrak-v-policky.ogg", "start": 1085165, "end": 1110056, "audio": 1}, {"filename": "/data/sound/library/cs/vrak-v-potvurka.ogg", "start": 1110056, "end": 1125738, "audio": 1}, {"filename": "/data/sound/library/cs/vrak-v-snek.ogg", "start": 1125738, "end": 1144414, "audio": 1}, {"filename": "/data/sound/library/cs/vrak-v-vraky0.ogg", "start": 1144414, "end": 1169719, "audio": 1}, {"filename": "/data/sound/library/cs/vrak-v-vraky1.ogg", "start": 1169719, "end": 1188324, "audio": 1}, {"filename": "/data/sound/library/cs/vrak-v-vraky2.ogg", "start": 1188324, "end": 1225401, "audio": 1}, {"filename": "/data/sound/library/cs/vrak-v-vyhodit.ogg", "start": 1225401, "end": 1241917, "audio": 1}, {"filename": "/data/sound/library/nl/vrak-m-cteni0.ogg", "start": 1241917, "end": 1272280, "audio": 1}, {"filename": "/data/sound/library/nl/vrak-m-cteni1.ogg", "start": 1272280, "end": 1318178, "audio": 1}, {"filename": "/data/sound/library/nl/vrak-m-cteni2.ogg", "start": 1318178, "end": 1352988, "audio": 1}, {"filename": "/data/sound/library/nl/vrak-m-knihy0.ogg", "start": 1352988, "end": 1370616, "audio": 1}, {"filename": "/data/sound/library/nl/vrak-m-knihy1.ogg", "start": 1370616, "end": 1388426, "audio": 1}, {"filename": "/data/sound/library/nl/vrak-m-knihy2.ogg", "start": 1388426, "end": 1407163, "audio": 1}, {"filename": "/data/sound/library/nl/vrak-m-knihy3.ogg", "start": 1407163, "end": 1427042, "audio": 1}, {"filename": "/data/sound/library/nl/vrak-m-knihy4.ogg", "start": 1427042, "end": 1448832, "audio": 1}, {"filename": "/data/sound/library/nl/vrak-m-knihy5.ogg", "start": 1448832, "end": 1468965, "audio": 1}, {"filename": "/data/sound/library/nl/vrak-m-knihy6.ogg", "start": 1468965, "end": 1489693, "audio": 1}, {"filename": "/data/sound/library/nl/vrak-m-kupovat0.ogg", "start": 1489693, "end": 1514794, "audio": 1}, {"filename": "/data/sound/library/nl/vrak-m-kupovat1.ogg", "start": 1514794, "end": 1545491, "audio": 1}, {"filename": "/data/sound/library/nl/vrak-m-naco.ogg", "start": 1545491, "end": 1563557, "audio": 1}, {"filename": "/data/sound/library/nl/vrak-m-ocel.ogg", "start": 1563557, "end": 1586948, "audio": 1}, {"filename": "/data/sound/library/nl/vrak-m-ostnatec.ogg", "start": 1586948, "end": 1607967, "audio": 1}, {"filename": "/data/sound/library/nl/vrak-m-pohadky.ogg", "start": 1607967, "end": 1632622, "audio": 1}, {"filename": "/data/sound/library/nl/vrak-m-predmety.ogg", "start": 1632622, "end": 1663431, "audio": 1}, {"filename": "/data/sound/library/nl/vrak-m-restart.ogg", "start": 1663431, "end": 1682150, "audio": 1}, {"filename": "/data/sound/library/nl/vrak-m-vrak0.ogg", "start": 1682150, "end": 1707641, "audio": 1}, {"filename": "/data/sound/library/nl/vrak-m-vrak1.ogg", "start": 1707641, "end": 1733408, "audio": 1}, {"filename": "/data/sound/library/nl/vrak-m-vrak2.ogg", "start": 1733408, "end": 1758324, "audio": 1}, {"filename": "/data/sound/library/nl/vrak-m-zivocich.ogg", "start": 1758324, "end": 1781687, "audio": 1}, {"filename": "/data/sound/library/nl/vrak-v-knihy0.ogg", "start": 1781687, "end": 1801108, "audio": 1}, {"filename": "/data/sound/library/nl/vrak-v-knihy1.ogg", "start": 1801108, "end": 1819129, "audio": 1}, {"filename": "/data/sound/library/nl/vrak-v-knihy2.ogg", "start": 1819129, "end": 1835764, "audio": 1}, {"filename": "/data/sound/library/nl/vrak-v-knihy3.ogg", "start": 1835764, "end": 1852481, "audio": 1}, {"filename": "/data/sound/library/nl/vrak-v-knihy4.ogg", "start": 1852481, "end": 1875151, "audio": 1}, {"filename": "/data/sound/library/nl/vrak-v-nevejdu0.ogg", "start": 1875151, "end": 1892627, "audio": 1}, {"filename": "/data/sound/library/nl/vrak-v-nevejdu1.ogg", "start": 1892627, "end": 1909108, "audio": 1}, {"filename": "/data/sound/library/nl/vrak-v-policky.ogg", "start": 1909108, "end": 1942835, "audio": 1}, {"filename": "/data/sound/library/nl/vrak-v-potvurka.ogg", "start": 1942835, "end": 1967116, "audio": 1}, {"filename": "/data/sound/library/nl/vrak-v-snek.ogg", "start": 1967116, "end": 1985984, "audio": 1}, {"filename": "/data/sound/library/nl/vrak-v-vraky0.ogg", "start": 1985984, "end": 2008798, "audio": 1}, {"filename": "/data/sound/library/nl/vrak-v-vraky1.ogg", "start": 2008798, "end": 2034864, "audio": 1}, {"filename": "/data/sound/library/nl/vrak-v-vraky2.ogg", "start": 2034864, "end": 2065400, "audio": 1}, {"filename": "/data/sound/library/nl/vrak-v-vyhodit.ogg", "start": 2065400, "end": 2085986, "audio": 1}], "remote_package_size": 2085986, "package_uuid": "9d2a52e8-ec9e-40fa-904c-1dd8dc9ea9cd"});

})();
