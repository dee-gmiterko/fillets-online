
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
    var PACKAGE_NAME = 'web/data/reactor.data';
    var REMOTE_PACKAGE_BASE = 'data/reactor.data';
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
Module['FS_createPath']('/data/images', 'reactor', true, true);
Module['FS_createPath']('/data', 'script', true, true);
Module['FS_createPath']('/data/script', 'reactor', true, true);
Module['FS_createPath']('/data', 'sound', true, true);
Module['FS_createPath']('/data/sound', 'reactor', true, true);
Module['FS_createPath']('/data/sound/reactor', 'cs', true, true);
Module['FS_createPath']('/data/sound/reactor', 'en', true, true);
Module['FS_createPath']('/data/sound/reactor', 'nl', true, true);

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
              Module['removeRunDependency']('datafile_web/data/reactor.data');

    };
    Module['addRunDependency']('datafile_web/data/reactor.data');
  
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
 loadPackage({"files": [{"filename": "/data/images/reactor/ocel.png", "start": 0, "end": 1855, "audio": 0}, {"filename": "/data/images/reactor/pld_00.png", "start": 1855, "end": 12421, "audio": 0}, {"filename": "/data/images/reactor/pld_01.png", "start": 12421, "end": 22339, "audio": 0}, {"filename": "/data/images/reactor/pld_02.png", "start": 22339, "end": 32874, "audio": 0}, {"filename": "/data/images/reactor/pld_03.png", "start": 32874, "end": 43239, "audio": 0}, {"filename": "/data/images/reactor/pld_04.png", "start": 43239, "end": 54060, "audio": 0}, {"filename": "/data/images/reactor/pld_05.png", "start": 54060, "end": 65161, "audio": 0}, {"filename": "/data/images/reactor/pld_06.png", "start": 65161, "end": 75811, "audio": 0}, {"filename": "/data/images/reactor/pld_07.png", "start": 75811, "end": 86723, "audio": 0}, {"filename": "/data/images/reactor/pld_08.png", "start": 86723, "end": 97961, "audio": 0}, {"filename": "/data/images/reactor/pld_09.png", "start": 97961, "end": 108637, "audio": 0}, {"filename": "/data/images/reactor/pld_10.png", "start": 108637, "end": 119563, "audio": 0}, {"filename": "/data/images/reactor/pld_11.png", "start": 119563, "end": 130725, "audio": 0}, {"filename": "/data/images/reactor/pld_12.png", "start": 130725, "end": 141483, "audio": 0}, {"filename": "/data/images/reactor/pld_13.png", "start": 141483, "end": 152496, "audio": 0}, {"filename": "/data/images/reactor/pld_14.png", "start": 152496, "end": 163841, "audio": 0}, {"filename": "/data/images/reactor/pld_15.png", "start": 163841, "end": 175091, "audio": 0}, {"filename": "/data/images/reactor/plutonium-1-_00.png", "start": 175091, "end": 175540, "audio": 0}, {"filename": "/data/images/reactor/plutonium-1-_01.png", "start": 175540, "end": 175992, "audio": 0}, {"filename": "/data/images/reactor/plutonium-1-_02.png", "start": 175992, "end": 176465, "audio": 0}, {"filename": "/data/images/reactor/plutonium-1a.png", "start": 176465, "end": 176878, "audio": 0}, {"filename": "/data/images/reactor/plutonium-2-_00.png", "start": 176878, "end": 177550, "audio": 0}, {"filename": "/data/images/reactor/plutonium-2-_01.png", "start": 177550, "end": 178211, "audio": 0}, {"filename": "/data/images/reactor/plutonium-2-_02.png", "start": 178211, "end": 178887, "audio": 0}, {"filename": "/data/images/reactor/plutonium-3-_00.png", "start": 178887, "end": 179797, "audio": 0}, {"filename": "/data/images/reactor/plutonium-3-_01.png", "start": 179797, "end": 180705, "audio": 0}, {"filename": "/data/images/reactor/plutonium-3-_02.png", "start": 180705, "end": 181605, "audio": 0}, {"filename": "/data/images/reactor/plutonium-4-_00.png", "start": 181605, "end": 182791, "audio": 0}, {"filename": "/data/images/reactor/plutonium-4-_01.png", "start": 182791, "end": 183949, "audio": 0}, {"filename": "/data/images/reactor/plutonium-4-_02.png", "start": 183949, "end": 185105, "audio": 0}, {"filename": "/data/images/reactor/plutonium-5-_00.png", "start": 185105, "end": 186487, "audio": 0}, {"filename": "/data/images/reactor/plutonium-5-_01.png", "start": 186487, "end": 187854, "audio": 0}, {"filename": "/data/images/reactor/plutonium-5-_02.png", "start": 187854, "end": 189206, "audio": 0}, {"filename": "/data/images/reactor/plutonium-7-_00.png", "start": 189206, "end": 191065, "audio": 0}, {"filename": "/data/images/reactor/plutonium-7-_01.png", "start": 191065, "end": 192953, "audio": 0}, {"filename": "/data/images/reactor/plutonium-7-_02.png", "start": 192953, "end": 194761, "audio": 0}, {"filename": "/data/images/reactor/plutonium-8-_00.png", "start": 194761, "end": 196845, "audio": 0}, {"filename": "/data/images/reactor/plutonium-8-_01.png", "start": 196845, "end": 198941, "audio": 0}, {"filename": "/data/images/reactor/plutonium-8-_02.png", "start": 198941, "end": 200861, "audio": 0}, {"filename": "/data/images/reactor/reaktor-p.png", "start": 200861, "end": 319275, "audio": 0}, {"filename": "/data/images/reactor/reaktor-w.png", "start": 319275, "end": 428623, "audio": 0}, {"filename": "/data/script/reactor/code.lua", "start": 428623, "end": 436832, "audio": 0}, {"filename": "/data/script/reactor/dialogs_bg.lua", "start": 436832, "end": 440228, "audio": 0}, {"filename": "/data/script/reactor/dialogs_cs.lua", "start": 440228, "end": 442848, "audio": 0}, {"filename": "/data/script/reactor/dialogs_de_CH.lua", "start": 442848, "end": 443356, "audio": 0}, {"filename": "/data/script/reactor/dialogs_de.lua", "start": 443356, "end": 446108, "audio": 0}, {"filename": "/data/script/reactor/dialogs_en.lua", "start": 446108, "end": 447824, "audio": 0}, {"filename": "/data/script/reactor/dialogs_es.lua", "start": 447824, "end": 450610, "audio": 0}, {"filename": "/data/script/reactor/dialogs_fr.lua", "start": 450610, "end": 453477, "audio": 0}, {"filename": "/data/script/reactor/dialogs_it.lua", "start": 453477, "end": 456272, "audio": 0}, {"filename": "/data/script/reactor/dialogs.lua", "start": 456272, "end": 456310, "audio": 0}, {"filename": "/data/script/reactor/dialogs_nl.lua", "start": 456310, "end": 459004, "audio": 0}, {"filename": "/data/script/reactor/dialogs_pl.lua", "start": 459004, "end": 461674, "audio": 0}, {"filename": "/data/script/reactor/dialogs_ru.lua", "start": 461674, "end": 465164, "audio": 0}, {"filename": "/data/script/reactor/dialogs_sv.lua", "start": 465164, "end": 467915, "audio": 0}, {"filename": "/data/script/reactor/init.lua", "start": 467915, "end": 468561, "audio": 0}, {"filename": "/data/script/reactor/models.lua", "start": 468561, "end": 472889, "audio": 0}, {"filename": "/data/sound/reactor/cs/rea-m-anebo.ogg", "start": 472889, "end": 490264, "audio": 1}, {"filename": "/data/sound/reactor/cs/rea-m-cojavim.ogg", "start": 490264, "end": 534998, "audio": 1}, {"filename": "/data/sound/reactor/cs/rea-m-comyslis.ogg", "start": 534998, "end": 550115, "audio": 1}, {"filename": "/data/sound/reactor/cs/rea-m-doufam.ogg", "start": 550115, "end": 574568, "audio": 1}, {"filename": "/data/sound/reactor/cs/rea-m-jakmuzes.ogg", "start": 574568, "end": 597946, "audio": 1}, {"filename": "/data/sound/reactor/cs/rea-m-mohl.ogg", "start": 597946, "end": 638692, "audio": 1}, {"filename": "/data/sound/reactor/cs/rea-m-nevim.ogg", "start": 638692, "end": 658925, "audio": 1}, {"filename": "/data/sound/reactor/cs/rea-m-proboha.ogg", "start": 658925, "end": 681954, "audio": 1}, {"filename": "/data/sound/reactor/cs/rea-v-acoby.ogg", "start": 681954, "end": 694662, "audio": 1}, {"filename": "/data/sound/reactor/cs/rea-v-coto.ogg", "start": 694662, "end": 707004, "audio": 1}, {"filename": "/data/sound/reactor/cs/rea-v-kolik.ogg", "start": 707004, "end": 746671, "audio": 1}, {"filename": "/data/sound/reactor/cs/rea-v-ledaze.ogg", "start": 746671, "end": 771253, "audio": 1}, {"filename": "/data/sound/reactor/cs/rea-v-nemudruj.ogg", "start": 771253, "end": 789922, "audio": 1}, {"filename": "/data/sound/reactor/cs/rea-v-patrne.ogg", "start": 789922, "end": 815888, "audio": 1}, {"filename": "/data/sound/reactor/cs/rea-v-radeji.ogg", "start": 815888, "end": 840207, "audio": 1}, {"filename": "/data/sound/reactor/cs/rea-v-takvidis.ogg", "start": 840207, "end": 851920, "audio": 1}, {"filename": "/data/sound/reactor/cs/rea-v-tozni.ogg", "start": 851920, "end": 865270, "audio": 1}, {"filename": "/data/sound/reactor/en/rea-x-pldik.ogg", "start": 865270, "end": 884470, "audio": 1}, {"filename": "/data/sound/reactor/en/rea-x-reakttyc.ogg", "start": 884470, "end": 899612, "audio": 1}, {"filename": "/data/sound/reactor/nl/rea-m-anebo.ogg", "start": 899612, "end": 922175, "audio": 1}, {"filename": "/data/sound/reactor/nl/rea-m-cojavim.ogg", "start": 922175, "end": 953090, "audio": 1}, {"filename": "/data/sound/reactor/nl/rea-m-comyslis.ogg", "start": 953090, "end": 972264, "audio": 1}, {"filename": "/data/sound/reactor/nl/rea-m-doufam.ogg", "start": 972264, "end": 995690, "audio": 1}, {"filename": "/data/sound/reactor/nl/rea-m-jakmuzes.ogg", "start": 995690, "end": 1019633, "audio": 1}, {"filename": "/data/sound/reactor/nl/rea-m-mohl.ogg", "start": 1019633, "end": 1052117, "audio": 1}, {"filename": "/data/sound/reactor/nl/rea-m-nevim.ogg", "start": 1052117, "end": 1073415, "audio": 1}, {"filename": "/data/sound/reactor/nl/rea-m-proboha.ogg", "start": 1073415, "end": 1092102, "audio": 1}, {"filename": "/data/sound/reactor/nl/rea-v-acoby.ogg", "start": 1092102, "end": 1110655, "audio": 1}, {"filename": "/data/sound/reactor/nl/rea-v-coto.ogg", "start": 1110655, "end": 1132059, "audio": 1}, {"filename": "/data/sound/reactor/nl/rea-v-kolik.ogg", "start": 1132059, "end": 1173861, "audio": 1}, {"filename": "/data/sound/reactor/nl/rea-v-ledaze.ogg", "start": 1173861, "end": 1201791, "audio": 1}, {"filename": "/data/sound/reactor/nl/rea-v-nemudruj.ogg", "start": 1201791, "end": 1221455, "audio": 1}, {"filename": "/data/sound/reactor/nl/rea-v-patrne.ogg", "start": 1221455, "end": 1255232, "audio": 1}, {"filename": "/data/sound/reactor/nl/rea-v-radeji.ogg", "start": 1255232, "end": 1276719, "audio": 1}, {"filename": "/data/sound/reactor/nl/rea-v-takvidis.ogg", "start": 1276719, "end": 1292352, "audio": 1}, {"filename": "/data/sound/reactor/nl/rea-v-tozni.ogg", "start": 1292352, "end": 1308791, "audio": 1}], "remote_package_size": 1308791, "package_uuid": "9403b94e-15b7-49ab-9abd-4809a43be8c1"});

})();
