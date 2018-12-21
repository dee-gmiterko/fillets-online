
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
    var PACKAGE_NAME = 'web/data/stairs.data';
    var REMOTE_PACKAGE_BASE = 'data/stairs.data';
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
Module['FS_createPath']('/data/images', 'stairs', true, true);
Module['FS_createPath']('/data', 'script', true, true);
Module['FS_createPath']('/data/script', 'stairs', true, true);
Module['FS_createPath']('/data', 'sound', true, true);
Module['FS_createPath']('/data/sound', 'stairs', true, true);
Module['FS_createPath']('/data/sound/stairs', 'cs', true, true);
Module['FS_createPath']('/data/sound/stairs', 'nl', true, true);

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
              Module['removeRunDependency']('datafile_web/data/stairs.data');

    };
    Module['addRunDependency']('datafile_web/data/stairs.data');
  
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
 loadPackage({"files": [{"filename": "/data/images/stairs/lebeda.png", "start": 0, "end": 1729, "audio": 0}, {"filename": "/data/images/stairs/plz_00.png", "start": 1729, "end": 3609, "audio": 0}, {"filename": "/data/images/stairs/plz_01.png", "start": 3609, "end": 5484, "audio": 0}, {"filename": "/data/images/stairs/plz_02.png", "start": 5484, "end": 7314, "audio": 0}, {"filename": "/data/images/stairs/plz_03.png", "start": 7314, "end": 9148, "audio": 0}, {"filename": "/data/images/stairs/plz_04.png", "start": 9148, "end": 10983, "audio": 0}, {"filename": "/data/images/stairs/plz_05.png", "start": 10983, "end": 12822, "audio": 0}, {"filename": "/data/images/stairs/plz_06.png", "start": 12822, "end": 14712, "audio": 0}, {"filename": "/data/images/stairs/schody-p.png", "start": 14712, "end": 412802, "audio": 0}, {"filename": "/data/images/stairs/schody-w.png", "start": 412802, "end": 756754, "audio": 0}, {"filename": "/data/images/stairs/snek_00.png", "start": 756754, "end": 757525, "audio": 0}, {"filename": "/data/images/stairs/snek_01.png", "start": 757525, "end": 758297, "audio": 0}, {"filename": "/data/images/stairs/snek_02.png", "start": 758297, "end": 759068, "audio": 0}, {"filename": "/data/images/stairs/snek_03.png", "start": 759068, "end": 759839, "audio": 0}, {"filename": "/data/images/stairs/snek_04.png", "start": 759839, "end": 760610, "audio": 0}, {"filename": "/data/images/stairs/snek_05.png", "start": 760610, "end": 761382, "audio": 0}, {"filename": "/data/images/stairs/snek_06.png", "start": 761382, "end": 762153, "audio": 0}, {"filename": "/data/images/stairs/snek_07.png", "start": 762153, "end": 762925, "audio": 0}, {"filename": "/data/images/stairs/snek_08.png", "start": 762925, "end": 763697, "audio": 0}, {"filename": "/data/images/stairs/snek_09.png", "start": 763697, "end": 764469, "audio": 0}, {"filename": "/data/images/stairs/snek_10.png", "start": 764469, "end": 765241, "audio": 0}, {"filename": "/data/images/stairs/snek_11.png", "start": 765241, "end": 766012, "audio": 0}, {"filename": "/data/images/stairs/snek_12.png", "start": 766012, "end": 766784, "audio": 0}, {"filename": "/data/images/stairs/snek_13.png", "start": 766784, "end": 767556, "audio": 0}, {"filename": "/data/images/stairs/snek_14.png", "start": 767556, "end": 768328, "audio": 0}, {"filename": "/data/images/stairs/snek_15.png", "start": 768328, "end": 769100, "audio": 0}, {"filename": "/data/images/stairs/snek_16.png", "start": 769100, "end": 769883, "audio": 0}, {"filename": "/data/images/stairs/snek_17.png", "start": 769883, "end": 770666, "audio": 0}, {"filename": "/data/images/stairs/snek_18.png", "start": 770666, "end": 771449, "audio": 0}, {"filename": "/data/images/stairs/snek_19.png", "start": 771449, "end": 772233, "audio": 0}, {"filename": "/data/images/stairs/snek_20.png", "start": 772233, "end": 773017, "audio": 0}, {"filename": "/data/images/stairs/snek_21.png", "start": 773017, "end": 773801, "audio": 0}, {"filename": "/data/images/stairs/snek_22.png", "start": 773801, "end": 774574, "audio": 0}, {"filename": "/data/images/stairs/snek_23.png", "start": 774574, "end": 775347, "audio": 0}, {"filename": "/data/images/stairs/snek_24.png", "start": 775347, "end": 776119, "audio": 0}, {"filename": "/data/images/stairs/snek_25.png", "start": 776119, "end": 776891, "audio": 0}, {"filename": "/data/images/stairs/snek_26.png", "start": 776891, "end": 777663, "audio": 0}, {"filename": "/data/images/stairs/snek_27.png", "start": 777663, "end": 778436, "audio": 0}, {"filename": "/data/images/stairs/snek_28.png", "start": 778436, "end": 779209, "audio": 0}, {"filename": "/data/images/stairs/snek_29.png", "start": 779209, "end": 779982, "audio": 0}, {"filename": "/data/images/stairs/snek_30.png", "start": 779982, "end": 780754, "audio": 0}, {"filename": "/data/images/stairs/snek_31.png", "start": 780754, "end": 781527, "audio": 0}, {"filename": "/data/images/stairs/snek_32.png", "start": 781527, "end": 782299, "audio": 0}, {"filename": "/data/images/stairs/snek_33.png", "start": 782299, "end": 783071, "audio": 0}, {"filename": "/data/images/stairs/snek_34.png", "start": 783071, "end": 783843, "audio": 0}, {"filename": "/data/images/stairs/snek_35.png", "start": 783843, "end": 784616, "audio": 0}, {"filename": "/data/images/stairs/snek_36.png", "start": 784616, "end": 785389, "audio": 0}, {"filename": "/data/images/stairs/snek_37.png", "start": 785389, "end": 786161, "audio": 0}, {"filename": "/data/images/stairs/snek_38.png", "start": 786161, "end": 786946, "audio": 0}, {"filename": "/data/images/stairs/snek_39.png", "start": 786946, "end": 787730, "audio": 0}, {"filename": "/data/images/stairs/snek_40.png", "start": 787730, "end": 788515, "audio": 0}, {"filename": "/data/images/stairs/snek_41.png", "start": 788515, "end": 789300, "audio": 0}, {"filename": "/data/images/stairs/snek_42.png", "start": 789300, "end": 790084, "audio": 0}, {"filename": "/data/images/stairs/snek_43.png", "start": 790084, "end": 790869, "audio": 0}, {"filename": "/data/images/stairs/stul.png", "start": 790869, "end": 795101, "audio": 0}, {"filename": "/data/images/stairs/zidle_m.png", "start": 795101, "end": 799296, "audio": 0}, {"filename": "/data/images/stairs/zidle_v.png", "start": 799296, "end": 803493, "audio": 0}, {"filename": "/data/script/stairs/code.lua", "start": 803493, "end": 811199, "audio": 0}, {"filename": "/data/script/stairs/dialogs_bg.lua", "start": 811199, "end": 812411, "audio": 0}, {"filename": "/data/script/stairs/dialogs_cs.lua", "start": 812411, "end": 813372, "audio": 0}, {"filename": "/data/script/stairs/dialogs_de_CH.lua", "start": 813372, "end": 813523, "audio": 0}, {"filename": "/data/script/stairs/dialogs_de.lua", "start": 813523, "end": 814614, "audio": 0}, {"filename": "/data/script/stairs/dialogs_en.lua", "start": 814614, "end": 815205, "audio": 0}, {"filename": "/data/script/stairs/dialogs_es.lua", "start": 815205, "end": 816254, "audio": 0}, {"filename": "/data/script/stairs/dialogs_fr.lua", "start": 816254, "end": 817338, "audio": 0}, {"filename": "/data/script/stairs/dialogs_it.lua", "start": 817338, "end": 818369, "audio": 0}, {"filename": "/data/script/stairs/dialogs.lua", "start": 818369, "end": 818407, "audio": 0}, {"filename": "/data/script/stairs/dialogs_nl.lua", "start": 818407, "end": 819466, "audio": 0}, {"filename": "/data/script/stairs/dialogs_pl.lua", "start": 819466, "end": 820433, "audio": 0}, {"filename": "/data/script/stairs/dialogs_ru.lua", "start": 820433, "end": 821536, "audio": 0}, {"filename": "/data/script/stairs/dialogs_sl.lua", "start": 821536, "end": 822547, "audio": 0}, {"filename": "/data/script/stairs/dialogs_sv.lua", "start": 822547, "end": 823594, "audio": 0}, {"filename": "/data/script/stairs/init.lua", "start": 823594, "end": 824239, "audio": 0}, {"filename": "/data/script/stairs/models.lua", "start": 824239, "end": 826685, "audio": 0}, {"filename": "/data/sound/stairs/cs/sch-m-moc0.ogg", "start": 826685, "end": 845432, "audio": 1}, {"filename": "/data/sound/stairs/cs/sch-m-moc1.ogg", "start": 845432, "end": 861581, "audio": 1}, {"filename": "/data/sound/stairs/cs/sch-m-moc2.ogg", "start": 861581, "end": 878169, "audio": 1}, {"filename": "/data/sound/stairs/cs/sch-m-spadlo.ogg", "start": 878169, "end": 893227, "audio": 1}, {"filename": "/data/sound/stairs/cs/sch-v-lastura.ogg", "start": 893227, "end": 921467, "audio": 1}, {"filename": "/data/sound/stairs/cs/sch-v-setkani.ogg", "start": 921467, "end": 971456, "audio": 1}, {"filename": "/data/sound/stairs/nl/sch-m-moc0.ogg", "start": 971456, "end": 992057, "audio": 1}, {"filename": "/data/sound/stairs/nl/sch-m-moc1.ogg", "start": 992057, "end": 1011747, "audio": 1}, {"filename": "/data/sound/stairs/nl/sch-m-moc2.ogg", "start": 1011747, "end": 1030073, "audio": 1}, {"filename": "/data/sound/stairs/nl/sch-m-spadlo.ogg", "start": 1030073, "end": 1050991, "audio": 1}, {"filename": "/data/sound/stairs/nl/sch-v-lastura.ogg", "start": 1050991, "end": 1081137, "audio": 1}, {"filename": "/data/sound/stairs/nl/sch-v-setkani.ogg", "start": 1081137, "end": 1132454, "audio": 1}], "remote_package_size": 1132454, "package_uuid": "2fcd5a9e-0ad0-4a76-abc6-c3e6126e84ae"});

})();
