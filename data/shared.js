
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
    var PACKAGE_NAME = 'web/data/shared.data';
    var REMOTE_PACKAGE_BASE = 'data/shared.data';
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
Module['FS_createPath']('/data', 'font', true, true);
Module['FS_createPath']('/data', 'images', true, true);
Module['FS_createPath']('/data/images', 'menu', true, true);
Module['FS_createPath']('/data/images/menu', 'flags', true, true);
Module['FS_createPath']('/data/images/menu', 'status', true, true);
Module['FS_createPath']('/data/images/menu', 'subtitles', true, true);
Module['FS_createPath']('/data', 'music', true, true);
Module['FS_createPath']('/data', 'script', true, true);
Module['FS_createPath']('/data/script', 'share', true, true);
Module['FS_createPath']('/data', 'sound', true, true);
Module['FS_createPath']('/data/sound', 'share', true, true);
Module['FS_createPath']('/data/sound/share', 'blackjokes', true, true);
Module['FS_createPath']('/data/sound/share/blackjokes', 'cs', true, true);
Module['FS_createPath']('/data/sound/share/blackjokes', 'nl', true, true);
Module['FS_createPath']('/data/sound/share', 'border', true, true);
Module['FS_createPath']('/data/sound/share/border', 'cs', true, true);
Module['FS_createPath']('/data/sound/share/border', 'nl', true, true);
Module['FS_createPath']('/data/sound/share', 'borejokes', true, true);
Module['FS_createPath']('/data/sound/share/borejokes', 'cs', true, true);
Module['FS_createPath']('/data/sound/share/borejokes', 'nl', true, true);

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
              Module['removeRunDependency']('datafile_web/data/shared.data');

    };
    Module['addRunDependency']('datafile_web/data/shared.data');
  
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
 loadPackage({"files": [{"filename": "/data/font/copyright", "start": 0, "end": 942, "audio": 0}, {"filename": "/data/font/font_console.ttf", "start": 942, "end": 65170, "audio": 0}, {"filename": "/data/font/font_menu.ttf", "start": 65170, "end": 129398, "audio": 0}, {"filename": "/data/font/font_subtitle.ttf", "start": 129398, "end": 193626, "audio": 0}, {"filename": "/data/images/menu/back.png", "start": 193626, "end": 194778, "audio": 0}, {"filename": "/data/images/menu/credits.png", "start": 194778, "end": 449975, "audio": 0}, {"filename": "/data/images/menu/flags/bg.png", "start": 449975, "end": 450118, "audio": 0}, {"filename": "/data/images/menu/flags/copyright", "start": 450118, "end": 450297, "audio": 0}, {"filename": "/data/images/menu/flags/cs.png", "start": 450297, "end": 450594, "audio": 0}, {"filename": "/data/images/menu/flags/de_ch.png", "start": 450594, "end": 450740, "audio": 0}, {"filename": "/data/images/menu/flags/de.png", "start": 450740, "end": 450883, "audio": 0}, {"filename": "/data/images/menu/flags/en.png", "start": 450883, "end": 451407, "audio": 0}, {"filename": "/data/images/menu/flags/eo.png", "start": 451407, "end": 451620, "audio": 0}, {"filename": "/data/images/menu/flags/es.png", "start": 451620, "end": 452003, "audio": 0}, {"filename": "/data/images/menu/flags/fr.png", "start": 452003, "end": 452116, "audio": 0}, {"filename": "/data/images/menu/flags/it.png", "start": 452116, "end": 452214, "audio": 0}, {"filename": "/data/images/menu/flags/nl.png", "start": 452214, "end": 452341, "audio": 0}, {"filename": "/data/images/menu/flags/pl.png", "start": 452341, "end": 452454, "audio": 0}, {"filename": "/data/images/menu/flags/pt_br.png", "start": 452454, "end": 453156, "audio": 0}, {"filename": "/data/images/menu/flags/ru.png", "start": 453156, "end": 453284, "audio": 0}, {"filename": "/data/images/menu/flags/sl.png", "start": 453284, "end": 453591, "audio": 0}, {"filename": "/data/images/menu/flags/sv.png", "start": 453591, "end": 453871, "audio": 0}, {"filename": "/data/images/menu/intro.mpg", "start": 453871, "end": 13102319, "audio": 0}, {"filename": "/data/images/menu/intro.png", "start": 13102319, "end": 13229865, "audio": 0}, {"filename": "/data/images/menu/lang.png", "start": 13229865, "end": 13230398, "audio": 0}, {"filename": "/data/images/menu/map__de.png", "start": 13230398, "end": 13447879, "audio": 0}, {"filename": "/data/images/menu/map_lower__de.png", "start": 13447879, "end": 13674640, "audio": 0}, {"filename": "/data/images/menu/map_lower.png", "start": 13674640, "end": 13847798, "audio": 0}, {"filename": "/data/images/menu/map_lower__ru.png", "start": 13847798, "end": 14017391, "audio": 0}, {"filename": "/data/images/menu/map_mask.png", "start": 14017391, "end": 14018783, "audio": 0}, {"filename": "/data/images/menu/map.png", "start": 14018783, "end": 14184057, "audio": 0}, {"filename": "/data/images/menu/map__ru.png", "start": 14184057, "end": 14345694, "audio": 0}, {"filename": "/data/images/menu/n0.png", "start": 14345694, "end": 14347074, "audio": 0}, {"filename": "/data/images/menu/n1.png", "start": 14347074, "end": 14348372, "audio": 0}, {"filename": "/data/images/menu/n2.png", "start": 14348372, "end": 14349705, "audio": 0}, {"filename": "/data/images/menu/n3.png", "start": 14349705, "end": 14351057, "audio": 0}, {"filename": "/data/images/menu/n4.png", "start": 14351057, "end": 14352432, "audio": 0}, {"filename": "/data/images/menu/n_far.png", "start": 14352432, "end": 14353245, "audio": 0}, {"filename": "/data/images/menu/numbers.png", "start": 14353245, "end": 14354768, "audio": 0}, {"filename": "/data/images/menu/pedometer_lower.png", "start": 14354768, "end": 14383616, "audio": 0}, {"filename": "/data/images/menu/pedometer_mask.png", "start": 14383616, "end": 14384794, "audio": 0}, {"filename": "/data/images/menu/pedometer.png", "start": 14384794, "end": 14413576, "audio": 0}, {"filename": "/data/images/menu/speech.png", "start": 14413576, "end": 14414673, "audio": 0}, {"filename": "/data/images/menu/status/saved.png", "start": 14414673, "end": 14415964, "audio": 0}, {"filename": "/data/images/menu/subtitle.png", "start": 14415964, "end": 14417089, "audio": 0}, {"filename": "/data/images/menu/subtitles/no.png", "start": 14417089, "end": 14417630, "audio": 0}, {"filename": "/data/images/menu/subtitles/yes.png", "start": 14417630, "end": 14417956, "audio": 0}, {"filename": "/data/images/menu/volume_music.png", "start": 14417956, "end": 14419683, "audio": 0}, {"filename": "/data/images/menu/volume_sound.png", "start": 14419683, "end": 14423361, "audio": 0}, {"filename": "/data/music/menu.ogg", "start": 14423361, "end": 14642923, "audio": 1}, {"filename": "/data/music/menu.ogg.meta", "start": 14642923, "end": 14642937, "audio": 0}, {"filename": "/data/script/share/black_dialogs_bg.lua", "start": 14642937, "end": 14646904, "audio": 0}, {"filename": "/data/script/share/black_dialogs_cs.lua", "start": 14646904, "end": 14650295, "audio": 0}, {"filename": "/data/script/share/black_dialogs_de_CH.lua", "start": 14650295, "end": 14650366, "audio": 0}, {"filename": "/data/script/share/black_dialogs_de.lua", "start": 14650366, "end": 14653878, "audio": 0}, {"filename": "/data/script/share/black_dialogs_en.lua", "start": 14653878, "end": 14655935, "audio": 0}, {"filename": "/data/script/share/black_dialogs_es.lua", "start": 14655935, "end": 14659438, "audio": 0}, {"filename": "/data/script/share/black_dialogs_fr.lua", "start": 14659438, "end": 14662936, "audio": 0}, {"filename": "/data/script/share/black_dialogs_it.lua", "start": 14662936, "end": 14666250, "audio": 0}, {"filename": "/data/script/share/black_dialogs_nl.lua", "start": 14666250, "end": 14669759, "audio": 0}, {"filename": "/data/script/share/black_dialogs_pl.lua", "start": 14669759, "end": 14673228, "audio": 0}, {"filename": "/data/script/share/black_dialogs_ru.lua", "start": 14673228, "end": 14677336, "audio": 0}, {"filename": "/data/script/share/black_dialogs_sv.lua", "start": 14677336, "end": 14680820, "audio": 0}, {"filename": "/data/script/share/blackjokes.lua", "start": 14680820, "end": 14689413, "audio": 0}, {"filename": "/data/script/share/border_dialogs_bg.lua", "start": 14689413, "end": 14690857, "audio": 0}, {"filename": "/data/script/share/border_dialogs_cs.lua", "start": 14690857, "end": 14692013, "audio": 0}, {"filename": "/data/script/share/border_dialogs_de.lua", "start": 14692013, "end": 14693259, "audio": 0}, {"filename": "/data/script/share/border_dialogs_en.lua", "start": 14693259, "end": 14693961, "audio": 0}, {"filename": "/data/script/share/border_dialogs_es.lua", "start": 14693961, "end": 14695169, "audio": 0}, {"filename": "/data/script/share/border_dialogs_fr.lua", "start": 14695169, "end": 14696390, "audio": 0}, {"filename": "/data/script/share/border_dialogs_it.lua", "start": 14696390, "end": 14697607, "audio": 0}, {"filename": "/data/script/share/border_dialogs_nl.lua", "start": 14697607, "end": 14698825, "audio": 0}, {"filename": "/data/script/share/border_dialogs_pl.lua", "start": 14698825, "end": 14699987, "audio": 0}, {"filename": "/data/script/share/border_dialogs_ru.lua", "start": 14699987, "end": 14701472, "audio": 0}, {"filename": "/data/script/share/border_dialogs_sv.lua", "start": 14701472, "end": 14702673, "audio": 0}, {"filename": "/data/script/share/bordershout.lua", "start": 14702673, "end": 14703938, "audio": 0}, {"filename": "/data/script/share/bore_dialogs_bg.lua", "start": 14703938, "end": 14711919, "audio": 0}, {"filename": "/data/script/share/bore_dialogs_cs.lua", "start": 14711919, "end": 14718743, "audio": 0}, {"filename": "/data/script/share/bore_dialogs_de_CH.lua", "start": 14718743, "end": 14719054, "audio": 0}, {"filename": "/data/script/share/bore_dialogs_de.lua", "start": 14719054, "end": 14726025, "audio": 0}, {"filename": "/data/script/share/bore_dialogs_en.lua", "start": 14726025, "end": 14730252, "audio": 0}, {"filename": "/data/script/share/bore_dialogs_es.lua", "start": 14730252, "end": 14737397, "audio": 0}, {"filename": "/data/script/share/bore_dialogs_fr.lua", "start": 14737397, "end": 14744555, "audio": 0}, {"filename": "/data/script/share/bore_dialogs_it.lua", "start": 14744555, "end": 14751404, "audio": 0}, {"filename": "/data/script/share/bore_dialogs_nl.lua", "start": 14751404, "end": 14758419, "audio": 0}, {"filename": "/data/script/share/bore_dialogs_pl.lua", "start": 14758419, "end": 14765259, "audio": 0}, {"filename": "/data/script/share/bore_dialogs_ru.lua", "start": 14765259, "end": 14773590, "audio": 0}, {"filename": "/data/script/share/bore_dialogs_sv.lua", "start": 14773590, "end": 14780591, "audio": 0}, {"filename": "/data/script/share/borejokes.lua", "start": 14780591, "end": 14788476, "audio": 0}, {"filename": "/data/script/share/bubles.lua", "start": 14788476, "end": 14789016, "audio": 0}, {"filename": "/data/script/share/demo_intro.lua", "start": 14789016, "end": 14789265, "audio": 0}, {"filename": "/data/script/share/intro_dialogs_bg.lua", "start": 14789265, "end": 14789448, "audio": 0}, {"filename": "/data/script/share/intro_dialogs_cs.lua", "start": 14789448, "end": 14789603, "audio": 0}, {"filename": "/data/script/share/intro_dialogs_de.lua", "start": 14789603, "end": 14789776, "audio": 0}, {"filename": "/data/script/share/intro_dialogs_en.lua", "start": 14789776, "end": 14789873, "audio": 0}, {"filename": "/data/script/share/intro_dialogs_es.lua", "start": 14789873, "end": 14790040, "audio": 0}, {"filename": "/data/script/share/intro_dialogs_fr.lua", "start": 14790040, "end": 14790220, "audio": 0}, {"filename": "/data/script/share/intro_dialogs_it.lua", "start": 14790220, "end": 14790383, "audio": 0}, {"filename": "/data/script/share/intro_dialogs_nl.lua", "start": 14790383, "end": 14790562, "audio": 0}, {"filename": "/data/script/share/intro_dialogs_pl.lua", "start": 14790562, "end": 14790723, "audio": 0}, {"filename": "/data/script/share/intro_dialogs_ru.lua", "start": 14790723, "end": 14790911, "audio": 0}, {"filename": "/data/script/share/intro_dialogs_sl.lua", "start": 14790911, "end": 14791082, "audio": 0}, {"filename": "/data/script/share/intro_dialogs_sv.lua", "start": 14791082, "end": 14791248, "audio": 0}, {"filename": "/data/script/share/level_creation.lua", "start": 14791248, "end": 14798918, "audio": 0}, {"filename": "/data/script/share/level_dialog.lua", "start": 14798918, "end": 14802525, "audio": 0}, {"filename": "/data/script/share/level_fonts.lua", "start": 14802525, "end": 14804173, "audio": 0}, {"filename": "/data/script/share/level_plan.lua", "start": 14804173, "end": 14807190, "audio": 0}, {"filename": "/data/script/share/level_start.lua", "start": 14807190, "end": 14809687, "audio": 0}, {"filename": "/data/script/share/level_update.lua", "start": 14809687, "end": 14812056, "audio": 0}, {"filename": "/data/script/share/Pickle.lua", "start": 14812056, "end": 14814651, "audio": 0}, {"filename": "/data/script/share/prog_border.lua", "start": 14814651, "end": 14816868, "audio": 0}, {"filename": "/data/script/share/prog_compatible.lua", "start": 14816868, "end": 14820334, "audio": 0}, {"filename": "/data/script/share/prog_demo.lua", "start": 14820334, "end": 14820951, "audio": 0}, {"filename": "/data/script/share/prog_finder.lua", "start": 14820951, "end": 14823848, "audio": 0}, {"filename": "/data/script/share/prog_goanim.lua", "start": 14823848, "end": 14827333, "audio": 0}, {"filename": "/data/script/share/prog_save.lua", "start": 14827333, "end": 14832374, "audio": 0}, {"filename": "/data/script/share/shout_dialogs_bg.lua", "start": 14832374, "end": 14833185, "audio": 0}, {"filename": "/data/script/share/shout_dialogs_cs.lua", "start": 14833185, "end": 14833959, "audio": 0}, {"filename": "/data/script/share/shout_dialogs_de.lua", "start": 14833959, "end": 14834734, "audio": 0}, {"filename": "/data/script/share/shout_dialogs_en.lua", "start": 14834734, "end": 14835286, "audio": 0}, {"filename": "/data/script/share/shout_dialogs_fr.lua", "start": 14835286, "end": 14836079, "audio": 0}, {"filename": "/data/script/share/shout_dialogs_nl.lua", "start": 14836079, "end": 14836850, "audio": 0}, {"filename": "/data/script/share/shout_dialogs_ru.lua", "start": 14836850, "end": 14837758, "audio": 0}, {"filename": "/data/script/share/shout_dialogs_sv.lua", "start": 14837758, "end": 14838529, "audio": 0}, {"filename": "/data/script/share/shout_dialogs_tr.lua", "start": 14838529, "end": 14839309, "audio": 0}, {"filename": "/data/script/share/stddialogs.lua", "start": 14839309, "end": 14839604, "audio": 0}, {"filename": "/data/sound/share/blackjokes/cs/smrt-m-0.ogg", "start": 14839604, "end": 14853949, "audio": 1}, {"filename": "/data/sound/share/blackjokes/cs/smrt-m-1.ogg", "start": 14853949, "end": 14868294, "audio": 1}, {"filename": "/data/sound/share/blackjokes/cs/smrt-m-2.ogg", "start": 14868294, "end": 14880995, "audio": 1}, {"filename": "/data/sound/share/blackjokes/cs/smrt-m-3.ogg", "start": 14880995, "end": 14896135, "audio": 1}, {"filename": "/data/sound/share/blackjokes/cs/smrt-m-4.ogg", "start": 14896135, "end": 14920550, "audio": 1}, {"filename": "/data/sound/share/blackjokes/cs/smrt-m-5.ogg", "start": 14920550, "end": 14931243, "audio": 1}, {"filename": "/data/sound/share/blackjokes/cs/smrt-m-6.ogg", "start": 14931243, "end": 14955244, "audio": 1}, {"filename": "/data/sound/share/blackjokes/cs/smrt-m-autorest.ogg", "start": 14955244, "end": 14991039, "audio": 1}, {"filename": "/data/sound/share/blackjokes/cs/smrt-m-obe.ogg", "start": 14991039, "end": 15011501, "audio": 1}, {"filename": "/data/sound/share/blackjokes/cs/smrt-m-posmrtny.ogg", "start": 15011501, "end": 15040230, "audio": 1}, {"filename": "/data/sound/share/blackjokes/cs/smrt-m-psst.ogg", "start": 15040230, "end": 15059195, "audio": 1}, {"filename": "/data/sound/share/blackjokes/cs/smrt-m-restart.ogg", "start": 15059195, "end": 15078130, "audio": 1}, {"filename": "/data/sound/share/blackjokes/cs/smrt-m-zahrobi.ogg", "start": 15078130, "end": 15125972, "audio": 1}, {"filename": "/data/sound/share/blackjokes/cs/smrt-v-0.ogg", "start": 15125972, "end": 15140254, "audio": 1}, {"filename": "/data/sound/share/blackjokes/cs/smrt-v-1.ogg", "start": 15140254, "end": 15154585, "audio": 1}, {"filename": "/data/sound/share/blackjokes/cs/smrt-v-2.ogg", "start": 15154585, "end": 15164388, "audio": 1}, {"filename": "/data/sound/share/blackjokes/cs/smrt-v-3.ogg", "start": 15164388, "end": 15175254, "audio": 1}, {"filename": "/data/sound/share/blackjokes/cs/smrt-v-4.ogg", "start": 15175254, "end": 15192992, "audio": 1}, {"filename": "/data/sound/share/blackjokes/cs/smrt-v-5.ogg", "start": 15192992, "end": 15212795, "audio": 1}, {"filename": "/data/sound/share/blackjokes/cs/smrt-v-6.ogg", "start": 15212795, "end": 15230620, "audio": 1}, {"filename": "/data/sound/share/blackjokes/cs/smrt-v-7.ogg", "start": 15230620, "end": 15252771, "audio": 1}, {"filename": "/data/sound/share/blackjokes/cs/smrt-v-autorest.ogg", "start": 15252771, "end": 15295472, "audio": 1}, {"filename": "/data/sound/share/blackjokes/cs/smrt-v-obe.ogg", "start": 15295472, "end": 15312035, "audio": 1}, {"filename": "/data/sound/share/blackjokes/cs/smrt-v-posmrtny.ogg", "start": 15312035, "end": 15353994, "audio": 1}, {"filename": "/data/sound/share/blackjokes/cs/smrt-v-restart.ogg", "start": 15353994, "end": 15374249, "audio": 1}, {"filename": "/data/sound/share/blackjokes/cs/smrt-v-zahrobi.ogg", "start": 15374249, "end": 15411386, "audio": 1}, {"filename": "/data/sound/share/blackjokes/cs/smrt-x-obe.ogg", "start": 15411386, "end": 15424535, "audio": 1}, {"filename": "/data/sound/share/blackjokes/nl/smrt-m-0.ogg", "start": 15424535, "end": 15441231, "audio": 1}, {"filename": "/data/sound/share/blackjokes/nl/smrt-m-1.ogg", "start": 15441231, "end": 15457598, "audio": 1}, {"filename": "/data/sound/share/blackjokes/nl/smrt-m-2.ogg", "start": 15457598, "end": 15474263, "audio": 1}, {"filename": "/data/sound/share/blackjokes/nl/smrt-m-3.ogg", "start": 15474263, "end": 15494527, "audio": 1}, {"filename": "/data/sound/share/blackjokes/nl/smrt-m-4.ogg", "start": 15494527, "end": 15515176, "audio": 1}, {"filename": "/data/sound/share/blackjokes/nl/smrt-m-5.ogg", "start": 15515176, "end": 15532968, "audio": 1}, {"filename": "/data/sound/share/blackjokes/nl/smrt-m-6.ogg", "start": 15532968, "end": 15554376, "audio": 1}, {"filename": "/data/sound/share/blackjokes/nl/smrt-m-autorest.ogg", "start": 15554376, "end": 15589228, "audio": 1}, {"filename": "/data/sound/share/blackjokes/nl/smrt-m-obe.ogg", "start": 15589228, "end": 15606633, "audio": 1}, {"filename": "/data/sound/share/blackjokes/nl/smrt-m-posmrtny.ogg", "start": 15606633, "end": 15626971, "audio": 1}, {"filename": "/data/sound/share/blackjokes/nl/smrt-m-psst.ogg", "start": 15626971, "end": 15650981, "audio": 1}, {"filename": "/data/sound/share/blackjokes/nl/smrt-m-restart.ogg", "start": 15650981, "end": 15671112, "audio": 1}, {"filename": "/data/sound/share/blackjokes/nl/smrt-m-zahrobi.ogg", "start": 15671112, "end": 15696692, "audio": 1}, {"filename": "/data/sound/share/blackjokes/nl/smrt-v-0.ogg", "start": 15696692, "end": 15712406, "audio": 1}, {"filename": "/data/sound/share/blackjokes/nl/smrt-v-1.ogg", "start": 15712406, "end": 15728383, "audio": 1}, {"filename": "/data/sound/share/blackjokes/nl/smrt-v-2.ogg", "start": 15728383, "end": 15742407, "audio": 1}, {"filename": "/data/sound/share/blackjokes/nl/smrt-v-3.ogg", "start": 15742407, "end": 15755953, "audio": 1}, {"filename": "/data/sound/share/blackjokes/nl/smrt-v-4.ogg", "start": 15755953, "end": 15777316, "audio": 1}, {"filename": "/data/sound/share/blackjokes/nl/smrt-v-5.ogg", "start": 15777316, "end": 15803640, "audio": 1}, {"filename": "/data/sound/share/blackjokes/nl/smrt-v-6.ogg", "start": 15803640, "end": 15828961, "audio": 1}, {"filename": "/data/sound/share/blackjokes/nl/smrt-v-7.ogg", "start": 15828961, "end": 15851965, "audio": 1}, {"filename": "/data/sound/share/blackjokes/nl/smrt-v-autorest.ogg", "start": 15851965, "end": 15901122, "audio": 1}, {"filename": "/data/sound/share/blackjokes/nl/smrt-v-obe.ogg", "start": 15901122, "end": 15921731, "audio": 1}, {"filename": "/data/sound/share/blackjokes/nl/smrt-v-posmrtny.ogg", "start": 15921731, "end": 15949492, "audio": 1}, {"filename": "/data/sound/share/blackjokes/nl/smrt-v-restart.ogg", "start": 15949492, "end": 15970480, "audio": 1}, {"filename": "/data/sound/share/blackjokes/nl/smrt-v-zahrobi.ogg", "start": 15970480, "end": 15996843, "audio": 1}, {"filename": "/data/sound/share/border/cs/cil-m-hlaska0.ogg", "start": 15996843, "end": 16015168, "audio": 1}, {"filename": "/data/sound/share/border/cs/cil-m-hlaska1.ogg", "start": 16015168, "end": 16032723, "audio": 1}, {"filename": "/data/sound/share/border/cs/cil-m-hlaska2.ogg", "start": 16032723, "end": 16055956, "audio": 1}, {"filename": "/data/sound/share/border/cs/cil-m-hlaska3.ogg", "start": 16055956, "end": 16072854, "audio": 1}, {"filename": "/data/sound/share/border/cs/cil-v-hlaska0.ogg", "start": 16072854, "end": 16090319, "audio": 1}, {"filename": "/data/sound/share/border/cs/cil-v-hlaska1.ogg", "start": 16090319, "end": 16109150, "audio": 1}, {"filename": "/data/sound/share/border/cs/cil-v-hlaska2.ogg", "start": 16109150, "end": 16133429, "audio": 1}, {"filename": "/data/sound/share/border/cs/cil-v-hlaska3.ogg", "start": 16133429, "end": 16150786, "audio": 1}, {"filename": "/data/sound/share/border/cs/sp-shout_big_00.ogg", "start": 16150786, "end": 16162220, "audio": 1}, {"filename": "/data/sound/share/border/cs/sp-shout_big_01.ogg", "start": 16162220, "end": 16174938, "audio": 1}, {"filename": "/data/sound/share/border/cs/sp-shout_big_02.ogg", "start": 16174938, "end": 16188101, "audio": 1}, {"filename": "/data/sound/share/border/cs/sp-shout_big_03.ogg", "start": 16188101, "end": 16200713, "audio": 1}, {"filename": "/data/sound/share/border/cs/sp-shout_big_04.ogg", "start": 16200713, "end": 16222981, "audio": 1}, {"filename": "/data/sound/share/border/cs/sp-shout_small_00.ogg", "start": 16222981, "end": 16236114, "audio": 1}, {"filename": "/data/sound/share/border/cs/sp-shout_small_01.ogg", "start": 16236114, "end": 16249483, "audio": 1}, {"filename": "/data/sound/share/border/cs/sp-shout_small_02.ogg", "start": 16249483, "end": 16261886, "audio": 1}, {"filename": "/data/sound/share/border/cs/sp-shout_small_03.ogg", "start": 16261886, "end": 16274017, "audio": 1}, {"filename": "/data/sound/share/border/cs/sp-shout_small_04.ogg", "start": 16274017, "end": 16287298, "audio": 1}, {"filename": "/data/sound/share/border/nl/cil-m-hlaska0.ogg", "start": 16287298, "end": 16304948, "audio": 1}, {"filename": "/data/sound/share/border/nl/cil-m-hlaska1.ogg", "start": 16304948, "end": 16325782, "audio": 1}, {"filename": "/data/sound/share/border/nl/cil-m-hlaska2.ogg", "start": 16325782, "end": 16352783, "audio": 1}, {"filename": "/data/sound/share/border/nl/cil-m-hlaska3.ogg", "start": 16352783, "end": 16375976, "audio": 1}, {"filename": "/data/sound/share/border/nl/cil-v-hlaska0.ogg", "start": 16375976, "end": 16393745, "audio": 1}, {"filename": "/data/sound/share/border/nl/cil-v-hlaska1.ogg", "start": 16393745, "end": 16415927, "audio": 1}, {"filename": "/data/sound/share/border/nl/cil-v-hlaska2.ogg", "start": 16415927, "end": 16444057, "audio": 1}, {"filename": "/data/sound/share/border/nl/cil-v-hlaska3.ogg", "start": 16444057, "end": 16467634, "audio": 1}, {"filename": "/data/sound/share/borejokes/cs/ob-m-ach.ogg", "start": 16467634, "end": 16479624, "audio": 1}, {"filename": "/data/sound/share/borejokes/cs/ob-m-ceka.ogg", "start": 16479624, "end": 16502309, "audio": 1}, {"filename": "/data/sound/share/borejokes/cs/ob-m-co.ogg", "start": 16502309, "end": 16511306, "audio": 1}, {"filename": "/data/sound/share/borejokes/cs/ob-m-hlavu.ogg", "start": 16511306, "end": 16524701, "audio": 1}, {"filename": "/data/sound/share/borejokes/cs/ob-m-jakdlouho.ogg", "start": 16524701, "end": 16541605, "audio": 1}, {"filename": "/data/sound/share/borejokes/cs/ob-m-jesteneco.ogg", "start": 16541605, "end": 16555788, "audio": 1}, {"filename": "/data/sound/share/borejokes/cs/ob-m-jetam.ogg", "start": 16555788, "end": 16569793, "audio": 1}, {"filename": "/data/sound/share/borejokes/cs/ob-m-kdo.ogg", "start": 16569793, "end": 16581222, "audio": 1}, {"filename": "/data/sound/share/borejokes/cs/ob-m-klid.ogg", "start": 16581222, "end": 16592207, "audio": 1}, {"filename": "/data/sound/share/borejokes/cs/ob-m-lito.ogg", "start": 16592207, "end": 16608865, "audio": 1}, {"filename": "/data/sound/share/borejokes/cs/ob-m-mysleli.ogg", "start": 16608865, "end": 16632106, "audio": 1}, {"filename": "/data/sound/share/borejokes/cs/ob-m-naveky.ogg", "start": 16632106, "end": 16647206, "audio": 1}, {"filename": "/data/sound/share/borejokes/cs/ob-m-nedeje.ogg", "start": 16647206, "end": 16659523, "audio": 1}, {"filename": "/data/sound/share/borejokes/cs/ob-m-nedosataneme.ogg", "start": 16659523, "end": 16677588, "audio": 1}, {"filename": "/data/sound/share/borejokes/cs/ob-m-neverim.ogg", "start": 16677588, "end": 16692324, "audio": 1}, {"filename": "/data/sound/share/borejokes/cs/ob-m-pokracuj.ogg", "start": 16692324, "end": 16702302, "audio": 1}, {"filename": "/data/sound/share/borejokes/cs/ob-m-pravdepodobne.ogg", "start": 16702302, "end": 16716993, "audio": 1}, {"filename": "/data/sound/share/borejokes/cs/ob-m-proc.ogg", "start": 16716993, "end": 16730471, "audio": 1}, {"filename": "/data/sound/share/borejokes/cs/ob-m-pst.ogg", "start": 16730471, "end": 16751997, "audio": 1}, {"filename": "/data/sound/share/borejokes/cs/ob-m-resit.ogg", "start": 16751997, "end": 16773048, "audio": 1}, {"filename": "/data/sound/share/borejokes/cs/ob-m-strach.ogg", "start": 16773048, "end": 16816518, "audio": 1}, {"filename": "/data/sound/share/borejokes/cs/ob-m-teorie.ogg", "start": 16816518, "end": 16837631, "audio": 1}, {"filename": "/data/sound/share/borejokes/cs/ob-m-tezky.ogg", "start": 16837631, "end": 16849555, "audio": 1}, {"filename": "/data/sound/share/borejokes/cs/ob-m-uplnevse.ogg", "start": 16849555, "end": 16870566, "audio": 1}, {"filename": "/data/sound/share/borejokes/cs/ob-m-vsechno.ogg", "start": 16870566, "end": 16887779, "audio": 1}, {"filename": "/data/sound/share/borejokes/cs/ob-m-zase.ogg", "start": 16887779, "end": 16899599, "audio": 1}, {"filename": "/data/sound/share/borejokes/cs/ob-m-zvykacka.ogg", "start": 16899599, "end": 16935283, "audio": 1}, {"filename": "/data/sound/share/borejokes/cs/ob-o-halo.ogg", "start": 16935283, "end": 16949209, "audio": 1}, {"filename": "/data/sound/share/borejokes/cs/ob-o-nebavi.ogg", "start": 16949209, "end": 16969747, "audio": 1}, {"filename": "/data/sound/share/borejokes/cs/ob-v-akvarium.ogg", "start": 16969747, "end": 16987432, "audio": 1}, {"filename": "/data/sound/share/borejokes/cs/ob-v-alenic.ogg", "start": 16987432, "end": 17009678, "audio": 1}, {"filename": "/data/sound/share/borejokes/cs/ob-v-colito.ogg", "start": 17009678, "end": 17023708, "audio": 1}, {"filename": "/data/sound/share/borejokes/cs/ob-v-copak.ogg", "start": 17023708, "end": 17033413, "audio": 1}, {"filename": "/data/sound/share/borejokes/cs/ob-v-covsechno.ogg", "start": 17033413, "end": 17043759, "audio": 1}, {"filename": "/data/sound/share/borejokes/cs/ob-v-halo.ogg", "start": 17043759, "end": 17074288, "audio": 1}, {"filename": "/data/sound/share/borejokes/cs/ob-v-hrej.ogg", "start": 17074288, "end": 17097985, "audio": 1}, {"filename": "/data/sound/share/borejokes/cs/ob-v-jidlo.ogg", "start": 17097985, "end": 17145612, "audio": 1}, {"filename": "/data/sound/share/borejokes/cs/ob-v-jit0.ogg", "start": 17145612, "end": 17158338, "audio": 1}, {"filename": "/data/sound/share/borejokes/cs/ob-v-jit1.ogg", "start": 17158338, "end": 17174958, "audio": 1}, {"filename": "/data/sound/share/borejokes/cs/ob-v-kdoresi.ogg", "start": 17174958, "end": 17203514, "audio": 1}, {"filename": "/data/sound/share/borejokes/cs/ob-v-klid.ogg", "start": 17203514, "end": 17214038, "audio": 1}, {"filename": "/data/sound/share/borejokes/cs/ob-v-leskne.ogg", "start": 17214038, "end": 17240150, "audio": 1}, {"filename": "/data/sound/share/borejokes/cs/ob-v-mamto.ogg", "start": 17240150, "end": 17263954, "audio": 1}, {"filename": "/data/sound/share/borejokes/cs/ob-v-musi.ogg", "start": 17263954, "end": 17290188, "audio": 1}, {"filename": "/data/sound/share/borejokes/cs/ob-v-napad.ogg", "start": 17290188, "end": 17313145, "audio": 1}, {"filename": "/data/sound/share/borejokes/cs/ob-v-nebavi.ogg", "start": 17313145, "end": 17325851, "audio": 1}, {"filename": "/data/sound/share/borejokes/cs/ob-v-nehybes.ogg", "start": 17325851, "end": 17344746, "audio": 1}, {"filename": "/data/sound/share/borejokes/cs/ob-v-nelekl.ogg", "start": 17344746, "end": 17357125, "audio": 1}, {"filename": "/data/sound/share/borejokes/cs/ob-v-neobvykle.ogg", "start": 17357125, "end": 17373107, "audio": 1}, {"filename": "/data/sound/share/borejokes/cs/ob-v-nerus.ogg", "start": 17373107, "end": 17392067, "audio": 1}, {"filename": "/data/sound/share/borejokes/cs/ob-v-ostani.ogg", "start": 17392067, "end": 17409756, "audio": 1}, {"filename": "/data/sound/share/borejokes/cs/ob-v-prestavka.ogg", "start": 17409756, "end": 17426017, "audio": 1}, {"filename": "/data/sound/share/borejokes/cs/ob-v-sami.ogg", "start": 17426017, "end": 17454187, "audio": 1}, {"filename": "/data/sound/share/borejokes/cs/ob-v-vyzkousej.ogg", "start": 17454187, "end": 17471342, "audio": 1}, {"filename": "/data/sound/share/borejokes/cs/ob-v-zvykacka.ogg", "start": 17471342, "end": 17493408, "audio": 1}, {"filename": "/data/sound/share/borejokes/nl/ob-m-ach.ogg", "start": 17493408, "end": 17507282, "audio": 1}, {"filename": "/data/sound/share/borejokes/nl/ob-m-ceka.ogg", "start": 17507282, "end": 17528659, "audio": 1}, {"filename": "/data/sound/share/borejokes/nl/ob-m-co.ogg", "start": 17528659, "end": 17541760, "audio": 1}, {"filename": "/data/sound/share/borejokes/nl/ob-m-hlavu.ogg", "start": 17541760, "end": 17557024, "audio": 1}, {"filename": "/data/sound/share/borejokes/nl/ob-m-jakdlouho.ogg", "start": 17557024, "end": 17576125, "audio": 1}, {"filename": "/data/sound/share/borejokes/nl/ob-m-jesteneco.ogg", "start": 17576125, "end": 17591312, "audio": 1}, {"filename": "/data/sound/share/borejokes/nl/ob-m-jetam.ogg", "start": 17591312, "end": 17610233, "audio": 1}, {"filename": "/data/sound/share/borejokes/nl/ob-m-kdo.ogg", "start": 17610233, "end": 17624118, "audio": 1}, {"filename": "/data/sound/share/borejokes/nl/ob-m-klid.ogg", "start": 17624118, "end": 17640292, "audio": 1}, {"filename": "/data/sound/share/borejokes/nl/ob-m-lito.ogg", "start": 17640292, "end": 17656803, "audio": 1}, {"filename": "/data/sound/share/borejokes/nl/ob-m-mysleli.ogg", "start": 17656803, "end": 17682364, "audio": 1}, {"filename": "/data/sound/share/borejokes/nl/ob-m-naveky.ogg", "start": 17682364, "end": 17708260, "audio": 1}, {"filename": "/data/sound/share/borejokes/nl/ob-m-nedeje.ogg", "start": 17708260, "end": 17723853, "audio": 1}, {"filename": "/data/sound/share/borejokes/nl/ob-m-nedosataneme.ogg", "start": 17723853, "end": 17740677, "audio": 1}, {"filename": "/data/sound/share/borejokes/nl/ob-m-neverim.ogg", "start": 17740677, "end": 17759802, "audio": 1}, {"filename": "/data/sound/share/borejokes/nl/ob-m-pokracuj.ogg", "start": 17759802, "end": 17774797, "audio": 1}, {"filename": "/data/sound/share/borejokes/nl/ob-m-pravdepodobne.ogg", "start": 17774797, "end": 17789870, "audio": 1}, {"filename": "/data/sound/share/borejokes/nl/ob-m-proc.ogg", "start": 17789870, "end": 17806828, "audio": 1}, {"filename": "/data/sound/share/borejokes/nl/ob-m-pst.ogg", "start": 17806828, "end": 17840320, "audio": 1}, {"filename": "/data/sound/share/borejokes/nl/ob-m-resit.ogg", "start": 17840320, "end": 17865777, "audio": 1}, {"filename": "/data/sound/share/borejokes/nl/ob-m-strach.ogg", "start": 17865777, "end": 17900349, "audio": 1}, {"filename": "/data/sound/share/borejokes/nl/ob-m-teorie.ogg", "start": 17900349, "end": 17922827, "audio": 1}, {"filename": "/data/sound/share/borejokes/nl/ob-m-tezky.ogg", "start": 17922827, "end": 17936711, "audio": 1}, {"filename": "/data/sound/share/borejokes/nl/ob-m-uplnevse.ogg", "start": 17936711, "end": 17960830, "audio": 1}, {"filename": "/data/sound/share/borejokes/nl/ob-m-vsechno.ogg", "start": 17960830, "end": 17973778, "audio": 1}, {"filename": "/data/sound/share/borejokes/nl/ob-m-zase.ogg", "start": 17973778, "end": 17987240, "audio": 1}, {"filename": "/data/sound/share/borejokes/nl/ob-m-zvykacka.ogg", "start": 17987240, "end": 18009919, "audio": 1}, {"filename": "/data/sound/share/borejokes/nl/ob-v-akvarium.ogg", "start": 18009919, "end": 18031630, "audio": 1}, {"filename": "/data/sound/share/borejokes/nl/ob-v-alenic.ogg", "start": 18031630, "end": 18053337, "audio": 1}, {"filename": "/data/sound/share/borejokes/nl/ob-v-colito.ogg", "start": 18053337, "end": 18067335, "audio": 1}, {"filename": "/data/sound/share/borejokes/nl/ob-v-copak.ogg", "start": 18067335, "end": 18082911, "audio": 1}, {"filename": "/data/sound/share/borejokes/nl/ob-v-covsechno.ogg", "start": 18082911, "end": 18098072, "audio": 1}, {"filename": "/data/sound/share/borejokes/nl/ob-v-halo.ogg", "start": 18098072, "end": 18127327, "audio": 1}, {"filename": "/data/sound/share/borejokes/nl/ob-v-hrej.ogg", "start": 18127327, "end": 18147390, "audio": 1}, {"filename": "/data/sound/share/borejokes/nl/ob-v-jidlo.ogg", "start": 18147390, "end": 18189841, "audio": 1}, {"filename": "/data/sound/share/borejokes/nl/ob-v-jit0.ogg", "start": 18189841, "end": 18212016, "audio": 1}, {"filename": "/data/sound/share/borejokes/nl/ob-v-jit1.ogg", "start": 18212016, "end": 18239395, "audio": 1}, {"filename": "/data/sound/share/borejokes/nl/ob-v-kdoresi.ogg", "start": 18239395, "end": 18279929, "audio": 1}, {"filename": "/data/sound/share/borejokes/nl/ob-v-klid.ogg", "start": 18279929, "end": 18297836, "audio": 1}, {"filename": "/data/sound/share/borejokes/nl/ob-v-leskne.ogg", "start": 18297836, "end": 18328684, "audio": 1}, {"filename": "/data/sound/share/borejokes/nl/ob-v-mamto.ogg", "start": 18328684, "end": 18354049, "audio": 1}, {"filename": "/data/sound/share/borejokes/nl/ob-v-musi.ogg", "start": 18354049, "end": 18378464, "audio": 1}, {"filename": "/data/sound/share/borejokes/nl/ob-v-napad.ogg", "start": 18378464, "end": 18399846, "audio": 1}, {"filename": "/data/sound/share/borejokes/nl/ob-v-nebavi.ogg", "start": 18399846, "end": 18417058, "audio": 1}, {"filename": "/data/sound/share/borejokes/nl/ob-v-nehybes.ogg", "start": 18417058, "end": 18440580, "audio": 1}, {"filename": "/data/sound/share/borejokes/nl/ob-v-nelekl.ogg", "start": 18440580, "end": 18456981, "audio": 1}, {"filename": "/data/sound/share/borejokes/nl/ob-v-neobvykle.ogg", "start": 18456981, "end": 18475414, "audio": 1}, {"filename": "/data/sound/share/borejokes/nl/ob-v-nerus.ogg", "start": 18475414, "end": 18500959, "audio": 1}, {"filename": "/data/sound/share/borejokes/nl/ob-v-ostani.ogg", "start": 18500959, "end": 18521819, "audio": 1}, {"filename": "/data/sound/share/borejokes/nl/ob-v-prestavka.ogg", "start": 18521819, "end": 18540654, "audio": 1}, {"filename": "/data/sound/share/borejokes/nl/ob-v-sami.ogg", "start": 18540654, "end": 18567487, "audio": 1}, {"filename": "/data/sound/share/borejokes/nl/ob-v-vyzkousej.ogg", "start": 18567487, "end": 18586117, "audio": 1}, {"filename": "/data/sound/share/borejokes/nl/ob-v-zvykacka.ogg", "start": 18586117, "end": 18610572, "audio": 1}, {"filename": "/data/sound/share/sp-bubles_00.ogg", "start": 18610572, "end": 18622611, "audio": 1}, {"filename": "/data/sound/share/sp-bubles_01.ogg", "start": 18622611, "end": 18635922, "audio": 1}, {"filename": "/data/sound/share/sp-bubles_02.ogg", "start": 18635922, "end": 18652326, "audio": 1}, {"filename": "/data/sound/share/sp-bubles_03.ogg", "start": 18652326, "end": 18660106, "audio": 1}, {"filename": "/data/sound/share/sp-bubles_04.ogg", "start": 18660106, "end": 18678348, "audio": 1}, {"filename": "/data/sound/share/sp-bubles_05.ogg", "start": 18678348, "end": 18689118, "audio": 1}, {"filename": "/data/sound/share/sp-dead_big.ogg", "start": 18689118, "end": 18694473, "audio": 1}, {"filename": "/data/sound/share/sp-dead_small.ogg", "start": 18694473, "end": 18700034, "audio": 1}, {"filename": "/data/sound/share/sp-impact_heavy_00.ogg", "start": 18700034, "end": 18707783, "audio": 1}, {"filename": "/data/sound/share/sp-impact_heavy_01.ogg", "start": 18707783, "end": 18714943, "audio": 1}, {"filename": "/data/sound/share/sp-impact_light_00.ogg", "start": 18714943, "end": 18721762, "audio": 1}, {"filename": "/data/sound/share/sp-impact_light_01.ogg", "start": 18721762, "end": 18728375, "audio": 1}, {"filename": "/data/script/select_lang.lua", "start": 18728375, "end": 18729334, "audio": 0}, {"filename": "/data/script/worldfame.lua", "start": 18729334, "end": 18733382, "audio": 0}, {"filename": "/data/script/labels.lua", "start": 18733382, "end": 18746378, "audio": 0}, {"filename": "/data/script/select_speech.lua", "start": 18746378, "end": 18746530, "audio": 0}, {"filename": "/data/script/worldmap.lua", "start": 18746530, "end": 18753318, "audio": 0}, {"filename": "/data/script/level_funcs.lua", "start": 18753318, "end": 18753688, "audio": 0}, {"filename": "/data/script/worlddesc.lua", "start": 18753688, "end": 18829663, "audio": 0}, {"filename": "/data/images/icon.png", "start": 18829663, "end": 18829924, "audio": 0}, {"filename": "/data/script/init.lua", "start": 18829924, "end": 18835505, "audio": 0}], "remote_package_size": 18835505, "package_uuid": "1b0ed234-876b-4346-a3ca-eaf3b6245b66"});

})();
