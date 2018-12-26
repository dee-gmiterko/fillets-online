
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
    var PACKAGE_NAME = 'web/data/ufo.data';
    var REMOTE_PACKAGE_BASE = 'data/ufo.data';
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
Module['FS_createPath']('/data/images', 'ufo', true, true);
Module['FS_createPath']('/data', 'script', true, true);
Module['FS_createPath']('/data/script', 'ufo', true, true);
Module['FS_createPath']('/data', 'sound', true, true);
Module['FS_createPath']('/data/sound', 'ufo', true, true);
Module['FS_createPath']('/data/sound/ufo', 'cs', true, true);
Module['FS_createPath']('/data/sound/ufo', 'nl', true, true);

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
              Module['removeRunDependency']('datafile_web/data/ufo.data');

    };
    Module['addRunDependency']('datafile_web/data/ufo.data');
  
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
 loadPackage({"files": [{"filename": "/data/images/ufo/10-ocel.png", "start": 0, "end": 909, "audio": 0}, {"filename": "/data/images/ufo/11-ocel.png", "start": 909, "end": 1776, "audio": 0}, {"filename": "/data/images/ufo/12-ocel.png", "start": 1776, "end": 5453, "audio": 0}, {"filename": "/data/images/ufo/13-ocel.png", "start": 5453, "end": 7614, "audio": 0}, {"filename": "/data/images/ufo/15-ocel.png", "start": 7614, "end": 10255, "audio": 0}, {"filename": "/data/images/ufo/17-ocel.png", "start": 10255, "end": 11190, "audio": 0}, {"filename": "/data/images/ufo/3-ocel.png", "start": 11190, "end": 13398, "audio": 0}, {"filename": "/data/images/ufo/5-ocel.png", "start": 13398, "end": 14314, "audio": 0}, {"filename": "/data/images/ufo/6-ocel.png", "start": 14314, "end": 15010, "audio": 0}, {"filename": "/data/images/ufo/7-ocel.png", "start": 15010, "end": 16115, "audio": 0}, {"filename": "/data/images/ufo/8-ocel.png", "start": 16115, "end": 17606, "audio": 0}, {"filename": "/data/images/ufo/atikaa.png", "start": 17606, "end": 18986, "audio": 0}, {"filename": "/data/images/ufo/atikac.png", "start": 18986, "end": 20458, "audio": 0}, {"filename": "/data/images/ufo/atikad.png", "start": 20458, "end": 22788, "audio": 0}, {"filename": "/data/images/ufo/hlava_m-_00.png", "start": 22788, "end": 23504, "audio": 0}, {"filename": "/data/images/ufo/hlava_m-_01.png", "start": 23504, "end": 24229, "audio": 0}, {"filename": "/data/images/ufo/hlava_m-_02.png", "start": 24229, "end": 24965, "audio": 0}, {"filename": "/data/images/ufo/ufo-pozadi-1.png", "start": 24965, "end": 331264, "audio": 0}, {"filename": "/data/images/ufo/ufo-prostredi.png", "start": 331264, "end": 741361, "audio": 0}, {"filename": "/data/script/ufo/code.lua", "start": 741361, "end": 744949, "audio": 0}, {"filename": "/data/script/ufo/dialogs_bg.lua", "start": 744949, "end": 748542, "audio": 0}, {"filename": "/data/script/ufo/dialogs_cs.lua", "start": 748542, "end": 751502, "audio": 0}, {"filename": "/data/script/ufo/dialogs_de_CH.lua", "start": 751502, "end": 751886, "audio": 0}, {"filename": "/data/script/ufo/dialogs_de.lua", "start": 751886, "end": 754946, "audio": 0}, {"filename": "/data/script/ufo/dialogs_en.lua", "start": 754946, "end": 756650, "audio": 0}, {"filename": "/data/script/ufo/dialogs_es.lua", "start": 756650, "end": 759698, "audio": 0}, {"filename": "/data/script/ufo/dialogs_fr.lua", "start": 759698, "end": 762807, "audio": 0}, {"filename": "/data/script/ufo/dialogs_it.lua", "start": 762807, "end": 765786, "audio": 0}, {"filename": "/data/script/ufo/dialogs.lua", "start": 765786, "end": 765824, "audio": 0}, {"filename": "/data/script/ufo/dialogs_nl.lua", "start": 765824, "end": 768939, "audio": 0}, {"filename": "/data/script/ufo/dialogs_pl.lua", "start": 768939, "end": 771967, "audio": 0}, {"filename": "/data/script/ufo/dialogs_ru.lua", "start": 771967, "end": 775566, "audio": 0}, {"filename": "/data/script/ufo/dialogs_sl.lua", "start": 775566, "end": 778492, "audio": 0}, {"filename": "/data/script/ufo/dialogs_sv.lua", "start": 778492, "end": 781499, "audio": 0}, {"filename": "/data/script/ufo/init.lua", "start": 781499, "end": 782141, "audio": 0}, {"filename": "/data/script/ufo/models.lua", "start": 782141, "end": 786064, "audio": 0}, {"filename": "/data/sound/ufo/cs/ufo-m-moc.ogg", "start": 786064, "end": 806422, "audio": 1}, {"filename": "/data/sound/ufo/cs/ufo-m-ne.ogg", "start": 806422, "end": 833071, "audio": 1}, {"filename": "/data/sound/ufo/cs/ufo-m-nevim.ogg", "start": 833071, "end": 860112, "audio": 1}, {"filename": "/data/sound/ufo/cs/ufo-m-osmy.ogg", "start": 860112, "end": 885892, "audio": 1}, {"filename": "/data/sound/ufo/cs/ufo-m-tady.ogg", "start": 885892, "end": 910220, "audio": 1}, {"filename": "/data/sound/ufo/cs/ufo-m-tajemstvi.ogg", "start": 910220, "end": 941170, "audio": 1}, {"filename": "/data/sound/ufo/cs/ufo-m-valce.ogg", "start": 941170, "end": 960424, "audio": 1}, {"filename": "/data/sound/ufo/cs/ufo-m-vidim.ogg", "start": 960424, "end": 988975, "audio": 1}, {"filename": "/data/sound/ufo/cs/ufo-m-zvlastni.ogg", "start": 988975, "end": 1029835, "audio": 1}, {"filename": "/data/sound/ufo/cs/ufo-v-dovnitr.ogg", "start": 1029835, "end": 1050146, "audio": 1}, {"filename": "/data/sound/ufo/cs/ufo-v-hur.ogg", "start": 1050146, "end": 1084634, "audio": 1}, {"filename": "/data/sound/ufo/cs/ufo-v-rikam.ogg", "start": 1084634, "end": 1118027, "audio": 1}, {"filename": "/data/sound/ufo/cs/ufo-v-vpredu.ogg", "start": 1118027, "end": 1136078, "audio": 1}, {"filename": "/data/sound/ufo/cs/ufo-v-zjistit0.ogg", "start": 1136078, "end": 1158208, "audio": 1}, {"filename": "/data/sound/ufo/cs/ufo-v-zjistit1.ogg", "start": 1158208, "end": 1184468, "audio": 1}, {"filename": "/data/sound/ufo/cs/ufo-v-znicilo.ogg", "start": 1184468, "end": 1220168, "audio": 1}, {"filename": "/data/sound/ufo/nl/ufo-m-moc.ogg", "start": 1220168, "end": 1240898, "audio": 1}, {"filename": "/data/sound/ufo/nl/ufo-m-ne.ogg", "start": 1240898, "end": 1262270, "audio": 1}, {"filename": "/data/sound/ufo/nl/ufo-m-nevim.ogg", "start": 1262270, "end": 1293536, "audio": 1}, {"filename": "/data/sound/ufo/nl/ufo-m-osmy.ogg", "start": 1293536, "end": 1318671, "audio": 1}, {"filename": "/data/sound/ufo/nl/ufo-m-tady.ogg", "start": 1318671, "end": 1346141, "audio": 1}, {"filename": "/data/sound/ufo/nl/ufo-m-tajemstvi.ogg", "start": 1346141, "end": 1377845, "audio": 1}, {"filename": "/data/sound/ufo/nl/ufo-m-valce.ogg", "start": 1377845, "end": 1400658, "audio": 1}, {"filename": "/data/sound/ufo/nl/ufo-m-vidim.ogg", "start": 1400658, "end": 1427268, "audio": 1}, {"filename": "/data/sound/ufo/nl/ufo-m-zvlastni.ogg", "start": 1427268, "end": 1470633, "audio": 1}, {"filename": "/data/sound/ufo/nl/ufo-v-dovnitr.ogg", "start": 1470633, "end": 1501719, "audio": 1}, {"filename": "/data/sound/ufo/nl/ufo-v-hur.ogg", "start": 1501719, "end": 1537157, "audio": 1}, {"filename": "/data/sound/ufo/nl/ufo-v-rikam.ogg", "start": 1537157, "end": 1568569, "audio": 1}, {"filename": "/data/sound/ufo/nl/ufo-v-vpredu.ogg", "start": 1568569, "end": 1594577, "audio": 1}, {"filename": "/data/sound/ufo/nl/ufo-v-zjistit0.ogg", "start": 1594577, "end": 1623322, "audio": 1}, {"filename": "/data/sound/ufo/nl/ufo-v-zjistit1.ogg", "start": 1623322, "end": 1651929, "audio": 1}, {"filename": "/data/sound/ufo/nl/ufo-v-znicilo.ogg", "start": 1651929, "end": 1693468, "audio": 1}], "remote_package_size": 1693468, "package_uuid": "00666edd-ff7f-4eb2-b3bb-0a96ca6d5d64"});

})();
