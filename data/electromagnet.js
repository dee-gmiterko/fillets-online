
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
    var PACKAGE_NAME = 'web/data/electromagnet.data';
    var REMOTE_PACKAGE_BASE = 'data/electromagnet.data';
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
Module['FS_createPath']('/data/images', 'electromagnet', true, true);
Module['FS_createPath']('/data', 'script', true, true);
Module['FS_createPath']('/data/script', 'electromagnet', true, true);
Module['FS_createPath']('/data', 'sound', true, true);
Module['FS_createPath']('/data/sound', 'electromagnet', true, true);
Module['FS_createPath']('/data/sound/electromagnet', 'en', true, true);
Module['FS_createPath']('/data/sound/electromagnet', 'nl', true, true);

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
              Module['removeRunDependency']('datafile_web/data/electromagnet.data');

    };
    Module['addRunDependency']('datafile_web/data/electromagnet.data');
  
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
 loadPackage({"files": [{"filename": "/data/images/electromagnet/alienmagnet_00.png", "start": 0, "end": 687, "audio": 0}, {"filename": "/data/images/electromagnet/alienmagnet_01.png", "start": 687, "end": 1421, "audio": 0}, {"filename": "/data/images/electromagnet/alienmagnet_02.png", "start": 1421, "end": 2180, "audio": 0}, {"filename": "/data/images/electromagnet/alienmagnet_03.png", "start": 2180, "end": 2964, "audio": 0}, {"filename": "/data/images/electromagnet/alienmagnet_04.png", "start": 2964, "end": 3765, "audio": 0}, {"filename": "/data/images/electromagnet/alienmagnet_05.png", "start": 3765, "end": 4638, "audio": 0}, {"filename": "/data/images/electromagnet/alienmagnet_06.png", "start": 4638, "end": 5526, "audio": 0}, {"filename": "/data/images/electromagnet/alienmagnet_07.png", "start": 5526, "end": 6433, "audio": 0}, {"filename": "/data/images/electromagnet/alienmagnet_08.png", "start": 6433, "end": 7314, "audio": 0}, {"filename": "/data/images/electromagnet/alienmagnet_09.png", "start": 7314, "end": 8219, "audio": 0}, {"filename": "/data/images/electromagnet/alienmagnet_10.png", "start": 8219, "end": 8979, "audio": 0}, {"filename": "/data/images/electromagnet/alienmagnet_11.png", "start": 8979, "end": 9738, "audio": 0}, {"filename": "/data/images/electromagnet/alienmagnet_12.png", "start": 9738, "end": 10501, "audio": 0}, {"filename": "/data/images/electromagnet/alienmagnet_13.png", "start": 10501, "end": 11229, "audio": 0}, {"filename": "/data/images/electromagnet/alienmagnet_14.png", "start": 11229, "end": 11969, "audio": 0}, {"filename": "/data/images/electromagnet/background.png", "start": 11969, "end": 109287, "audio": 0}, {"filename": "/data/images/electromagnet/can.png", "start": 109287, "end": 110404, "audio": 0}, {"filename": "/data/images/electromagnet/cristall.png", "start": 110404, "end": 112327, "audio": 0}, {"filename": "/data/images/electromagnet/damage-wall_00.png", "start": 112327, "end": 113376, "audio": 0}, {"filename": "/data/images/electromagnet/damage-wall_01.png", "start": 113376, "end": 114515, "audio": 0}, {"filename": "/data/images/electromagnet/damage-wall_02.png", "start": 114515, "end": 115678, "audio": 0}, {"filename": "/data/images/electromagnet/damage-wall_03.png", "start": 115678, "end": 116862, "audio": 0}, {"filename": "/data/images/electromagnet/damage-wall_04.png", "start": 116862, "end": 118177, "audio": 0}, {"filename": "/data/images/electromagnet/damage-wall_05.png", "start": 118177, "end": 119532, "audio": 0}, {"filename": "/data/images/electromagnet/damage-wall_06.png", "start": 119532, "end": 120817, "audio": 0}, {"filename": "/data/images/electromagnet/damage-wall_07.png", "start": 120817, "end": 122124, "audio": 0}, {"filename": "/data/images/electromagnet/damage-wall_08.png", "start": 122124, "end": 123436, "audio": 0}, {"filename": "/data/images/electromagnet/foreground.png", "start": 123436, "end": 174351, "audio": 0}, {"filename": "/data/images/electromagnet/item_named_a.png", "start": 174351, "end": 175315, "audio": 0}, {"filename": "/data/images/electromagnet/item_named_b.png", "start": 175315, "end": 175627, "audio": 0}, {"filename": "/data/images/electromagnet/item_named_c.png", "start": 175627, "end": 176779, "audio": 0}, {"filename": "/data/images/electromagnet/item_named_d.png", "start": 176779, "end": 179324, "audio": 0}, {"filename": "/data/images/electromagnet/item_named_e.png", "start": 179324, "end": 179869, "audio": 0}, {"filename": "/data/images/electromagnet/kill-o-zap.png", "start": 179869, "end": 183252, "audio": 0}, {"filename": "/data/images/electromagnet/lever_00.png", "start": 183252, "end": 184053, "audio": 0}, {"filename": "/data/images/electromagnet/lever_01.png", "start": 184053, "end": 184872, "audio": 0}, {"filename": "/data/images/electromagnet/lever_02.png", "start": 184872, "end": 185707, "audio": 0}, {"filename": "/data/images/electromagnet/lever_03.png", "start": 185707, "end": 186526, "audio": 0}, {"filename": "/data/images/electromagnet/lever_04.png", "start": 186526, "end": 187351, "audio": 0}, {"filename": "/data/images/electromagnet/lever_05.png", "start": 187351, "end": 188288, "audio": 0}, {"filename": "/data/images/electromagnet/lever_06.png", "start": 188288, "end": 189154, "audio": 0}, {"filename": "/data/images/electromagnet/lever_07.png", "start": 189154, "end": 190070, "audio": 0}, {"filename": "/data/images/electromagnet/lever_08.png", "start": 190070, "end": 191018, "audio": 0}, {"filename": "/data/images/electromagnet/lever_09.png", "start": 191018, "end": 191970, "audio": 0}, {"filename": "/data/images/electromagnet/lever_10.png", "start": 191970, "end": 192921, "audio": 0}, {"filename": "/data/images/electromagnet/lever_11.png", "start": 192921, "end": 193880, "audio": 0}, {"filename": "/data/images/electromagnet/magnet-small.png", "start": 193880, "end": 194462, "audio": 0}, {"filename": "/data/images/electromagnet/plutonium-5-_00.png", "start": 194462, "end": 195844, "audio": 0}, {"filename": "/data/images/electromagnet/plutonium-5-_01.png", "start": 195844, "end": 197211, "audio": 0}, {"filename": "/data/images/electromagnet/plutonium-5-_02.png", "start": 197211, "end": 198578, "audio": 0}, {"filename": "/data/images/electromagnet/plutonium-5-_03.png", "start": 198578, "end": 199930, "audio": 0}, {"filename": "/data/images/electromagnet/powerline.png", "start": 199930, "end": 201337, "audio": 0}, {"filename": "/data/images/electromagnet/screw-nut.png", "start": 201337, "end": 201974, "audio": 0}, {"filename": "/data/images/electromagnet/steel-1.png", "start": 201974, "end": 202472, "audio": 0}, {"filename": "/data/images/electromagnet/steelbig.png", "start": 202472, "end": 205869, "audio": 0}, {"filename": "/data/images/electromagnet/thingy.png", "start": 205869, "end": 215756, "audio": 0}, {"filename": "/data/script/electromagnet/code.lua", "start": 215756, "end": 228929, "audio": 0}, {"filename": "/data/script/electromagnet/dialogs_bg.lua", "start": 228929, "end": 239282, "audio": 0}, {"filename": "/data/script/electromagnet/dialogs_cs.lua", "start": 239282, "end": 248061, "audio": 0}, {"filename": "/data/script/electromagnet/dialogs_de.lua", "start": 248061, "end": 257375, "audio": 0}, {"filename": "/data/script/electromagnet/dialogs_en.lua", "start": 257375, "end": 262655, "audio": 0}, {"filename": "/data/script/electromagnet/dialogs.lua", "start": 262655, "end": 262693, "audio": 0}, {"filename": "/data/script/electromagnet/dialogs_nl.lua", "start": 262693, "end": 271725, "audio": 0}, {"filename": "/data/script/electromagnet/dialogs_ru.lua", "start": 271725, "end": 282179, "audio": 0}, {"filename": "/data/script/electromagnet/dialogs_sv.lua", "start": 282179, "end": 291164, "audio": 0}, {"filename": "/data/script/electromagnet/init.lua", "start": 291164, "end": 291817, "audio": 0}, {"filename": "/data/script/electromagnet/models.lua", "start": 291817, "end": 296697, "audio": 0}, {"filename": "/data/sound/electromagnet/en/laser.ogg", "start": 296697, "end": 311839, "audio": 1}, {"filename": "/data/sound/electromagnet/nl/b-hurt-0.ogg", "start": 311839, "end": 328860, "audio": 1}, {"filename": "/data/sound/electromagnet/nl/b-hurt-1.ogg", "start": 328860, "end": 342741, "audio": 1}, {"filename": "/data/sound/electromagnet/nl/b-hurt-2.ogg", "start": 342741, "end": 359333, "audio": 1}, {"filename": "/data/sound/electromagnet/nl/init-0.ogg", "start": 359333, "end": 375511, "audio": 1}, {"filename": "/data/sound/electromagnet/nl/init-1.ogg", "start": 375511, "end": 396607, "audio": 1}, {"filename": "/data/sound/electromagnet/nl/init-2.ogg", "start": 396607, "end": 416370, "audio": 1}, {"filename": "/data/sound/electromagnet/nl/init-3-0.ogg", "start": 416370, "end": 439018, "audio": 1}, {"filename": "/data/sound/electromagnet/nl/init-3-1.ogg", "start": 439018, "end": 467293, "audio": 1}, {"filename": "/data/sound/electromagnet/nl/init-3-2.ogg", "start": 467293, "end": 503868, "audio": 1}, {"filename": "/data/sound/electromagnet/nl/init-3-3.ogg", "start": 503868, "end": 528022, "audio": 1}, {"filename": "/data/sound/electromagnet/nl/init-4.ogg", "start": 528022, "end": 549672, "audio": 1}, {"filename": "/data/sound/electromagnet/nl/rand-0-0.ogg", "start": 549672, "end": 572923, "audio": 1}, {"filename": "/data/sound/electromagnet/nl/rand-0-1.ogg", "start": 572923, "end": 602787, "audio": 1}, {"filename": "/data/sound/electromagnet/nl/rand-0-2.ogg", "start": 602787, "end": 624634, "audio": 1}, {"filename": "/data/sound/electromagnet/nl/rand-0-3.ogg", "start": 624634, "end": 648274, "audio": 1}, {"filename": "/data/sound/electromagnet/nl/rand-0-4.ogg", "start": 648274, "end": 676567, "audio": 1}, {"filename": "/data/sound/electromagnet/nl/rand-0-5.ogg", "start": 676567, "end": 692144, "audio": 1}, {"filename": "/data/sound/electromagnet/nl/rand-1-0.ogg", "start": 692144, "end": 722566, "audio": 1}, {"filename": "/data/sound/electromagnet/nl/rand-1-1.ogg", "start": 722566, "end": 760264, "audio": 1}, {"filename": "/data/sound/electromagnet/nl/rand-1-2.ogg", "start": 760264, "end": 790143, "audio": 1}, {"filename": "/data/sound/electromagnet/nl/rand-1-3.ogg", "start": 790143, "end": 829163, "audio": 1}, {"filename": "/data/sound/electromagnet/nl/rand-2-0.ogg", "start": 829163, "end": 850529, "audio": 1}, {"filename": "/data/sound/electromagnet/nl/rand-2-1.ogg", "start": 850529, "end": 864282, "audio": 1}, {"filename": "/data/sound/electromagnet/nl/rand-2-2.ogg", "start": 864282, "end": 885042, "audio": 1}, {"filename": "/data/sound/electromagnet/nl/rand-2-3-0.ogg", "start": 885042, "end": 902553, "audio": 1}, {"filename": "/data/sound/electromagnet/nl/rand-2-3-1.ogg", "start": 902553, "end": 925197, "audio": 1}, {"filename": "/data/sound/electromagnet/nl/rand-2-3-2.ogg", "start": 925197, "end": 962488, "audio": 1}, {"filename": "/data/sound/electromagnet/nl/rand-2-4.ogg", "start": 962488, "end": 989091, "audio": 1}, {"filename": "/data/sound/electromagnet/nl/rand-3-0.ogg", "start": 989091, "end": 1008227, "audio": 1}, {"filename": "/data/sound/electromagnet/nl/rand-3-1.ogg", "start": 1008227, "end": 1033506, "audio": 1}, {"filename": "/data/sound/electromagnet/nl/rand-3-2-0.ogg", "start": 1033506, "end": 1049430, "audio": 1}, {"filename": "/data/sound/electromagnet/nl/rand-3-2-1.ogg", "start": 1049430, "end": 1068326, "audio": 1}, {"filename": "/data/sound/electromagnet/nl/rand-3-2-2.ogg", "start": 1068326, "end": 1084494, "audio": 1}, {"filename": "/data/sound/electromagnet/nl/rand-3-2-3.ogg", "start": 1084494, "end": 1100022, "audio": 1}, {"filename": "/data/sound/electromagnet/nl/rand-3-2-4.ogg", "start": 1100022, "end": 1120338, "audio": 1}, {"filename": "/data/sound/electromagnet/nl/rand-3-2-5.ogg", "start": 1120338, "end": 1139779, "audio": 1}, {"filename": "/data/sound/electromagnet/nl/rand-3-3.ogg", "start": 1139779, "end": 1157109, "audio": 1}, {"filename": "/data/sound/electromagnet/nl/rand-4-0.ogg", "start": 1157109, "end": 1192305, "audio": 1}, {"filename": "/data/sound/electromagnet/nl/rand-4-1.ogg", "start": 1192305, "end": 1218154, "audio": 1}, {"filename": "/data/sound/electromagnet/nl/rand-4-2.ogg", "start": 1218154, "end": 1231774, "audio": 1}, {"filename": "/data/sound/electromagnet/nl/rand-5-0.ogg", "start": 1231774, "end": 1249977, "audio": 1}, {"filename": "/data/sound/electromagnet/nl/rand-5-1.ogg", "start": 1249977, "end": 1282618, "audio": 1}, {"filename": "/data/sound/electromagnet/nl/rand-5-2.ogg", "start": 1282618, "end": 1311919, "audio": 1}, {"filename": "/data/sound/electromagnet/nl/rand-5-3-0.ogg", "start": 1311919, "end": 1333819, "audio": 1}, {"filename": "/data/sound/electromagnet/nl/rand-5-3-1.ogg", "start": 1333819, "end": 1354136, "audio": 1}, {"filename": "/data/sound/electromagnet/nl/rand-6-0.ogg", "start": 1354136, "end": 1376676, "audio": 1}, {"filename": "/data/sound/electromagnet/nl/rand-6-1.ogg", "start": 1376676, "end": 1410837, "audio": 1}, {"filename": "/data/sound/electromagnet/nl/rand-6-2.ogg", "start": 1410837, "end": 1440293, "audio": 1}, {"filename": "/data/sound/electromagnet/nl/rand-6-3.ogg", "start": 1440293, "end": 1474725, "audio": 1}, {"filename": "/data/sound/electromagnet/nl/rand-6-4.ogg", "start": 1474725, "end": 1495400, "audio": 1}, {"filename": "/data/sound/electromagnet/nl/rand-6-5.ogg", "start": 1495400, "end": 1540043, "audio": 1}, {"filename": "/data/sound/electromagnet/nl/shoot-0-0.ogg", "start": 1540043, "end": 1555753, "audio": 1}, {"filename": "/data/sound/electromagnet/nl/shoot-0-1.ogg", "start": 1555753, "end": 1576550, "audio": 1}, {"filename": "/data/sound/electromagnet/nl/shoot-0-2.ogg", "start": 1576550, "end": 1598986, "audio": 1}, {"filename": "/data/sound/electromagnet/nl/shoot-0-3.ogg", "start": 1598986, "end": 1619553, "audio": 1}, {"filename": "/data/sound/electromagnet/nl/shoot-1.ogg", "start": 1619553, "end": 1639650, "audio": 1}, {"filename": "/data/sound/electromagnet/nl/shoot-2-0.ogg", "start": 1639650, "end": 1674517, "audio": 1}, {"filename": "/data/sound/electromagnet/nl/shoot-2-1.ogg", "start": 1674517, "end": 1701590, "audio": 1}, {"filename": "/data/sound/electromagnet/nl/shoot-3-0.ogg", "start": 1701590, "end": 1728000, "audio": 1}, {"filename": "/data/sound/electromagnet/nl/shoot-3-1.ogg", "start": 1728000, "end": 1747809, "audio": 1}, {"filename": "/data/sound/electromagnet/nl/shoot-4.ogg", "start": 1747809, "end": 1769873, "audio": 1}, {"filename": "/data/sound/electromagnet/nl/shoot-5.ogg", "start": 1769873, "end": 1806773, "audio": 1}, {"filename": "/data/sound/electromagnet/nl/shoot-6.ogg", "start": 1806773, "end": 1830280, "audio": 1}, {"filename": "/data/sound/electromagnet/nl/s-hurt-0.ogg", "start": 1830280, "end": 1844070, "audio": 1}, {"filename": "/data/sound/electromagnet/nl/s-hurt-1.ogg", "start": 1844070, "end": 1859155, "audio": 1}, {"filename": "/data/sound/electromagnet/nl/s-hurt-2.ogg", "start": 1859155, "end": 1872925, "audio": 1}], "remote_package_size": 1872925, "package_uuid": "0fd6b799-0f12-4e9e-89bd-7841c5549041"});

})();
