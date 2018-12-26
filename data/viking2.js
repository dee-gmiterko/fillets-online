
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
    var PACKAGE_NAME = 'web/data/viking2.data';
    var REMOTE_PACKAGE_BASE = 'data/viking2.data';
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
Module['FS_createPath']('/data/images', 'viking2', true, true);
Module['FS_createPath']('/data', 'script', true, true);
Module['FS_createPath']('/data/script', 'viking2', true, true);
Module['FS_createPath']('/data', 'sound', true, true);
Module['FS_createPath']('/data/sound', 'viking2', true, true);
Module['FS_createPath']('/data/sound/viking2', 'cs', true, true);
Module['FS_createPath']('/data/sound/viking2', 'en', true, true);
Module['FS_createPath']('/data/sound/viking2', 'nl', true, true);

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
              Module['removeRunDependency']('datafile_web/data/viking2.data');

    };
    Module['addRunDependency']('datafile_web/data/viking2.data');
  
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
 loadPackage({"files": [{"filename": "/data/images/viking2/drakar-hlava_00.png", "start": 0, "end": 7425, "audio": 0}, {"filename": "/data/images/viking2/drakar-hlava_01.png", "start": 7425, "end": 14658, "audio": 0}, {"filename": "/data/images/viking2/drakar-hlava_02.png", "start": 14658, "end": 21755, "audio": 0}, {"filename": "/data/images/viking2/drakar-p.png", "start": 21755, "end": 259542, "audio": 0}, {"filename": "/data/images/viking2/drakar-w.png", "start": 259542, "end": 585688, "audio": 0}, {"filename": "/data/images/viking2/korunka.png", "start": 585688, "end": 589281, "audio": 0}, {"filename": "/data/images/viking2/ocel-1.png", "start": 589281, "end": 592093, "audio": 0}, {"filename": "/data/images/viking2/ocel-2.png", "start": 592093, "end": 592789, "audio": 0}, {"filename": "/data/images/viking2/pesos_00.png", "start": 592789, "end": 596831, "audio": 0}, {"filename": "/data/images/viking2/pesos_01.png", "start": 596831, "end": 600830, "audio": 0}, {"filename": "/data/images/viking2/pesos_02.png", "start": 600830, "end": 604803, "audio": 0}, {"filename": "/data/images/viking2/spalici_00.png", "start": 604803, "end": 611669, "audio": 0}, {"filename": "/data/images/viking2/spalici_01.png", "start": 611669, "end": 622888, "audio": 0}, {"filename": "/data/images/viking2/spalici_02.png", "start": 622888, "end": 632615, "audio": 0}, {"filename": "/data/images/viking2/spalici_03.png", "start": 632615, "end": 639524, "audio": 0}, {"filename": "/data/images/viking2/spalici_04.png", "start": 639524, "end": 646362, "audio": 0}, {"filename": "/data/images/viking2/spalici_05.png", "start": 646362, "end": 653216, "audio": 0}, {"filename": "/data/images/viking2/stit.png", "start": 653216, "end": 654682, "audio": 0}, {"filename": "/data/images/viking2/vik1_00.png", "start": 654682, "end": 661433, "audio": 0}, {"filename": "/data/images/viking2/vik1_01.png", "start": 661433, "end": 668182, "audio": 0}, {"filename": "/data/images/viking2/vik1_02.png", "start": 668182, "end": 674928, "audio": 0}, {"filename": "/data/images/viking2/vik1_03.png", "start": 674928, "end": 681510, "audio": 0}, {"filename": "/data/images/viking2/vik1_04.png", "start": 681510, "end": 688184, "audio": 0}, {"filename": "/data/images/viking2/vik2_00.png", "start": 688184, "end": 694388, "audio": 0}, {"filename": "/data/images/viking2/vik2_01.png", "start": 694388, "end": 700774, "audio": 0}, {"filename": "/data/images/viking2/vik2_02.png", "start": 700774, "end": 707121, "audio": 0}, {"filename": "/data/images/viking2/vik2_03.png", "start": 707121, "end": 713463, "audio": 0}, {"filename": "/data/images/viking2/vik2_04.png", "start": 713463, "end": 719773, "audio": 0}, {"filename": "/data/images/viking2/vik3_00.png", "start": 719773, "end": 724889, "audio": 0}, {"filename": "/data/images/viking2/vik3_01.png", "start": 724889, "end": 731697, "audio": 0}, {"filename": "/data/images/viking2/vik3_02.png", "start": 731697, "end": 738448, "audio": 0}, {"filename": "/data/images/viking2/vik3_03.png", "start": 738448, "end": 745241, "audio": 0}, {"filename": "/data/images/viking2/vik3_04.png", "start": 745241, "end": 751975, "audio": 0}, {"filename": "/data/images/viking2/vik3_05.png", "start": 751975, "end": 758752, "audio": 0}, {"filename": "/data/images/viking2/vik3_06.png", "start": 758752, "end": 765590, "audio": 0}, {"filename": "/data/images/viking2/vik5_00.png", "start": 765590, "end": 771807, "audio": 0}, {"filename": "/data/images/viking2/vik5_01.png", "start": 771807, "end": 778074, "audio": 0}, {"filename": "/data/images/viking2/vik5_02.png", "start": 778074, "end": 784699, "audio": 0}, {"filename": "/data/images/viking2/vik5_03.png", "start": 784699, "end": 791151, "audio": 0}, {"filename": "/data/images/viking2/vik6_00.png", "start": 791151, "end": 798098, "audio": 0}, {"filename": "/data/images/viking2/vik6_01.png", "start": 798098, "end": 805027, "audio": 0}, {"filename": "/data/images/viking2/vik6_02.png", "start": 805027, "end": 811965, "audio": 0}, {"filename": "/data/images/viking2/vik6_03.png", "start": 811965, "end": 818886, "audio": 0}, {"filename": "/data/images/viking2/vik7_00.png", "start": 818886, "end": 825341, "audio": 0}, {"filename": "/data/images/viking2/vik7_01.png", "start": 825341, "end": 831806, "audio": 0}, {"filename": "/data/images/viking2/vik7_02.png", "start": 831806, "end": 838463, "audio": 0}, {"filename": "/data/images/viking2/vik7_03.png", "start": 838463, "end": 845121, "audio": 0}, {"filename": "/data/images/viking2/vik7_04.png", "start": 845121, "end": 851401, "audio": 0}, {"filename": "/data/images/viking2/vik7_05.png", "start": 851401, "end": 857681, "audio": 0}, {"filename": "/data/images/viking2/vik7_06.png", "start": 857681, "end": 863939, "audio": 0}, {"filename": "/data/images/viking2/vik7_07.png", "start": 863939, "end": 870207, "audio": 0}, {"filename": "/data/script/viking2/code.lua", "start": 870207, "end": 901672, "audio": 0}, {"filename": "/data/script/viking2/dialogs_bg.lua", "start": 901672, "end": 911626, "audio": 0}, {"filename": "/data/script/viking2/dialogs_cs.lua", "start": 911626, "end": 919331, "audio": 0}, {"filename": "/data/script/viking2/dialogs_de_CH.lua", "start": 919331, "end": 920240, "audio": 0}, {"filename": "/data/script/viking2/dialogs_de.lua", "start": 920240, "end": 928390, "audio": 0}, {"filename": "/data/script/viking2/dialogs_en.lua", "start": 928390, "end": 933608, "audio": 0}, {"filename": "/data/script/viking2/dialogs_es.lua", "start": 933608, "end": 942004, "audio": 0}, {"filename": "/data/script/viking2/dialogs_fr.lua", "start": 942004, "end": 950199, "audio": 0}, {"filename": "/data/script/viking2/dialogs_it.lua", "start": 950199, "end": 958013, "audio": 0}, {"filename": "/data/script/viking2/dialogs.lua", "start": 958013, "end": 958051, "audio": 0}, {"filename": "/data/script/viking2/dialogs_nl.lua", "start": 958051, "end": 966113, "audio": 0}, {"filename": "/data/script/viking2/dialogs_pl.lua", "start": 966113, "end": 973901, "audio": 0}, {"filename": "/data/script/viking2/dialogs_ru.lua", "start": 973901, "end": 983955, "audio": 0}, {"filename": "/data/script/viking2/dialogs_sv.lua", "start": 983955, "end": 992024, "audio": 0}, {"filename": "/data/script/viking2/init.lua", "start": 992024, "end": 992670, "audio": 0}, {"filename": "/data/script/viking2/models.lua", "start": 992670, "end": 997045, "audio": 0}, {"filename": "/data/sound/viking2/cs/dr-1-achjo.ogg", "start": 997045, "end": 1020879, "audio": 1}, {"filename": "/data/sound/viking2/cs/dr-1-aztambudem.ogg", "start": 1020879, "end": 1042289, "audio": 1}, {"filename": "/data/sound/viking2/cs/dr-1-bojovnik.ogg", "start": 1042289, "end": 1066306, "audio": 1}, {"filename": "/data/sound/viking2/cs/dr-1-chechtajici.ogg", "start": 1066306, "end": 1100772, "audio": 1}, {"filename": "/data/sound/viking2/cs/dr1-m-dlouho.ogg", "start": 1100772, "end": 1117209, "audio": 1}, {"filename": "/data/sound/viking2/cs/dr-1-pockej.ogg", "start": 1117209, "end": 1138711, "audio": 1}, {"filename": "/data/sound/viking2/cs/dr-1-procja.ogg", "start": 1138711, "end": 1170539, "audio": 1}, {"filename": "/data/sound/viking2/cs/dr-1-trpelivost.ogg", "start": 1170539, "end": 1193573, "audio": 1}, {"filename": "/data/sound/viking2/cs/dr1-v-harold.ogg", "start": 1193573, "end": 1215484, "audio": 1}, {"filename": "/data/sound/viking2/cs/dr1-v-leif.ogg", "start": 1215484, "end": 1236417, "audio": 1}, {"filename": "/data/sound/viking2/cs/dr1-v-olaf.ogg", "start": 1236417, "end": 1253423, "audio": 1}, {"filename": "/data/sound/viking2/cs/dr1-v-snorr.ogg", "start": 1253423, "end": 1275107, "audio": 1}, {"filename": "/data/sound/viking2/cs/dr1-v-thorson.ogg", "start": 1275107, "end": 1293610, "audio": 1}, {"filename": "/data/sound/viking2/cs/dr1-v-urcite.ogg", "start": 1293610, "end": 1354148, "audio": 1}, {"filename": "/data/sound/viking2/cs/dr1-x-erik.ogg", "start": 1354148, "end": 1404544, "audio": 1}, {"filename": "/data/sound/viking2/cs/dr-2-netrva.ogg", "start": 1404544, "end": 1431058, "audio": 1}, {"filename": "/data/sound/viking2/cs/dr-2-odskocit.ogg", "start": 1431058, "end": 1455509, "audio": 1}, {"filename": "/data/sound/viking2/cs/dr-2-urcite.ogg", "start": 1455509, "end": 1477304, "audio": 1}, {"filename": "/data/sound/viking2/cs/dr-2-uzbudeme1.ogg", "start": 1477304, "end": 1498517, "audio": 1}, {"filename": "/data/sound/viking2/cs/dr-2-uzbudeme2.ogg", "start": 1498517, "end": 1514804, "audio": 1}, {"filename": "/data/sound/viking2/cs/dr-3-chlap.ogg", "start": 1514804, "end": 1542421, "audio": 1}, {"filename": "/data/sound/viking2/cs/dr-3-cojeto.ogg", "start": 1542421, "end": 1574067, "audio": 1}, {"filename": "/data/sound/viking2/cs/dr-3-mladez.ogg", "start": 1574067, "end": 1596216, "audio": 1}, {"filename": "/data/sound/viking2/cs/dr-3-mladi.ogg", "start": 1596216, "end": 1621960, "audio": 1}, {"filename": "/data/sound/viking2/cs/dr-3-nemel.ogg", "start": 1621960, "end": 1646256, "audio": 1}, {"filename": "/data/sound/viking2/cs/dr-3-nesmysl.ogg", "start": 1646256, "end": 1670680, "audio": 1}, {"filename": "/data/sound/viking2/cs/dr-3-radeji.ogg", "start": 1670680, "end": 1699433, "audio": 1}, {"filename": "/data/sound/viking2/cs/dr-3-samozrejme.ogg", "start": 1699433, "end": 1715921, "audio": 1}, {"filename": "/data/sound/viking2/cs/dr-3-spravny.ogg", "start": 1715921, "end": 1739366, "audio": 1}, {"filename": "/data/sound/viking2/cs/dr-3-stakovou.ogg", "start": 1739366, "end": 1766156, "audio": 1}, {"filename": "/data/sound/viking2/cs/dr-4-budu.ogg", "start": 1766156, "end": 1787054, "audio": 1}, {"filename": "/data/sound/viking2/cs/dr-4-copy.ogg", "start": 1787054, "end": 1807363, "audio": 1}, {"filename": "/data/sound/viking2/cs/dr-4-erik.ogg", "start": 1807363, "end": 1835344, "audio": 1}, {"filename": "/data/sound/viking2/cs/dr-4-hmmm.ogg", "start": 1835344, "end": 1874613, "audio": 1}, {"filename": "/data/sound/viking2/cs/dr-4-magazin.ogg", "start": 1874613, "end": 1930380, "audio": 1}, {"filename": "/data/sound/viking2/cs/dr-4-moderni.ogg", "start": 1930380, "end": 1953075, "audio": 1}, {"filename": "/data/sound/viking2/cs/dr-4-myslis.ogg", "start": 1953075, "end": 1983867, "audio": 1}, {"filename": "/data/sound/viking2/cs/dr-4-ne.ogg", "start": 1983867, "end": 2011879, "audio": 1}, {"filename": "/data/sound/viking2/cs/dr-4-stejne.ogg", "start": 2011879, "end": 2030561, "audio": 1}, {"filename": "/data/sound/viking2/cs/dr-4-taky.ogg", "start": 2030561, "end": 2053549, "audio": 1}, {"filename": "/data/sound/viking2/cs/dr-5-srab1.ogg", "start": 2053549, "end": 2065238, "audio": 1}, {"filename": "/data/sound/viking2/cs/dr-5-srab2.ogg", "start": 2065238, "end": 2080926, "audio": 1}, {"filename": "/data/sound/viking2/cs/dr-5-srab3.ogg", "start": 2080926, "end": 2095430, "audio": 1}, {"filename": "/data/sound/viking2/cs/dr-5-srab4.ogg", "start": 2095430, "end": 2111905, "audio": 1}, {"filename": "/data/sound/viking2/cs/dr-5-srab5.ogg", "start": 2111905, "end": 2126656, "audio": 1}, {"filename": "/data/sound/viking2/cs/dr-6-checheche.ogg", "start": 2126656, "end": 2172750, "audio": 1}, {"filename": "/data/sound/viking2/cs/dr-8-aaa.ogg", "start": 2172750, "end": 2189450, "audio": 1}, {"filename": "/data/sound/viking2/cs/dr-8-nenechas.ogg", "start": 2189450, "end": 2208241, "audio": 1}, {"filename": "/data/sound/viking2/cs/dr-8-ztichni1.ogg", "start": 2208241, "end": 2222505, "audio": 1}, {"filename": "/data/sound/viking2/cs/dr-8-ztichni2.ogg", "start": 2222505, "end": 2237942, "audio": 1}, {"filename": "/data/sound/viking2/cs/dr-m-nedycha.ogg", "start": 2237942, "end": 2252890, "audio": 1}, {"filename": "/data/sound/viking2/cs/dr-m-podivej.ogg", "start": 2252890, "end": 2270150, "audio": 1}, {"filename": "/data/sound/viking2/cs/dr-v-napsa.ogg", "start": 2270150, "end": 2291805, "audio": 1}, {"filename": "/data/sound/viking2/cs/dr-v-nato.ogg", "start": 2291805, "end": 2316883, "audio": 1}, {"filename": "/data/sound/viking2/en/dr-7-brble1.ogg", "start": 2316883, "end": 2333840, "audio": 1}, {"filename": "/data/sound/viking2/en/dr-7-brble2.ogg", "start": 2333840, "end": 2347483, "audio": 1}, {"filename": "/data/sound/viking2/en/dr-7-brble3.ogg", "start": 2347483, "end": 2362386, "audio": 1}, {"filename": "/data/sound/viking2/en/dr-7-brble4.ogg", "start": 2362386, "end": 2375567, "audio": 1}, {"filename": "/data/sound/viking2/en/dr-7-brble5.ogg", "start": 2375567, "end": 2388086, "audio": 1}, {"filename": "/data/sound/viking2/en/dr-7-sm1.ogg", "start": 2388086, "end": 2402173, "audio": 1}, {"filename": "/data/sound/viking2/en/dr-7-sm2.ogg", "start": 2402173, "end": 2411421, "audio": 1}, {"filename": "/data/sound/viking2/en/dr-7-sm3.ogg", "start": 2411421, "end": 2425824, "audio": 1}, {"filename": "/data/sound/viking2/en/dr-7-sm4.ogg", "start": 2425824, "end": 2437276, "audio": 1}, {"filename": "/data/sound/viking2/en/dr-7-sm5.ogg", "start": 2437276, "end": 2450245, "audio": 1}, {"filename": "/data/sound/viking2/en/dr-7-sm6.ogg", "start": 2450245, "end": 2464274, "audio": 1}, {"filename": "/data/sound/viking2/en/dr-7-sm7.ogg", "start": 2464274, "end": 2476170, "audio": 1}, {"filename": "/data/sound/viking2/en/dr-7-sm8.ogg", "start": 2476170, "end": 2486623, "audio": 1}, {"filename": "/data/sound/viking2/en/dr-x-buch.ogg", "start": 2486623, "end": 2491892, "audio": 1}, {"filename": "/data/sound/viking2/en/dr-x-pes.ogg", "start": 2491892, "end": 2546546, "audio": 1}, {"filename": "/data/sound/viking2/nl/dr1-m-dlouho.ogg", "start": 2546546, "end": 2569133, "audio": 1}, {"filename": "/data/sound/viking2/nl/dr1-v-harold.ogg", "start": 2569133, "end": 2595369, "audio": 1}, {"filename": "/data/sound/viking2/nl/dr1-v-leif.ogg", "start": 2595369, "end": 2617478, "audio": 1}, {"filename": "/data/sound/viking2/nl/dr1-v-olaf.ogg", "start": 2617478, "end": 2641253, "audio": 1}, {"filename": "/data/sound/viking2/nl/dr1-v-snorr.ogg", "start": 2641253, "end": 2665766, "audio": 1}, {"filename": "/data/sound/viking2/nl/dr1-v-thorson.ogg", "start": 2665766, "end": 2695872, "audio": 1}, {"filename": "/data/sound/viking2/nl/dr1-v-urcite.ogg", "start": 2695872, "end": 2755521, "audio": 1}, {"filename": "/data/sound/viking2/nl/dr-m-nedycha.ogg", "start": 2755521, "end": 2773822, "audio": 1}, {"filename": "/data/sound/viking2/nl/dr-m-podivej.ogg", "start": 2773822, "end": 2789738, "audio": 1}, {"filename": "/data/sound/viking2/nl/dr-v-napsa.ogg", "start": 2789738, "end": 2814293, "audio": 1}, {"filename": "/data/sound/viking2/nl/dr-v-nato.ogg", "start": 2814293, "end": 2844623, "audio": 1}], "remote_package_size": 2844623, "package_uuid": "3625d72d-5af4-4fde-bf1c-ab70354cebc0"});

})();
