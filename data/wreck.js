
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
    var PACKAGE_NAME = 'web/data/wreck.data';
    var REMOTE_PACKAGE_BASE = 'data/wreck.data';
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
Module['FS_createPath']('/data/images', 'wreck', true, true);
Module['FS_createPath']('/data', 'script', true, true);
Module['FS_createPath']('/data/script', 'wreck', true, true);
Module['FS_createPath']('/data', 'sound', true, true);
Module['FS_createPath']('/data/sound', 'wreck', true, true);
Module['FS_createPath']('/data/sound/wreck', 'cs', true, true);
Module['FS_createPath']('/data/sound/wreck', 'nl', true, true);

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
              Module['removeRunDependency']('datafile_web/data/wreck.data');

    };
    Module['addRunDependency']('datafile_web/data/wreck.data');
  
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
 loadPackage({"files": [{"filename": "/data/images/wreck/cepicka.png", "start": 0, "end": 1604, "audio": 0}, {"filename": "/data/images/wreck/klobrc.png", "start": 1604, "end": 5330, "audio": 0}, {"filename": "/data/images/wreck/medusa_00.png", "start": 5330, "end": 7308, "audio": 0}, {"filename": "/data/images/wreck/medusa_01.png", "start": 7308, "end": 9304, "audio": 0}, {"filename": "/data/images/wreck/medusa_02.png", "start": 9304, "end": 11269, "audio": 0}, {"filename": "/data/images/wreck/muslicka.png", "start": 11269, "end": 11971, "audio": 0}, {"filename": "/data/images/wreck/potopena-1-tmp.png", "start": 11971, "end": 12906, "audio": 0}, {"filename": "/data/images/wreck/potopena-3-tmp.png", "start": 12906, "end": 14554, "audio": 0}, {"filename": "/data/images/wreck/potopena-hotovo.png", "start": 14554, "end": 146917, "audio": 0}, {"filename": "/data/images/wreck/potopena-pozadi.png", "start": 146917, "end": 251483, "audio": 0}, {"filename": "/data/images/wreck/rybicka_h_00.png", "start": 251483, "end": 252629, "audio": 0}, {"filename": "/data/images/wreck/rybicka_h_01.png", "start": 252629, "end": 253789, "audio": 0}, {"filename": "/data/images/wreck/rybicka_h_02.png", "start": 253789, "end": 254940, "audio": 0}, {"filename": "/data/images/wreck/rybicka_h_03.png", "start": 254940, "end": 256066, "audio": 0}, {"filename": "/data/script/wreck/code.lua", "start": 256066, "end": 260988, "audio": 0}, {"filename": "/data/script/wreck/dialogs_bg.lua", "start": 260988, "end": 264376, "audio": 0}, {"filename": "/data/script/wreck/dialogs_cs.lua", "start": 264376, "end": 267265, "audio": 0}, {"filename": "/data/script/wreck/dialogs_de_CH.lua", "start": 267265, "end": 267386, "audio": 0}, {"filename": "/data/script/wreck/dialogs_de.lua", "start": 267386, "end": 270411, "audio": 0}, {"filename": "/data/script/wreck/dialogs_en.lua", "start": 270411, "end": 272199, "audio": 0}, {"filename": "/data/script/wreck/dialogs_es.lua", "start": 272199, "end": 275231, "audio": 0}, {"filename": "/data/script/wreck/dialogs_fr.lua", "start": 275231, "end": 278293, "audio": 0}, {"filename": "/data/script/wreck/dialogs_it.lua", "start": 278293, "end": 281275, "audio": 0}, {"filename": "/data/script/wreck/dialogs.lua", "start": 281275, "end": 281313, "audio": 0}, {"filename": "/data/script/wreck/dialogs_nl.lua", "start": 281313, "end": 284284, "audio": 0}, {"filename": "/data/script/wreck/dialogs_pl.lua", "start": 284284, "end": 287191, "audio": 0}, {"filename": "/data/script/wreck/dialogs_ru.lua", "start": 287191, "end": 290652, "audio": 0}, {"filename": "/data/script/wreck/dialogs_sv.lua", "start": 290652, "end": 293565, "audio": 0}, {"filename": "/data/script/wreck/init.lua", "start": 293565, "end": 294209, "audio": 0}, {"filename": "/data/script/wreck/models.lua", "start": 294209, "end": 296111, "audio": 0}, {"filename": "/data/sound/wreck/cs/pot-m-dik.ogg", "start": 296111, "end": 314505, "audio": 1}, {"filename": "/data/sound/wreck/cs/pot-m-dovn.ogg", "start": 314505, "end": 331105, "audio": 1}, {"filename": "/data/sound/wreck/cs/pot-m-hnil.ogg", "start": 331105, "end": 347450, "audio": 1}, {"filename": "/data/sound/wreck/cs/pot-m-klob.ogg", "start": 347450, "end": 364276, "audio": 1}, {"filename": "/data/sound/wreck/cs/pot-m-moc.ogg", "start": 364276, "end": 379556, "audio": 1}, {"filename": "/data/sound/wreck/cs/pot-m-nezb.ogg", "start": 379556, "end": 404395, "audio": 1}, {"filename": "/data/sound/wreck/cs/pot-m-pujc.ogg", "start": 404395, "end": 433036, "audio": 1}, {"filename": "/data/sound/wreck/cs/pot-m-soud.ogg", "start": 433036, "end": 448041, "audio": 1}, {"filename": "/data/sound/wreck/cs/pot-m-velik.ogg", "start": 448041, "end": 465425, "audio": 1}, {"filename": "/data/sound/wreck/cs/pot-m-vidis.ogg", "start": 465425, "end": 477817, "audio": 1}, {"filename": "/data/sound/wreck/cs/pot-m-zatuch.ogg", "start": 477817, "end": 494265, "audio": 1}, {"filename": "/data/sound/wreck/cs/pot-m-zima.ogg", "start": 494265, "end": 508973, "audio": 1}, {"filename": "/data/sound/wreck/cs/pot-v-cepic.ogg", "start": 508973, "end": 527132, "audio": 1}, {"filename": "/data/sound/wreck/cs/pot-v-hlave.ogg", "start": 527132, "end": 541939, "audio": 1}, {"filename": "/data/sound/wreck/cs/pot-v-jmeno.ogg", "start": 541939, "end": 557312, "audio": 1}, {"filename": "/data/sound/wreck/cs/pot-v-kras.ogg", "start": 557312, "end": 572340, "audio": 1}, {"filename": "/data/sound/wreck/cs/pot-v-leda.ogg", "start": 572340, "end": 585865, "audio": 1}, {"filename": "/data/sound/wreck/cs/pot-v-lod.ogg", "start": 585865, "end": 605157, "audio": 1}, {"filename": "/data/sound/wreck/cs/pot-v-nehnu.ogg", "start": 605157, "end": 619004, "audio": 1}, {"filename": "/data/sound/wreck/cs/pot-v-nikdo.ogg", "start": 619004, "end": 635447, "audio": 1}, {"filename": "/data/sound/wreck/cs/pot-v-plav.ogg", "start": 635447, "end": 670730, "audio": 1}, {"filename": "/data/sound/wreck/cs/pot-v-ponur.ogg", "start": 670730, "end": 695787, "audio": 1}, {"filename": "/data/sound/wreck/cs/pot-v-slus.ogg", "start": 695787, "end": 712039, "audio": 1}, {"filename": "/data/sound/wreck/cs/pot-v-trub.ogg", "start": 712039, "end": 728659, "audio": 1}, {"filename": "/data/sound/wreck/cs/pot-v-vidim.ogg", "start": 728659, "end": 755840, "audio": 1}, {"filename": "/data/sound/wreck/nl/pot-m-dik.ogg", "start": 755840, "end": 771451, "audio": 1}, {"filename": "/data/sound/wreck/nl/pot-m-dovn.ogg", "start": 771451, "end": 788041, "audio": 1}, {"filename": "/data/sound/wreck/nl/pot-m-hnil.ogg", "start": 788041, "end": 805994, "audio": 1}, {"filename": "/data/sound/wreck/nl/pot-m-klob.ogg", "start": 805994, "end": 825274, "audio": 1}, {"filename": "/data/sound/wreck/nl/pot-m-moc.ogg", "start": 825274, "end": 841063, "audio": 1}, {"filename": "/data/sound/wreck/nl/pot-m-nezb.ogg", "start": 841063, "end": 859895, "audio": 1}, {"filename": "/data/sound/wreck/nl/pot-m-pujc.ogg", "start": 859895, "end": 878772, "audio": 1}, {"filename": "/data/sound/wreck/nl/pot-m-soud.ogg", "start": 878772, "end": 893090, "audio": 1}, {"filename": "/data/sound/wreck/nl/pot-m-velik.ogg", "start": 893090, "end": 913974, "audio": 1}, {"filename": "/data/sound/wreck/nl/pot-m-vidis.ogg", "start": 913974, "end": 928634, "audio": 1}, {"filename": "/data/sound/wreck/nl/pot-m-zatuch.ogg", "start": 928634, "end": 945697, "audio": 1}, {"filename": "/data/sound/wreck/nl/pot-m-zima.ogg", "start": 945697, "end": 961453, "audio": 1}, {"filename": "/data/sound/wreck/nl/pot-v-cepic.ogg", "start": 961453, "end": 976700, "audio": 1}, {"filename": "/data/sound/wreck/nl/pot-v-hlave.ogg", "start": 976700, "end": 993868, "audio": 1}, {"filename": "/data/sound/wreck/nl/pot-v-jmeno.ogg", "start": 993868, "end": 1011554, "audio": 1}, {"filename": "/data/sound/wreck/nl/pot-v-kras.ogg", "start": 1011554, "end": 1028248, "audio": 1}, {"filename": "/data/sound/wreck/nl/pot-v-leda.ogg", "start": 1028248, "end": 1046182, "audio": 1}, {"filename": "/data/sound/wreck/nl/pot-v-lod.ogg", "start": 1046182, "end": 1069943, "audio": 1}, {"filename": "/data/sound/wreck/nl/pot-v-nehnu.ogg", "start": 1069943, "end": 1088063, "audio": 1}, {"filename": "/data/sound/wreck/nl/pot-v-nikdo.ogg", "start": 1088063, "end": 1104813, "audio": 1}, {"filename": "/data/sound/wreck/nl/pot-v-plav.ogg", "start": 1104813, "end": 1142120, "audio": 1}, {"filename": "/data/sound/wreck/nl/pot-v-ponur.ogg", "start": 1142120, "end": 1165618, "audio": 1}, {"filename": "/data/sound/wreck/nl/pot-v-slus.ogg", "start": 1165618, "end": 1183172, "audio": 1}, {"filename": "/data/sound/wreck/nl/pot-v-trub.ogg", "start": 1183172, "end": 1206079, "audio": 1}, {"filename": "/data/sound/wreck/nl/pot-v-vidim.ogg", "start": 1206079, "end": 1234264, "audio": 1}], "remote_package_size": 1234264, "package_uuid": "b7cf549d-6110-4f21-a42b-5c5201630f4e"});

})();
