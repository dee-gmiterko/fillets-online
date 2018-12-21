
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
    var PACKAGE_NAME = 'web/data/dump.data';
    var REMOTE_PACKAGE_BASE = 'data/dump.data';
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
Module['FS_createPath']('/data/images', 'dump', true, true);
Module['FS_createPath']('/data', 'script', true, true);
Module['FS_createPath']('/data/script', 'dump', true, true);
Module['FS_createPath']('/data', 'sound', true, true);
Module['FS_createPath']('/data/sound', 'dump', true, true);
Module['FS_createPath']('/data/sound/dump', 'cs', true, true);
Module['FS_createPath']('/data/sound/dump', 'en', true, true);
Module['FS_createPath']('/data/sound/dump', 'nl', true, true);

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
              Module['removeRunDependency']('datafile_web/data/dump.data');

    };
    Module['addRunDependency']('datafile_web/data/dump.data');
  
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
 loadPackage({"files": [{"filename": "/data/images/dump/amfora_zelena.png", "start": 0, "end": 926, "audio": 0}, {"filename": "/data/images/dump/balonek_00.png", "start": 926, "end": 1463, "audio": 0}, {"filename": "/data/images/dump/balonek_01.png", "start": 1463, "end": 2000, "audio": 0}, {"filename": "/data/images/dump/balonek_02.png", "start": 2000, "end": 2529, "audio": 0}, {"filename": "/data/images/dump/balonek_03.png", "start": 2529, "end": 3068, "audio": 0}, {"filename": "/data/images/dump/bota.png", "start": 3068, "end": 4262, "audio": 0}, {"filename": "/data/images/dump/budik_00.png", "start": 4262, "end": 4917, "audio": 0}, {"filename": "/data/images/dump/budik_01.png", "start": 4917, "end": 5495, "audio": 0}, {"filename": "/data/images/dump/charon.png", "start": 5495, "end": 11427, "audio": 0}, {"filename": "/data/images/dump/cola.png", "start": 11427, "end": 12588, "audio": 0}, {"filename": "/data/images/dump/flaska.png", "start": 12588, "end": 13603, "audio": 0}, {"filename": "/data/images/dump/harmonika.png", "start": 13603, "end": 19362, "audio": 0}, {"filename": "/data/images/dump/kotva.png", "start": 19362, "end": 21926, "audio": 0}, {"filename": "/data/images/dump/lahev.png", "start": 21926, "end": 23143, "audio": 0}, {"filename": "/data/images/dump/lodnisroub.png", "start": 23143, "end": 25322, "audio": 0}, {"filename": "/data/images/dump/matka_a.png", "start": 25322, "end": 25959, "audio": 0}, {"filename": "/data/images/dump/medusa_00.png", "start": 25959, "end": 27937, "audio": 0}, {"filename": "/data/images/dump/medusa_01.png", "start": 27937, "end": 29933, "audio": 0}, {"filename": "/data/images/dump/medusa_02.png", "start": 29933, "end": 31898, "audio": 0}, {"filename": "/data/images/dump/meduza_00.png", "start": 31898, "end": 33208, "audio": 0}, {"filename": "/data/images/dump/meduza_01.png", "start": 33208, "end": 34533, "audio": 0}, {"filename": "/data/images/dump/meduzaz_00.png", "start": 34533, "end": 35880, "audio": 0}, {"filename": "/data/images/dump/meduzaz_01.png", "start": 35880, "end": 37209, "audio": 0}, {"filename": "/data/images/dump/mnohonozka_00.png", "start": 37209, "end": 42681, "audio": 0}, {"filename": "/data/images/dump/mnohonozka_01.png", "start": 42681, "end": 48210, "audio": 0}, {"filename": "/data/images/dump/musla.png", "start": 48210, "end": 49515, "audio": 0}, {"filename": "/data/images/dump/ostnatec_00.png", "start": 49515, "end": 52014, "audio": 0}, {"filename": "/data/images/dump/ostnatec_01.png", "start": 52014, "end": 54516, "audio": 0}, {"filename": "/data/images/dump/ostnatec_02.png", "start": 54516, "end": 57019, "audio": 0}, {"filename": "/data/images/dump/pohr.png", "start": 57019, "end": 59337, "audio": 0}, {"filename": "/data/images/dump/retez.png", "start": 59337, "end": 61659, "audio": 0}, {"filename": "/data/images/dump/savle.png", "start": 61659, "end": 63165, "audio": 0}, {"filename": "/data/images/dump/sekyrka.png", "start": 63165, "end": 66515, "audio": 0}, {"filename": "/data/images/dump/sklenicka_pr.png", "start": 66515, "end": 66915, "audio": 0}, {"filename": "/data/images/dump/smetak-13-tmp.png", "start": 66915, "end": 69024, "audio": 0}, {"filename": "/data/images/dump/smetak-19-tmp.png", "start": 69024, "end": 69720, "audio": 0}, {"filename": "/data/images/dump/smetak-20-tmp.png", "start": 69720, "end": 70587, "audio": 0}, {"filename": "/data/images/dump/smetak-p.png", "start": 70587, "end": 384938, "audio": 0}, {"filename": "/data/images/dump/smetak-w.png", "start": 384938, "end": 633694, "audio": 0}, {"filename": "/data/images/dump/stozar_v_l.png", "start": 633694, "end": 636009, "audio": 0}, {"filename": "/data/images/dump/stozar_v.png", "start": 636009, "end": 638063, "audio": 0}, {"filename": "/data/images/dump/tenisak.png", "start": 638063, "end": 638782, "audio": 0}, {"filename": "/data/images/dump/uhor_00.png", "start": 638782, "end": 641435, "audio": 0}, {"filename": "/data/images/dump/uhor_01.png", "start": 641435, "end": 644138, "audio": 0}, {"filename": "/data/images/dump/zavora.png", "start": 644138, "end": 647865, "audio": 0}, {"filename": "/data/images/dump/zebrik.png", "start": 647865, "end": 650410, "audio": 0}, {"filename": "/data/images/dump/zralok.png", "start": 650410, "end": 652812, "audio": 0}, {"filename": "/data/script/dump/code.lua", "start": 652812, "end": 661620, "audio": 0}, {"filename": "/data/script/dump/dialogs_bg.lua", "start": 661620, "end": 665560, "audio": 0}, {"filename": "/data/script/dump/dialogs_cs.lua", "start": 665560, "end": 668807, "audio": 0}, {"filename": "/data/script/dump/dialogs_de.lua", "start": 668807, "end": 672191, "audio": 0}, {"filename": "/data/script/dump/dialogs_en.lua", "start": 672191, "end": 674205, "audio": 0}, {"filename": "/data/script/dump/dialogs_es.lua", "start": 674205, "end": 677628, "audio": 0}, {"filename": "/data/script/dump/dialogs_fr.lua", "start": 677628, "end": 681034, "audio": 0}, {"filename": "/data/script/dump/dialogs_it.lua", "start": 681034, "end": 684352, "audio": 0}, {"filename": "/data/script/dump/dialogs.lua", "start": 684352, "end": 684390, "audio": 0}, {"filename": "/data/script/dump/dialogs_nl.lua", "start": 684390, "end": 687719, "audio": 0}, {"filename": "/data/script/dump/dialogs_pl.lua", "start": 687719, "end": 690967, "audio": 0}, {"filename": "/data/script/dump/dialogs_ru.lua", "start": 690967, "end": 694986, "audio": 0}, {"filename": "/data/script/dump/dialogs_sv.lua", "start": 694986, "end": 698337, "audio": 0}, {"filename": "/data/script/dump/init.lua", "start": 698337, "end": 698980, "audio": 0}, {"filename": "/data/script/dump/models.lua", "start": 698980, "end": 705138, "audio": 0}, {"filename": "/data/sound/dump/cs/sm-m-codela.ogg", "start": 705138, "end": 720527, "audio": 1}, {"filename": "/data/sound/dump/cs/sm-m-dedek.ogg", "start": 720527, "end": 734098, "audio": 1}, {"filename": "/data/sound/dump/cs/sm-m-kramy0.ogg", "start": 734098, "end": 748044, "audio": 1}, {"filename": "/data/sound/dump/cs/sm-m-kramy1.ogg", "start": 748044, "end": 765963, "audio": 1}, {"filename": "/data/sound/dump/cs/sm-m-namaloval.ogg", "start": 765963, "end": 777386, "audio": 1}, {"filename": "/data/sound/dump/cs/sm-m-normalni.ogg", "start": 777386, "end": 791014, "audio": 1}, {"filename": "/data/sound/dump/cs/sm-m-proc.ogg", "start": 791014, "end": 800480, "audio": 1}, {"filename": "/data/sound/dump/cs/sm-m-prolezame.ogg", "start": 800480, "end": 822526, "audio": 1}, {"filename": "/data/sound/dump/cs/sm-v-budik.ogg", "start": 822526, "end": 850447, "audio": 1}, {"filename": "/data/sound/dump/cs/sm-v-charon.ogg", "start": 850447, "end": 873756, "audio": 1}, {"filename": "/data/sound/dump/cs/sm-v-duchodce0.ogg", "start": 873756, "end": 890582, "audio": 1}, {"filename": "/data/sound/dump/cs/sm-v-duchodce1.ogg", "start": 890582, "end": 916279, "audio": 1}, {"filename": "/data/sound/dump/cs/sm-v-jine0.ogg", "start": 916279, "end": 933205, "audio": 1}, {"filename": "/data/sound/dump/cs/sm-v-jine1.ogg", "start": 933205, "end": 955898, "audio": 1}, {"filename": "/data/sound/dump/cs/sm-v-jine2.ogg", "start": 955898, "end": 978937, "audio": 1}, {"filename": "/data/sound/dump/cs/sm-v-kramy2.ogg", "start": 978937, "end": 999128, "audio": 1}, {"filename": "/data/sound/dump/cs/sm-v-kramy3.ogg", "start": 999128, "end": 1012605, "audio": 1}, {"filename": "/data/sound/dump/cs/sm-v-lod.ogg", "start": 1012605, "end": 1024356, "audio": 1}, {"filename": "/data/sound/dump/cs/sm-v-marnost.ogg", "start": 1024356, "end": 1045006, "audio": 1}, {"filename": "/data/sound/dump/cs/sm-v-podivej.ogg", "start": 1045006, "end": 1095099, "audio": 1}, {"filename": "/data/sound/dump/cs/sm-v-sbirka.ogg", "start": 1095099, "end": 1150621, "audio": 1}, {"filename": "/data/sound/dump/cs/sm-x-meduza.ogg", "start": 1150621, "end": 1179982, "audio": 1}, {"filename": "/data/sound/dump/en/sm-x-tiktak.ogg", "start": 1179982, "end": 1187751, "audio": 1}, {"filename": "/data/sound/dump/nl/sm-m-codela.ogg", "start": 1187751, "end": 1208356, "audio": 1}, {"filename": "/data/sound/dump/nl/sm-m-dedek.ogg", "start": 1208356, "end": 1228164, "audio": 1}, {"filename": "/data/sound/dump/nl/sm-m-kramy0.ogg", "start": 1228164, "end": 1247018, "audio": 1}, {"filename": "/data/sound/dump/nl/sm-m-kramy1.ogg", "start": 1247018, "end": 1269232, "audio": 1}, {"filename": "/data/sound/dump/nl/sm-m-namaloval.ogg", "start": 1269232, "end": 1285143, "audio": 1}, {"filename": "/data/sound/dump/nl/sm-m-normalni.ogg", "start": 1285143, "end": 1302194, "audio": 1}, {"filename": "/data/sound/dump/nl/sm-m-proc.ogg", "start": 1302194, "end": 1316258, "audio": 1}, {"filename": "/data/sound/dump/nl/sm-m-prolezame.ogg", "start": 1316258, "end": 1342155, "audio": 1}, {"filename": "/data/sound/dump/nl/sm-v-budik.ogg", "start": 1342155, "end": 1372950, "audio": 1}, {"filename": "/data/sound/dump/nl/sm-v-charon.ogg", "start": 1372950, "end": 1396072, "audio": 1}, {"filename": "/data/sound/dump/nl/sm-v-duchodce0.ogg", "start": 1396072, "end": 1418035, "audio": 1}, {"filename": "/data/sound/dump/nl/sm-v-duchodce1.ogg", "start": 1418035, "end": 1454843, "audio": 1}, {"filename": "/data/sound/dump/nl/sm-v-jine0.ogg", "start": 1454843, "end": 1481050, "audio": 1}, {"filename": "/data/sound/dump/nl/sm-v-jine1.ogg", "start": 1481050, "end": 1503677, "audio": 1}, {"filename": "/data/sound/dump/nl/sm-v-jine2.ogg", "start": 1503677, "end": 1529567, "audio": 1}, {"filename": "/data/sound/dump/nl/sm-v-kramy2.ogg", "start": 1529567, "end": 1549452, "audio": 1}, {"filename": "/data/sound/dump/nl/sm-v-kramy3.ogg", "start": 1549452, "end": 1570481, "audio": 1}, {"filename": "/data/sound/dump/nl/sm-v-lod.ogg", "start": 1570481, "end": 1587763, "audio": 1}, {"filename": "/data/sound/dump/nl/sm-v-marnost.ogg", "start": 1587763, "end": 1614226, "audio": 1}, {"filename": "/data/sound/dump/nl/sm-v-podivej.ogg", "start": 1614226, "end": 1662919, "audio": 1}, {"filename": "/data/sound/dump/nl/sm-v-sbirka.ogg", "start": 1662919, "end": 1716035, "audio": 1}], "remote_package_size": 1716035, "package_uuid": "e5d51031-712e-4a51-8ca7-3f1f0f565916"});

})();
