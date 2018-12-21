
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
    var PACKAGE_NAME = 'web/data/propulsion.data';
    var REMOTE_PACKAGE_BASE = 'data/propulsion.data';
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
Module['FS_createPath']('/data/images', 'propulsion', true, true);
Module['FS_createPath']('/data', 'script', true, true);
Module['FS_createPath']('/data/script', 'propulsion', true, true);
Module['FS_createPath']('/data', 'sound', true, true);
Module['FS_createPath']('/data/sound', 'propulsion', true, true);
Module['FS_createPath']('/data/sound/propulsion', 'cs', true, true);
Module['FS_createPath']('/data/sound/propulsion', 'nl', true, true);

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
              Module['removeRunDependency']('datafile_web/data/propulsion.data');

    };
    Module['addRunDependency']('datafile_web/data/propulsion.data');
  
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
 loadPackage({"files": [{"filename": "/data/images/propulsion/11-ocel.png", "start": 0, "end": 4229, "audio": 0}, {"filename": "/data/images/propulsion/12-ocel.png", "start": 4229, "end": 7537, "audio": 0}, {"filename": "/data/images/propulsion/15-ocel.png", "start": 7537, "end": 9597, "audio": 0}, {"filename": "/data/images/propulsion/16-ocel.png", "start": 9597, "end": 10464, "audio": 0}, {"filename": "/data/images/propulsion/7-ocel.png", "start": 10464, "end": 12536, "audio": 0}, {"filename": "/data/images/propulsion/8-ocel.png", "start": 12536, "end": 14308, "audio": 0}, {"filename": "/data/images/propulsion/cola.png", "start": 14308, "end": 19405, "audio": 0}, {"filename": "/data/images/propulsion/draty_.png", "start": 19405, "end": 21394, "audio": 0}, {"filename": "/data/images/propulsion/hadice_00.png", "start": 21394, "end": 24471, "audio": 0}, {"filename": "/data/images/propulsion/hadice_01.png", "start": 24471, "end": 27528, "audio": 0}, {"filename": "/data/images/propulsion/kamna.png", "start": 27528, "end": 31621, "audio": 0}, {"filename": "/data/images/propulsion/matka_a.png", "start": 31621, "end": 32258, "audio": 0}, {"filename": "/data/images/propulsion/plutonium-1a.png", "start": 32258, "end": 32671, "audio": 0}, {"filename": "/data/images/propulsion/plutonium-4-_00.png", "start": 32671, "end": 33854, "audio": 0}, {"filename": "/data/images/propulsion/plutonium-4-_01.png", "start": 33854, "end": 35023, "audio": 0}, {"filename": "/data/images/propulsion/plutonium-4-_02.png", "start": 35023, "end": 36200, "audio": 0}, {"filename": "/data/images/propulsion/podstavec_00.png", "start": 36200, "end": 46516, "audio": 0}, {"filename": "/data/images/propulsion/podstavec_01.png", "start": 46516, "end": 56918, "audio": 0}, {"filename": "/data/images/propulsion/podstavec_02.png", "start": 56918, "end": 67341, "audio": 0}, {"filename": "/data/images/propulsion/podstavec_03.png", "start": 67341, "end": 77798, "audio": 0}, {"filename": "/data/images/propulsion/pohon_00.png", "start": 77798, "end": 88290, "audio": 0}, {"filename": "/data/images/propulsion/pohon_01.png", "start": 88290, "end": 98735, "audio": 0}, {"filename": "/data/images/propulsion/pohon_02.png", "start": 98735, "end": 109147, "audio": 0}, {"filename": "/data/images/propulsion/pohon_03.png", "start": 109147, "end": 119526, "audio": 0}, {"filename": "/data/images/propulsion/pohon_04.png", "start": 119526, "end": 129958, "audio": 0}, {"filename": "/data/images/propulsion/pohon_05.png", "start": 129958, "end": 140352, "audio": 0}, {"filename": "/data/images/propulsion/pohon_06.png", "start": 140352, "end": 150872, "audio": 0}, {"filename": "/data/images/propulsion/pohon_07.png", "start": 150872, "end": 161332, "audio": 0}, {"filename": "/data/images/propulsion/pohon_08.png", "start": 161332, "end": 171779, "audio": 0}, {"filename": "/data/images/propulsion/pohon_09.png", "start": 171779, "end": 182326, "audio": 0}, {"filename": "/data/images/propulsion/pohon_10.png", "start": 182326, "end": 192774, "audio": 0}, {"filename": "/data/images/propulsion/pohon_11.png", "start": 192774, "end": 203318, "audio": 0}, {"filename": "/data/images/propulsion/pohon-p.png", "start": 203318, "end": 331821, "audio": 0}, {"filename": "/data/images/propulsion/pohon-w.png", "start": 331821, "end": 349724, "audio": 0}, {"filename": "/data/images/propulsion/poster.png", "start": 349724, "end": 490880, "audio": 0}, {"filename": "/data/images/propulsion/rura.png", "start": 490880, "end": 495115, "audio": 0}, {"filename": "/data/images/propulsion/ufo_00.png", "start": 495115, "end": 500654, "audio": 0}, {"filename": "/data/images/propulsion/ufo_01.png", "start": 500654, "end": 506059, "audio": 0}, {"filename": "/data/images/propulsion/ufo_02.png", "start": 506059, "end": 511465, "audio": 0}, {"filename": "/data/images/propulsion/ufo_03.png", "start": 511465, "end": 516783, "audio": 0}, {"filename": "/data/images/propulsion/ufo_04.png", "start": 516783, "end": 521102, "audio": 0}, {"filename": "/data/images/propulsion/ufo_05.png", "start": 521102, "end": 525302, "audio": 0}, {"filename": "/data/images/propulsion/ufo_06.png", "start": 525302, "end": 529467, "audio": 0}, {"filename": "/data/images/propulsion/ufo_07.png", "start": 529467, "end": 534933, "audio": 0}, {"filename": "/data/images/propulsion/ufo_08.png", "start": 534933, "end": 540340, "audio": 0}, {"filename": "/data/images/propulsion/ufo_09.png", "start": 540340, "end": 545675, "audio": 0}, {"filename": "/data/images/propulsion/ufo_10.png", "start": 545675, "end": 550912, "audio": 0}, {"filename": "/data/images/propulsion/ufon-_00.png", "start": 550912, "end": 554866, "audio": 0}, {"filename": "/data/images/propulsion/ufon-_01.png", "start": 554866, "end": 558935, "audio": 0}, {"filename": "/data/images/propulsion/ufon-_02.png", "start": 558935, "end": 562878, "audio": 0}, {"filename": "/data/images/propulsion/ufon-_03.png", "start": 562878, "end": 566813, "audio": 0}, {"filename": "/data/images/propulsion/ufon-_04.png", "start": 566813, "end": 570798, "audio": 0}, {"filename": "/data/images/propulsion/ufon-_05.png", "start": 570798, "end": 574746, "audio": 0}, {"filename": "/data/images/propulsion/ufon-_06.png", "start": 574746, "end": 578814, "audio": 0}, {"filename": "/data/images/propulsion/ufon-_07.png", "start": 578814, "end": 582763, "audio": 0}, {"filename": "/data/images/propulsion/ufon-_08.png", "start": 582763, "end": 586704, "audio": 0}, {"filename": "/data/images/propulsion/ufon-_09.png", "start": 586704, "end": 590669, "audio": 0}, {"filename": "/data/images/propulsion/volant.png", "start": 590669, "end": 592052, "audio": 0}, {"filename": "/data/script/propulsion/code.lua", "start": 592052, "end": 607550, "audio": 0}, {"filename": "/data/script/propulsion/demo_dialogs_bg.lua", "start": 607550, "end": 608790, "audio": 0}, {"filename": "/data/script/propulsion/demo_dialogs_cs.lua", "start": 608790, "end": 609341, "audio": 0}, {"filename": "/data/script/propulsion/demo_dialogs_de.lua", "start": 609341, "end": 610395, "audio": 0}, {"filename": "/data/script/propulsion/demo_dialogs_en.lua", "start": 610395, "end": 610916, "audio": 0}, {"filename": "/data/script/propulsion/demo_dialogs_es.lua", "start": 610916, "end": 611946, "audio": 0}, {"filename": "/data/script/propulsion/demo_dialogs_fr.lua", "start": 611946, "end": 613015, "audio": 0}, {"filename": "/data/script/propulsion/demo_dialogs_it.lua", "start": 613015, "end": 614025, "audio": 0}, {"filename": "/data/script/propulsion/demo_dialogs_nl.lua", "start": 614025, "end": 615025, "audio": 0}, {"filename": "/data/script/propulsion/demo_dialogs_pl.lua", "start": 615025, "end": 616067, "audio": 0}, {"filename": "/data/script/propulsion/demo_dialogs_ru.lua", "start": 616067, "end": 617357, "audio": 0}, {"filename": "/data/script/propulsion/demo_dialogs_sv.lua", "start": 617357, "end": 618355, "audio": 0}, {"filename": "/data/script/propulsion/demo_poster.lua", "start": 618355, "end": 618701, "audio": 0}, {"filename": "/data/script/propulsion/dialogs_bg.lua", "start": 618701, "end": 623101, "audio": 0}, {"filename": "/data/script/propulsion/dialogs_cs.lua", "start": 623101, "end": 626662, "audio": 0}, {"filename": "/data/script/propulsion/dialogs_de_CH.lua", "start": 626662, "end": 626850, "audio": 0}, {"filename": "/data/script/propulsion/dialogs_de.lua", "start": 626850, "end": 630597, "audio": 0}, {"filename": "/data/script/propulsion/dialogs_en.lua", "start": 630597, "end": 632730, "audio": 0}, {"filename": "/data/script/propulsion/dialogs_es.lua", "start": 632730, "end": 636436, "audio": 0}, {"filename": "/data/script/propulsion/dialogs_fr.lua", "start": 636436, "end": 640169, "audio": 0}, {"filename": "/data/script/propulsion/dialogs_it.lua", "start": 640169, "end": 643792, "audio": 0}, {"filename": "/data/script/propulsion/dialogs.lua", "start": 643792, "end": 643830, "audio": 0}, {"filename": "/data/script/propulsion/dialogs_nl.lua", "start": 643830, "end": 647512, "audio": 0}, {"filename": "/data/script/propulsion/dialogs_pl.lua", "start": 647512, "end": 651234, "audio": 0}, {"filename": "/data/script/propulsion/dialogs_ru.lua", "start": 651234, "end": 655716, "audio": 0}, {"filename": "/data/script/propulsion/dialogs_sv.lua", "start": 655716, "end": 659376, "audio": 0}, {"filename": "/data/script/propulsion/init.lua", "start": 659376, "end": 660025, "audio": 0}, {"filename": "/data/script/propulsion/models.lua", "start": 660025, "end": 664857, "audio": 0}, {"filename": "/data/sound/propulsion/cs/poh-m-dobre.ogg", "start": 664857, "end": 680359, "audio": 1}, {"filename": "/data/sound/propulsion/cs/poh-m-dobryden0.ogg", "start": 680359, "end": 716398, "audio": 1}, {"filename": "/data/sound/propulsion/cs/poh-m-dobryden1.ogg", "start": 716398, "end": 758539, "audio": 1}, {"filename": "/data/sound/propulsion/cs/poh-m-motor.ogg", "start": 758539, "end": 772051, "audio": 1}, {"filename": "/data/sound/propulsion/cs/poh-m-pohadali.ogg", "start": 772051, "end": 794049, "audio": 1}, {"filename": "/data/sound/propulsion/cs/poh-m-princip.ogg", "start": 794049, "end": 833780, "audio": 1}, {"filename": "/data/sound/propulsion/cs/poh-m-projekt.ogg", "start": 833780, "end": 866060, "audio": 1}, {"filename": "/data/sound/propulsion/cs/poh-m-reaktor.ogg", "start": 866060, "end": 882893, "audio": 1}, {"filename": "/data/sound/propulsion/cs/poh-m-sest.ogg", "start": 882893, "end": 910280, "audio": 1}, {"filename": "/data/sound/propulsion/cs/poh-m-sestra.ogg", "start": 910280, "end": 935006, "audio": 1}, {"filename": "/data/sound/propulsion/cs/poh-m-tosnadne.ogg", "start": 935006, "end": 947799, "audio": 1}, {"filename": "/data/sound/propulsion/cs/poh-v-automat.ogg", "start": 947799, "end": 974109, "audio": 1}, {"filename": "/data/sound/propulsion/cs/poh-v-biosila.ogg", "start": 974109, "end": 1012223, "audio": 1}, {"filename": "/data/sound/propulsion/cs/poh-v-forma.ogg", "start": 1012223, "end": 1048312, "audio": 1}, {"filename": "/data/sound/propulsion/cs/poh-v-klec.ogg", "start": 1048312, "end": 1068976, "audio": 1}, {"filename": "/data/sound/propulsion/cs/poh-v-neuveri.ogg", "start": 1068976, "end": 1086186, "audio": 1}, {"filename": "/data/sound/propulsion/cs/poh-v-pomoct.ogg", "start": 1086186, "end": 1109106, "audio": 1}, {"filename": "/data/sound/propulsion/cs/poh-v-setkani.ogg", "start": 1109106, "end": 1134060, "audio": 1}, {"filename": "/data/sound/propulsion/cs/poh-v-takhle.ogg", "start": 1134060, "end": 1148687, "audio": 1}, {"filename": "/data/sound/propulsion/cs/poh-v-tocit.ogg", "start": 1148687, "end": 1167679, "audio": 1}, {"filename": "/data/sound/propulsion/cs/poh-v-ukol.ogg", "start": 1167679, "end": 1199311, "audio": 1}, {"filename": "/data/sound/propulsion/cs/poh-v-zarizeni.ogg", "start": 1199311, "end": 1217823, "audio": 1}, {"filename": "/data/sound/propulsion/nl/poh-m-dobre.ogg", "start": 1217823, "end": 1234440, "audio": 1}, {"filename": "/data/sound/propulsion/nl/poh-m-dobryden0.ogg", "start": 1234440, "end": 1261573, "audio": 1}, {"filename": "/data/sound/propulsion/nl/poh-m-dobryden1.ogg", "start": 1261573, "end": 1295196, "audio": 1}, {"filename": "/data/sound/propulsion/nl/poh-m-motor.ogg", "start": 1295196, "end": 1314274, "audio": 1}, {"filename": "/data/sound/propulsion/nl/poh-m-pohadali.ogg", "start": 1314274, "end": 1337200, "audio": 1}, {"filename": "/data/sound/propulsion/nl/poh-m-princip.ogg", "start": 1337200, "end": 1384286, "audio": 1}, {"filename": "/data/sound/propulsion/nl/poh-m-projekt.ogg", "start": 1384286, "end": 1416095, "audio": 1}, {"filename": "/data/sound/propulsion/nl/poh-m-reaktor.ogg", "start": 1416095, "end": 1436924, "audio": 1}, {"filename": "/data/sound/propulsion/nl/poh-m-sest.ogg", "start": 1436924, "end": 1461547, "audio": 1}, {"filename": "/data/sound/propulsion/nl/poh-m-sestra.ogg", "start": 1461547, "end": 1487287, "audio": 1}, {"filename": "/data/sound/propulsion/nl/poh-m-tosnadne.ogg", "start": 1487287, "end": 1502253, "audio": 1}, {"filename": "/data/sound/propulsion/nl/poh-v-automat.ogg", "start": 1502253, "end": 1529871, "audio": 1}, {"filename": "/data/sound/propulsion/nl/poh-v-biosila.ogg", "start": 1529871, "end": 1561177, "audio": 1}, {"filename": "/data/sound/propulsion/nl/poh-v-forma.ogg", "start": 1561177, "end": 1592852, "audio": 1}, {"filename": "/data/sound/propulsion/nl/poh-v-klec.ogg", "start": 1592852, "end": 1617310, "audio": 1}, {"filename": "/data/sound/propulsion/nl/poh-v-neuveri.ogg", "start": 1617310, "end": 1635595, "audio": 1}, {"filename": "/data/sound/propulsion/nl/poh-v-pomoct.ogg", "start": 1635595, "end": 1661503, "audio": 1}, {"filename": "/data/sound/propulsion/nl/poh-v-setkani.ogg", "start": 1661503, "end": 1688039, "audio": 1}, {"filename": "/data/sound/propulsion/nl/poh-v-takhle.ogg", "start": 1688039, "end": 1707436, "audio": 1}, {"filename": "/data/sound/propulsion/nl/poh-v-tocit.ogg", "start": 1707436, "end": 1734826, "audio": 1}, {"filename": "/data/sound/propulsion/nl/poh-v-ukol.ogg", "start": 1734826, "end": 1762015, "audio": 1}, {"filename": "/data/sound/propulsion/nl/poh-v-zarizeni.ogg", "start": 1762015, "end": 1782850, "audio": 1}], "remote_package_size": 1782850, "package_uuid": "2c10d2d2-df1f-4dea-b887-5d247f762f30"});

})();
