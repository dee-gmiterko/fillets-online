
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
    var PACKAGE_NAME = 'web/data/cabin1.data';
    var REMOTE_PACKAGE_BASE = 'data/cabin1.data';
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
Module['FS_createPath']('/data/images', 'cabin1', true, true);
Module['FS_createPath']('/data', 'script', true, true);
Module['FS_createPath']('/data/script', 'cabin1', true, true);
Module['FS_createPath']('/data', 'sound', true, true);
Module['FS_createPath']('/data/sound', 'cabin1', true, true);
Module['FS_createPath']('/data/sound/cabin1', 'cs', true, true);
Module['FS_createPath']('/data/sound/cabin1', 'en', true, true);
Module['FS_createPath']('/data/sound/cabin1', 'nl', true, true);

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
              Module['removeRunDependency']('datafile_web/data/cabin1.data');

    };
    Module['addRunDependency']('datafile_web/data/cabin1.data');
  
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
 loadPackage({"files": [{"filename": "/data/images/cabin1/chobotnice_00.png", "start": 0, "end": 4476, "audio": 0}, {"filename": "/data/images/cabin1/chobotnice_01.png", "start": 4476, "end": 8799, "audio": 0}, {"filename": "/data/images/cabin1/chobotnice_02.png", "start": 8799, "end": 13187, "audio": 0}, {"filename": "/data/images/cabin1/chobotnice_03.png", "start": 13187, "end": 17593, "audio": 0}, {"filename": "/data/images/cabin1/chobotnice_04.png", "start": 17593, "end": 21884, "audio": 0}, {"filename": "/data/images/cabin1/chobotnice_05.png", "start": 21884, "end": 26220, "audio": 0}, {"filename": "/data/images/cabin1/chobotnice_06.png", "start": 26220, "end": 30384, "audio": 0}, {"filename": "/data/images/cabin1/chobotnice_07.png", "start": 30384, "end": 34463, "audio": 0}, {"filename": "/data/images/cabin1/chobotnice_08.png", "start": 34463, "end": 38598, "audio": 0}, {"filename": "/data/images/cabin1/kajuta1p.png", "start": 38598, "end": 135485, "audio": 0}, {"filename": "/data/images/cabin1/kajuta1w.png", "start": 135485, "end": 273083, "audio": 0}, {"filename": "/data/images/cabin1/lampa.png", "start": 273083, "end": 276429, "audio": 0}, {"filename": "/data/images/cabin1/lebzna.png", "start": 276429, "end": 278226, "audio": 0}, {"filename": "/data/images/cabin1/papoucha_00.png", "start": 278226, "end": 280179, "audio": 0}, {"filename": "/data/images/cabin1/papoucha_01.png", "start": 280179, "end": 282153, "audio": 0}, {"filename": "/data/images/cabin1/trubka1.png", "start": 282153, "end": 282849, "audio": 0}, {"filename": "/data/images/cabin1/trubka2.png", "start": 282849, "end": 283727, "audio": 0}, {"filename": "/data/images/cabin1/truhla.png", "start": 283727, "end": 286185, "audio": 0}, {"filename": "/data/script/cabin1/code.lua", "start": 286185, "end": 301672, "audio": 0}, {"filename": "/data/script/cabin1/dialogs_bg.lua", "start": 301672, "end": 307178, "audio": 0}, {"filename": "/data/script/cabin1/dialogs_cs.lua", "start": 307178, "end": 311671, "audio": 0}, {"filename": "/data/script/cabin1/dialogs_de_CH.lua", "start": 311671, "end": 311750, "audio": 0}, {"filename": "/data/script/cabin1/dialogs_de.lua", "start": 311750, "end": 316431, "audio": 0}, {"filename": "/data/script/cabin1/dialogs_en.lua", "start": 316431, "end": 319431, "audio": 0}, {"filename": "/data/script/cabin1/dialogs_es.lua", "start": 319431, "end": 324223, "audio": 0}, {"filename": "/data/script/cabin1/dialogs_fr.lua", "start": 324223, "end": 328998, "audio": 0}, {"filename": "/data/script/cabin1/dialogs_it.lua", "start": 328998, "end": 333472, "audio": 0}, {"filename": "/data/script/cabin1/dialogs.lua", "start": 333472, "end": 333510, "audio": 0}, {"filename": "/data/script/cabin1/dialogs_nl.lua", "start": 333510, "end": 338148, "audio": 0}, {"filename": "/data/script/cabin1/dialogs_pl.lua", "start": 338148, "end": 342651, "audio": 0}, {"filename": "/data/script/cabin1/dialogs_ru.lua", "start": 342651, "end": 348253, "audio": 0}, {"filename": "/data/script/cabin1/dialogs_sv.lua", "start": 348253, "end": 352864, "audio": 0}, {"filename": "/data/script/cabin1/init.lua", "start": 352864, "end": 353509, "audio": 0}, {"filename": "/data/script/cabin1/models.lua", "start": 353509, "end": 355322, "audio": 0}, {"filename": "/data/sound/cabin1/cs/k1-m-chobotnice.ogg", "start": 355322, "end": 376500, "audio": 1}, {"filename": "/data/sound/cabin1/cs/k1-m-codelas.ogg", "start": 376500, "end": 390335, "audio": 1}, {"filename": "/data/sound/cabin1/cs/k1-m-copak.ogg", "start": 390335, "end": 404706, "audio": 1}, {"filename": "/data/sound/cabin1/cs/k1-m-diky.ogg", "start": 404706, "end": 415112, "audio": 1}, {"filename": "/data/sound/cabin1/cs/k1-m-fuj.ogg", "start": 415112, "end": 427321, "audio": 1}, {"filename": "/data/sound/cabin1/cs/k1-m-kolebku.ogg", "start": 427321, "end": 441234, "audio": 1}, {"filename": "/data/sound/cabin1/cs/k1-m-lebku.ogg", "start": 441234, "end": 459141, "audio": 1}, {"filename": "/data/sound/cabin1/cs/k1-m-mysli.ogg", "start": 459141, "end": 468760, "audio": 1}, {"filename": "/data/sound/cabin1/cs/k1-m-myslis.ogg", "start": 468760, "end": 494037, "audio": 1}, {"filename": "/data/sound/cabin1/cs/k1-m-podivin.ogg", "start": 494037, "end": 512647, "audio": 1}, {"filename": "/data/sound/cabin1/cs/k1-m-tospisona.ogg", "start": 512647, "end": 527115, "audio": 1}, {"filename": "/data/sound/cabin1/cs/k1-pap-3xkruty.ogg", "start": 527115, "end": 555186, "audio": 1}, {"filename": "/data/sound/cabin1/cs/k1-pap-drahokamy.ogg", "start": 555186, "end": 569022, "audio": 1}, {"filename": "/data/sound/cabin1/cs/k1-pap-drahousek.ogg", "start": 569022, "end": 590256, "audio": 1}, {"filename": "/data/sound/cabin1/cs/k1-pap-karamba.ogg", "start": 590256, "end": 603405, "audio": 1}, {"filename": "/data/sound/cabin1/cs/k1-pap-kruci.ogg", "start": 603405, "end": 613691, "audio": 1}, {"filename": "/data/sound/cabin1/cs/k1-pap-kruty.ogg", "start": 613691, "end": 630128, "audio": 1}, {"filename": "/data/sound/cabin1/cs/k1-pap-nestrkej.ogg", "start": 630128, "end": 644837, "audio": 1}, {"filename": "/data/sound/cabin1/cs/k1-pap-noproto.ogg", "start": 644837, "end": 655478, "audio": 1}, {"filename": "/data/sound/cabin1/cs/k1-pap-prcice.ogg", "start": 655478, "end": 670253, "audio": 1}, {"filename": "/data/sound/cabin1/cs/k1-pap-prekazet.ogg", "start": 670253, "end": 689181, "audio": 1}, {"filename": "/data/sound/cabin1/cs/k1-pap-problem.ogg", "start": 689181, "end": 708428, "audio": 1}, {"filename": "/data/sound/cabin1/cs/k1-pap-sakris.ogg", "start": 708428, "end": 719900, "audio": 1}, {"filename": "/data/sound/cabin1/cs/k1-pap-sestlustej.ogg", "start": 719900, "end": 735852, "audio": 1}, {"filename": "/data/sound/cabin1/cs/k1-pap-sucharek.ogg", "start": 735852, "end": 749720, "audio": 1}, {"filename": "/data/sound/cabin1/cs/k1-pap-trhnisi.ogg", "start": 749720, "end": 759447, "audio": 1}, {"filename": "/data/sound/cabin1/cs/k1-pap-vodprejskni.ogg", "start": 759447, "end": 774217, "audio": 1}, {"filename": "/data/sound/cabin1/cs/k1-v-bedna.ogg", "start": 774217, "end": 811190, "audio": 1}, {"filename": "/data/sound/cabin1/cs/k1-v-citis.ogg", "start": 811190, "end": 864333, "audio": 1}, {"filename": "/data/sound/cabin1/cs/k1-v-cit.ogg", "start": 864333, "end": 891131, "audio": 1}, {"filename": "/data/sound/cabin1/cs/k1-v-jejeho.ogg", "start": 891131, "end": 908089, "audio": 1}, {"filename": "/data/sound/cabin1/cs/k1-v-kdovi.ogg", "start": 908089, "end": 920368, "audio": 1}, {"filename": "/data/sound/cabin1/cs/k1-v-opatrne.ogg", "start": 920368, "end": 939000, "audio": 1}, {"filename": "/data/sound/cabin1/cs/k1-v-patrila.ogg", "start": 939000, "end": 959889, "audio": 1}, {"filename": "/data/sound/cabin1/cs/k1-v-proc.ogg", "start": 959889, "end": 970484, "audio": 1}, {"filename": "/data/sound/cabin1/cs/k1-v-promin.ogg", "start": 970484, "end": 988207, "audio": 1}, {"filename": "/data/sound/cabin1/cs/k1-v-radose.ogg", "start": 988207, "end": 1002303, "audio": 1}, {"filename": "/data/sound/cabin1/en/k1-chob-1.ogg", "start": 1002303, "end": 1014635, "audio": 1}, {"filename": "/data/sound/cabin1/en/k1-chob-2.ogg", "start": 1014635, "end": 1024675, "audio": 1}, {"filename": "/data/sound/cabin1/en/k1-chob-3.ogg", "start": 1024675, "end": 1038569, "audio": 1}, {"filename": "/data/sound/cabin1/en/k1-chob-p.ogg", "start": 1038569, "end": 1048131, "audio": 1}, {"filename": "/data/sound/cabin1/en/k1-x-vrz.ogg", "start": 1048131, "end": 1054010, "audio": 1}, {"filename": "/data/sound/cabin1/nl/k1-m-chobotnice.ogg", "start": 1054010, "end": 1083070, "audio": 1}, {"filename": "/data/sound/cabin1/nl/k1-m-codelas.ogg", "start": 1083070, "end": 1099672, "audio": 1}, {"filename": "/data/sound/cabin1/nl/k1-m-copak.ogg", "start": 1099672, "end": 1118482, "audio": 1}, {"filename": "/data/sound/cabin1/nl/k1-m-diky.ogg", "start": 1118482, "end": 1133419, "audio": 1}, {"filename": "/data/sound/cabin1/nl/k1-m-fuj.ogg", "start": 1133419, "end": 1148305, "audio": 1}, {"filename": "/data/sound/cabin1/nl/k1-m-kolebku.ogg", "start": 1148305, "end": 1165241, "audio": 1}, {"filename": "/data/sound/cabin1/nl/k1-m-lebku.ogg", "start": 1165241, "end": 1189255, "audio": 1}, {"filename": "/data/sound/cabin1/nl/k1-m-mysli.ogg", "start": 1189255, "end": 1205546, "audio": 1}, {"filename": "/data/sound/cabin1/nl/k1-m-myslis.ogg", "start": 1205546, "end": 1234277, "audio": 1}, {"filename": "/data/sound/cabin1/nl/k1-m-podivin.ogg", "start": 1234277, "end": 1255527, "audio": 1}, {"filename": "/data/sound/cabin1/nl/k1-m-tospisona.ogg", "start": 1255527, "end": 1273448, "audio": 1}, {"filename": "/data/sound/cabin1/nl/k1-v-bedna.ogg", "start": 1273448, "end": 1308075, "audio": 1}, {"filename": "/data/sound/cabin1/nl/k1-v-citis.ogg", "start": 1308075, "end": 1364816, "audio": 1}, {"filename": "/data/sound/cabin1/nl/k1-v-cit.ogg", "start": 1364816, "end": 1388506, "audio": 1}, {"filename": "/data/sound/cabin1/nl/k1-v-jejeho.ogg", "start": 1388506, "end": 1414906, "audio": 1}, {"filename": "/data/sound/cabin1/nl/k1-v-kdovi.ogg", "start": 1414906, "end": 1432329, "audio": 1}, {"filename": "/data/sound/cabin1/nl/k1-v-opatrne.ogg", "start": 1432329, "end": 1455607, "audio": 1}, {"filename": "/data/sound/cabin1/nl/k1-v-patrila.ogg", "start": 1455607, "end": 1480310, "audio": 1}, {"filename": "/data/sound/cabin1/nl/k1-v-proc.ogg", "start": 1480310, "end": 1494853, "audio": 1}, {"filename": "/data/sound/cabin1/nl/k1-v-promin.ogg", "start": 1494853, "end": 1521614, "audio": 1}, {"filename": "/data/sound/cabin1/nl/k1-v-radose.ogg", "start": 1521614, "end": 1538473, "audio": 1}], "remote_package_size": 1538473, "package_uuid": "e26079a4-f5f9-48cd-94d4-dd377c1e48c4"});

})();
