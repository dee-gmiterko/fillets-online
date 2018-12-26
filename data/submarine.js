
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
    var PACKAGE_NAME = 'web/data/submarine.data';
    var REMOTE_PACKAGE_BASE = 'data/submarine.data';
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
Module['FS_createPath']('/data/images', 'submarine', true, true);
Module['FS_createPath']('/data', 'script', true, true);
Module['FS_createPath']('/data/script', 'submarine', true, true);
Module['FS_createPath']('/data', 'sound', true, true);
Module['FS_createPath']('/data/sound', 'submarine', true, true);
Module['FS_createPath']('/data/sound/submarine', 'cs', true, true);
Module['FS_createPath']('/data/sound/submarine', 'nl', true, true);

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
              Module['removeRunDependency']('datafile_web/data/submarine.data');

    };
    Module['addRunDependency']('datafile_web/data/submarine.data');
  
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
 loadPackage({"files": [{"filename": "/data/images/submarine/kriz.png", "start": 0, "end": 596, "audio": 0}, {"filename": "/data/images/submarine/lahev.png", "start": 596, "end": 1813, "audio": 0}, {"filename": "/data/images/submarine/matka_a.png", "start": 1813, "end": 2450, "audio": 0}, {"filename": "/data/images/submarine/naboj.png", "start": 2450, "end": 3445, "audio": 0}, {"filename": "/data/images/submarine/peri_00.png", "start": 3445, "end": 5583, "audio": 0}, {"filename": "/data/images/submarine/peri_01.png", "start": 5583, "end": 7690, "audio": 0}, {"filename": "/data/images/submarine/peri_02.png", "start": 7690, "end": 9798, "audio": 0}, {"filename": "/data/images/submarine/peri_03.png", "start": 9798, "end": 11800, "audio": 0}, {"filename": "/data/images/submarine/peri_04.png", "start": 11800, "end": 13893, "audio": 0}, {"filename": "/data/images/submarine/peri_05.png", "start": 13893, "end": 16030, "audio": 0}, {"filename": "/data/images/submarine/peri_06.png", "start": 16030, "end": 18189, "audio": 0}, {"filename": "/data/images/submarine/peri_07.png", "start": 18189, "end": 20337, "audio": 0}, {"filename": "/data/images/submarine/zrcadlo.png", "start": 20337, "end": 21811, "audio": 0}, {"filename": "/data/images/submarine/zrc-p.png", "start": 21811, "end": 71756, "audio": 0}, {"filename": "/data/images/submarine/zrc-w.png", "start": 71756, "end": 133660, "audio": 0}, {"filename": "/data/script/submarine/code.lua", "start": 133660, "end": 144042, "audio": 0}, {"filename": "/data/script/submarine/dialogs_bg.lua", "start": 144042, "end": 146544, "audio": 0}, {"filename": "/data/script/submarine/dialogs_cs.lua", "start": 146544, "end": 148616, "audio": 0}, {"filename": "/data/script/submarine/dialogs_de_CH.lua", "start": 148616, "end": 149023, "audio": 0}, {"filename": "/data/script/submarine/dialogs_de.lua", "start": 149023, "end": 151211, "audio": 0}, {"filename": "/data/script/submarine/dialogs_en.lua", "start": 151211, "end": 152505, "audio": 0}, {"filename": "/data/script/submarine/dialogs_es.lua", "start": 152505, "end": 154671, "audio": 0}, {"filename": "/data/script/submarine/dialogs_fr.lua", "start": 154671, "end": 156848, "audio": 0}, {"filename": "/data/script/submarine/dialogs_it.lua", "start": 156848, "end": 158948, "audio": 0}, {"filename": "/data/script/submarine/dialogs.lua", "start": 158948, "end": 158986, "audio": 0}, {"filename": "/data/script/submarine/dialogs_nl.lua", "start": 158986, "end": 161126, "audio": 0}, {"filename": "/data/script/submarine/dialogs_pl.lua", "start": 161126, "end": 163217, "audio": 0}, {"filename": "/data/script/submarine/dialogs_ru.lua", "start": 163217, "end": 165816, "audio": 0}, {"filename": "/data/script/submarine/dialogs_sl.lua", "start": 165816, "end": 167866, "audio": 0}, {"filename": "/data/script/submarine/dialogs_sv.lua", "start": 167866, "end": 170009, "audio": 0}, {"filename": "/data/script/submarine/init.lua", "start": 170009, "end": 170657, "audio": 0}, {"filename": "/data/script/submarine/models.lua", "start": 170657, "end": 172234, "audio": 0}, {"filename": "/data/sound/submarine/cs/zr-m-komu.ogg", "start": 172234, "end": 188680, "audio": 1}, {"filename": "/data/sound/submarine/cs/zr-m-nepovykuj.ogg", "start": 188680, "end": 208989, "audio": 1}, {"filename": "/data/sound/submarine/cs/zr-m-nervi.ogg", "start": 208989, "end": 228413, "audio": 1}, {"filename": "/data/sound/submarine/cs/zr-m-obliceje.ogg", "start": 228413, "end": 248410, "audio": 1}, {"filename": "/data/sound/submarine/cs/zr-m-pockej.ogg", "start": 248410, "end": 275322, "audio": 1}, {"filename": "/data/sound/submarine/cs/zr-m-prestan.ogg", "start": 275322, "end": 299682, "audio": 1}, {"filename": "/data/sound/submarine/cs/zr-m-tadyjsem.ogg", "start": 299682, "end": 323140, "audio": 1}, {"filename": "/data/sound/submarine/cs/zr-m-takfajn.ogg", "start": 323140, "end": 344995, "audio": 1}, {"filename": "/data/sound/submarine/cs/zr-m-tojeon.ogg", "start": 344995, "end": 366318, "audio": 1}, {"filename": "/data/sound/submarine/cs/zr-v-halo.ogg", "start": 366318, "end": 388740, "audio": 1}, {"filename": "/data/sound/submarine/cs/zr-v-hej.ogg", "start": 388740, "end": 409337, "audio": 1}, {"filename": "/data/sound/submarine/cs/zr-v-jetunekdo.ogg", "start": 409337, "end": 423377, "audio": 1}, {"filename": "/data/sound/submarine/cs/zr-v-nevim.ogg", "start": 423377, "end": 448775, "audio": 1}, {"filename": "/data/sound/submarine/cs/zr-v-opatrne.ogg", "start": 448775, "end": 459487, "audio": 1}, {"filename": "/data/sound/submarine/cs/zr-v-vzdyt.ogg", "start": 459487, "end": 474159, "audio": 1}, {"filename": "/data/sound/submarine/cs/zr-x-nabito.ogg", "start": 474159, "end": 500199, "audio": 1}, {"filename": "/data/sound/submarine/nl/zr-m-komu.ogg", "start": 500199, "end": 517314, "audio": 1}, {"filename": "/data/sound/submarine/nl/zr-m-nepovykuj.ogg", "start": 517314, "end": 538252, "audio": 1}, {"filename": "/data/sound/submarine/nl/zr-m-nervi.ogg", "start": 538252, "end": 555924, "audio": 1}, {"filename": "/data/sound/submarine/nl/zr-m-obliceje.ogg", "start": 555924, "end": 579369, "audio": 1}, {"filename": "/data/sound/submarine/nl/zr-m-pockej.ogg", "start": 579369, "end": 602283, "audio": 1}, {"filename": "/data/sound/submarine/nl/zr-m-prestan.ogg", "start": 602283, "end": 629028, "audio": 1}, {"filename": "/data/sound/submarine/nl/zr-m-tadyjsem.ogg", "start": 629028, "end": 647264, "audio": 1}, {"filename": "/data/sound/submarine/nl/zr-m-takfajn.ogg", "start": 647264, "end": 671906, "audio": 1}, {"filename": "/data/sound/submarine/nl/zr-m-tojeon.ogg", "start": 671906, "end": 695326, "audio": 1}, {"filename": "/data/sound/submarine/nl/zr-v-halo.ogg", "start": 695326, "end": 714025, "audio": 1}, {"filename": "/data/sound/submarine/nl/zr-v-hej.ogg", "start": 714025, "end": 737570, "audio": 1}, {"filename": "/data/sound/submarine/nl/zr-v-jetunekdo.ogg", "start": 737570, "end": 756412, "audio": 1}, {"filename": "/data/sound/submarine/nl/zr-v-nevim.ogg", "start": 756412, "end": 786249, "audio": 1}, {"filename": "/data/sound/submarine/nl/zr-v-opatrne.ogg", "start": 786249, "end": 802565, "audio": 1}, {"filename": "/data/sound/submarine/nl/zr-v-vzdyt.ogg", "start": 802565, "end": 820519, "audio": 1}], "remote_package_size": 820519, "package_uuid": "95e35157-e41f-4cc0-8b2a-606c59077e26"});

})();
