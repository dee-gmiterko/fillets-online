
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
    var PACKAGE_NAME = 'web/data/chest.data';
    var REMOTE_PACKAGE_BASE = 'data/chest.data';
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
Module['FS_createPath']('/data/images', 'chest', true, true);
Module['FS_createPath']('/data', 'script', true, true);
Module['FS_createPath']('/data/script', 'chest', true, true);
Module['FS_createPath']('/data', 'sound', true, true);
Module['FS_createPath']('/data/sound', 'chest', true, true);
Module['FS_createPath']('/data/sound/chest', 'cs', true, true);
Module['FS_createPath']('/data/sound/chest', 'nl', true, true);

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
              Module['removeRunDependency']('datafile_web/data/chest.data');

    };
    Module['addRunDependency']('datafile_web/data/chest.data');
  
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
 loadPackage({"files": [{"filename": "/data/images/chest/12-ocel.png", "start": 0, "end": 2840, "audio": 0}, {"filename": "/data/images/chest/2-ocel.png", "start": 2840, "end": 4684, "audio": 0}, {"filename": "/data/images/chest/gral.png", "start": 4684, "end": 11173, "audio": 0}, {"filename": "/data/images/chest/koruna_00.png", "start": 11173, "end": 13231, "audio": 0}, {"filename": "/data/images/chest/koruna_01.png", "start": 13231, "end": 15292, "audio": 0}, {"filename": "/data/images/chest/koruna_02.png", "start": 15292, "end": 17348, "audio": 0}, {"filename": "/data/images/chest/koruna_03.png", "start": 17348, "end": 19391, "audio": 0}, {"filename": "/data/images/chest/koruna_04.png", "start": 19391, "end": 21458, "audio": 0}, {"filename": "/data/images/chest/koruna_05.png", "start": 21458, "end": 23528, "audio": 0}, {"filename": "/data/images/chest/korunka1.png", "start": 23528, "end": 28246, "audio": 0}, {"filename": "/data/images/chest/korunka.png", "start": 28246, "end": 32973, "audio": 0}, {"filename": "/data/images/chest/krystal-c_00.png", "start": 32973, "end": 33597, "audio": 0}, {"filename": "/data/images/chest/krystal-c_01.png", "start": 33597, "end": 34221, "audio": 0}, {"filename": "/data/images/chest/krystal-c_02.png", "start": 34221, "end": 34826, "audio": 0}, {"filename": "/data/images/chest/krystal-c_03.png", "start": 34826, "end": 35418, "audio": 0}, {"filename": "/data/images/chest/krystal-d_00.png", "start": 35418, "end": 36056, "audio": 0}, {"filename": "/data/images/chest/krystal-d_01.png", "start": 36056, "end": 36693, "audio": 0}, {"filename": "/data/images/chest/krystal-d_02.png", "start": 36693, "end": 37311, "audio": 0}, {"filename": "/data/images/chest/krystal-d_03.png", "start": 37311, "end": 37912, "audio": 0}, {"filename": "/data/images/chest/krystal-m_00.png", "start": 37912, "end": 38578, "audio": 0}, {"filename": "/data/images/chest/krystal-m_01.png", "start": 38578, "end": 39247, "audio": 0}, {"filename": "/data/images/chest/krystal-m_02.png", "start": 39247, "end": 39923, "audio": 0}, {"filename": "/data/images/chest/krystal-m_03.png", "start": 39923, "end": 40534, "audio": 0}, {"filename": "/data/images/chest/krystal-o_00.png", "start": 40534, "end": 41146, "audio": 0}, {"filename": "/data/images/chest/krystal-o_01.png", "start": 41146, "end": 41752, "audio": 0}, {"filename": "/data/images/chest/krystal-o_02.png", "start": 41752, "end": 42348, "audio": 0}, {"filename": "/data/images/chest/krystal-o_03.png", "start": 42348, "end": 42924, "audio": 0}, {"filename": "/data/images/chest/krystal-t_00.png", "start": 42924, "end": 43539, "audio": 0}, {"filename": "/data/images/chest/krystal-t_01.png", "start": 43539, "end": 44138, "audio": 0}, {"filename": "/data/images/chest/krystal-t_02.png", "start": 44138, "end": 44710, "audio": 0}, {"filename": "/data/images/chest/krystal-t_03.png", "start": 44710, "end": 45249, "audio": 0}, {"filename": "/data/images/chest/krystal-y_00.png", "start": 45249, "end": 45888, "audio": 0}, {"filename": "/data/images/chest/krystal-y_01.png", "start": 45888, "end": 46526, "audio": 0}, {"filename": "/data/images/chest/krystal-y_02.png", "start": 46526, "end": 47152, "audio": 0}, {"filename": "/data/images/chest/krystal-y_03.png", "start": 47152, "end": 47761, "audio": 0}, {"filename": "/data/images/chest/krystal-z_00.png", "start": 47761, "end": 48429, "audio": 0}, {"filename": "/data/images/chest/krystal-z_01.png", "start": 48429, "end": 49095, "audio": 0}, {"filename": "/data/images/chest/krystal-z_02.png", "start": 49095, "end": 49752, "audio": 0}, {"filename": "/data/images/chest/krystal-z_03.png", "start": 49752, "end": 50375, "audio": 0}, {"filename": "/data/images/chest/mince-1.png", "start": 50375, "end": 51604, "audio": 0}, {"filename": "/data/images/chest/prsten-2_00.png", "start": 51604, "end": 52913, "audio": 0}, {"filename": "/data/images/chest/prsten-2_01.png", "start": 52913, "end": 54203, "audio": 0}, {"filename": "/data/images/chest/prsten-2_02.png", "start": 54203, "end": 55465, "audio": 0}, {"filename": "/data/images/chest/prsten-2_03.png", "start": 55465, "end": 56776, "audio": 0}, {"filename": "/data/images/chest/prsten-2_04.png", "start": 56776, "end": 58070, "audio": 0}, {"filename": "/data/images/chest/prsten-2_05.png", "start": 58070, "end": 59352, "audio": 0}, {"filename": "/data/images/chest/stolek2.png", "start": 59352, "end": 65170, "audio": 0}, {"filename": "/data/images/chest/truhla2.png", "start": 65170, "end": 141487, "audio": 0}, {"filename": "/data/images/chest/truhla-p.png", "start": 141487, "end": 385051, "audio": 0}, {"filename": "/data/images/chest/truhla-w.png", "start": 385051, "end": 564801, "audio": 0}, {"filename": "/data/images/chest/vazavh.png", "start": 564801, "end": 565988, "audio": 0}, {"filename": "/data/script/chest/code.lua", "start": 565988, "end": 576541, "audio": 0}, {"filename": "/data/script/chest/dialogs_bg.lua", "start": 576541, "end": 580340, "audio": 0}, {"filename": "/data/script/chest/dialogs_cs.lua", "start": 580340, "end": 583571, "audio": 0}, {"filename": "/data/script/chest/dialogs_de_CH.lua", "start": 583571, "end": 583712, "audio": 0}, {"filename": "/data/script/chest/dialogs_de.lua", "start": 583712, "end": 587034, "audio": 0}, {"filename": "/data/script/chest/dialogs_en.lua", "start": 587034, "end": 588959, "audio": 0}, {"filename": "/data/script/chest/dialogs_es.lua", "start": 588959, "end": 592260, "audio": 0}, {"filename": "/data/script/chest/dialogs_fr.lua", "start": 592260, "end": 595628, "audio": 0}, {"filename": "/data/script/chest/dialogs_it.lua", "start": 595628, "end": 598887, "audio": 0}, {"filename": "/data/script/chest/dialogs.lua", "start": 598887, "end": 598925, "audio": 0}, {"filename": "/data/script/chest/dialogs_nl.lua", "start": 598925, "end": 602264, "audio": 0}, {"filename": "/data/script/chest/dialogs_pl.lua", "start": 602264, "end": 605504, "audio": 0}, {"filename": "/data/script/chest/dialogs_ru.lua", "start": 605504, "end": 609497, "audio": 0}, {"filename": "/data/script/chest/dialogs_sv.lua", "start": 609497, "end": 612696, "audio": 0}, {"filename": "/data/script/chest/init.lua", "start": 612696, "end": 613340, "audio": 0}, {"filename": "/data/script/chest/models.lua", "start": 613340, "end": 618538, "audio": 0}, {"filename": "/data/sound/chest/cs/tru-m-co.ogg", "start": 618538, "end": 628571, "audio": 1}, {"filename": "/data/sound/chest/cs/tru-m-nejistota.ogg", "start": 628571, "end": 655287, "audio": 1}, {"filename": "/data/sound/chest/cs/tru-m-oznamit.ogg", "start": 655287, "end": 694342, "audio": 1}, {"filename": "/data/sound/chest/cs/tru-m-trpyt.ogg", "start": 694342, "end": 724763, "audio": 1}, {"filename": "/data/sound/chest/cs/tru-m-truhla0.ogg", "start": 724763, "end": 743702, "audio": 1}, {"filename": "/data/sound/chest/cs/tru-m-truhla1.ogg", "start": 743702, "end": 761326, "audio": 1}, {"filename": "/data/sound/chest/cs/tru-m-vzit0.ogg", "start": 761326, "end": 777510, "audio": 1}, {"filename": "/data/sound/chest/cs/tru-m-vzit1.ogg", "start": 777510, "end": 796618, "audio": 1}, {"filename": "/data/sound/chest/cs/tru-m-vzit2.ogg", "start": 796618, "end": 821031, "audio": 1}, {"filename": "/data/sound/chest/cs/tru-m-zpochybnit.ogg", "start": 821031, "end": 848900, "audio": 1}, {"filename": "/data/sound/chest/cs/tru-m-zrada.ogg", "start": 848900, "end": 868543, "audio": 1}, {"filename": "/data/sound/chest/cs/tru-v-gral.ogg", "start": 868543, "end": 885734, "audio": 1}, {"filename": "/data/sound/chest/cs/tru-v-nasly.ogg", "start": 885734, "end": 905793, "audio": 1}, {"filename": "/data/sound/chest/cs/tru-v-nejspis.ogg", "start": 905793, "end": 931305, "audio": 1}, {"filename": "/data/sound/chest/cs/tru-v-poklad.ogg", "start": 931305, "end": 954087, "audio": 1}, {"filename": "/data/sound/chest/cs/tru-v-stacit.ogg", "start": 954087, "end": 978653, "audio": 1}, {"filename": "/data/sound/chest/cs/tru-v-truhla0.ogg", "start": 978653, "end": 999178, "audio": 1}, {"filename": "/data/sound/chest/cs/tru-v-truhla1.ogg", "start": 999178, "end": 1014628, "audio": 1}, {"filename": "/data/sound/chest/cs/tru-v-vkupe.ogg", "start": 1014628, "end": 1040303, "audio": 1}, {"filename": "/data/sound/chest/cs/tru-v-vzit0.ogg", "start": 1040303, "end": 1063089, "audio": 1}, {"filename": "/data/sound/chest/cs/tru-v-vzit1.ogg", "start": 1063089, "end": 1079963, "audio": 1}, {"filename": "/data/sound/chest/cs/tru-v-vzit2.ogg", "start": 1079963, "end": 1096696, "audio": 1}, {"filename": "/data/sound/chest/cs/tru-v-zrak.ogg", "start": 1096696, "end": 1117371, "audio": 1}, {"filename": "/data/sound/chest/nl/tru-m-co.ogg", "start": 1117371, "end": 1130383, "audio": 1}, {"filename": "/data/sound/chest/nl/tru-m-nejistota.ogg", "start": 1130383, "end": 1151224, "audio": 1}, {"filename": "/data/sound/chest/nl/tru-m-oznamit.ogg", "start": 1151224, "end": 1180295, "audio": 1}, {"filename": "/data/sound/chest/nl/tru-m-trpyt.ogg", "start": 1180295, "end": 1203181, "audio": 1}, {"filename": "/data/sound/chest/nl/tru-m-truhla0.ogg", "start": 1203181, "end": 1221599, "audio": 1}, {"filename": "/data/sound/chest/nl/tru-m-truhla1.ogg", "start": 1221599, "end": 1243141, "audio": 1}, {"filename": "/data/sound/chest/nl/tru-m-vzit0.ogg", "start": 1243141, "end": 1259410, "audio": 1}, {"filename": "/data/sound/chest/nl/tru-m-vzit1.ogg", "start": 1259410, "end": 1280945, "audio": 1}, {"filename": "/data/sound/chest/nl/tru-m-vzit2.ogg", "start": 1280945, "end": 1309758, "audio": 1}, {"filename": "/data/sound/chest/nl/tru-m-zpochybnit.ogg", "start": 1309758, "end": 1332781, "audio": 1}, {"filename": "/data/sound/chest/nl/tru-m-zrada.ogg", "start": 1332781, "end": 1354734, "audio": 1}, {"filename": "/data/sound/chest/nl/tru-v-gral.ogg", "start": 1354734, "end": 1375840, "audio": 1}, {"filename": "/data/sound/chest/nl/tru-v-nasly.ogg", "start": 1375840, "end": 1396520, "audio": 1}, {"filename": "/data/sound/chest/nl/tru-v-nejspis.ogg", "start": 1396520, "end": 1427602, "audio": 1}, {"filename": "/data/sound/chest/nl/tru-v-poklad.ogg", "start": 1427602, "end": 1452259, "audio": 1}, {"filename": "/data/sound/chest/nl/tru-v-stacit.ogg", "start": 1452259, "end": 1483029, "audio": 1}, {"filename": "/data/sound/chest/nl/tru-v-truhla0.ogg", "start": 1483029, "end": 1508504, "audio": 1}, {"filename": "/data/sound/chest/nl/tru-v-truhla1.ogg", "start": 1508504, "end": 1531829, "audio": 1}, {"filename": "/data/sound/chest/nl/tru-v-vkupe.ogg", "start": 1531829, "end": 1560026, "audio": 1}, {"filename": "/data/sound/chest/nl/tru-v-vzit0.ogg", "start": 1560026, "end": 1587012, "audio": 1}, {"filename": "/data/sound/chest/nl/tru-v-vzit1.ogg", "start": 1587012, "end": 1606500, "audio": 1}, {"filename": "/data/sound/chest/nl/tru-v-vzit2.ogg", "start": 1606500, "end": 1634023, "audio": 1}, {"filename": "/data/sound/chest/nl/tru-v-zrak.ogg", "start": 1634023, "end": 1657775, "audio": 1}], "remote_package_size": 1657775, "package_uuid": "1ace973c-2e0c-470d-992d-a2b407a83aa0"});

})();
