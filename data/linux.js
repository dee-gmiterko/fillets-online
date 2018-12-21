
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
    var PACKAGE_NAME = 'web/data/linux.data';
    var REMOTE_PACKAGE_BASE = 'data/linux.data';
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
Module['FS_createPath']('/data/images', 'linux', true, true);
Module['FS_createPath']('/data', 'script', true, true);
Module['FS_createPath']('/data/script', 'linux', true, true);
Module['FS_createPath']('/data', 'sound', true, true);
Module['FS_createPath']('/data/sound', 'linux', true, true);
Module['FS_createPath']('/data/sound/linux', 'cs', true, true);
Module['FS_createPath']('/data/sound/linux', 'en', true, true);
Module['FS_createPath']('/data/sound/linux', 'nl', true, true);

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
              Module['removeRunDependency']('datafile_web/data/linux.data');

    };
    Module['addRunDependency']('datafile_web/data/linux.data');
  
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
 loadPackage({"files": [{"filename": "/data/images/linux/bubble1_00.png", "start": 0, "end": 913, "audio": 0}, {"filename": "/data/images/linux/bubble1_01.png", "start": 913, "end": 1808, "audio": 0}, {"filename": "/data/images/linux/bubble2_00.png", "start": 1808, "end": 2720, "audio": 0}, {"filename": "/data/images/linux/bubble2_01.png", "start": 2720, "end": 3606, "audio": 0}, {"filename": "/data/images/linux/bubble3.png", "start": 3606, "end": 4499, "audio": 0}, {"filename": "/data/images/linux/cursor_00.png", "start": 4499, "end": 6786, "audio": 0}, {"filename": "/data/images/linux/cursor_01.png", "start": 6786, "end": 9041, "audio": 0}, {"filename": "/data/images/linux/cursor_02.png", "start": 9041, "end": 11265, "audio": 0}, {"filename": "/data/images/linux/cursor_03.png", "start": 11265, "end": 13458, "audio": 0}, {"filename": "/data/images/linux/cursor_04.png", "start": 13458, "end": 15609, "audio": 0}, {"filename": "/data/images/linux/cursor_05.png", "start": 15609, "end": 17716, "audio": 0}, {"filename": "/data/images/linux/cursor_06.png", "start": 17716, "end": 19787, "audio": 0}, {"filename": "/data/images/linux/cursor_07.png", "start": 19787, "end": 21821, "audio": 0}, {"filename": "/data/images/linux/cursor_08.png", "start": 21821, "end": 23811, "audio": 0}, {"filename": "/data/images/linux/cursor_09.png", "start": 23811, "end": 25765, "audio": 0}, {"filename": "/data/images/linux/cursor_10.png", "start": 25765, "end": 27685, "audio": 0}, {"filename": "/data/images/linux/cursor_11.png", "start": 27685, "end": 29575, "audio": 0}, {"filename": "/data/images/linux/cursor_12.png", "start": 29575, "end": 31435, "audio": 0}, {"filename": "/data/images/linux/cursor_13.png", "start": 31435, "end": 33255, "audio": 0}, {"filename": "/data/images/linux/cursor_14.png", "start": 33255, "end": 35049, "audio": 0}, {"filename": "/data/images/linux/cursor_15.png", "start": 35049, "end": 36810, "audio": 0}, {"filename": "/data/images/linux/cursor_16.png", "start": 36810, "end": 38534, "audio": 0}, {"filename": "/data/images/linux/cursor_17.png", "start": 38534, "end": 40217, "audio": 0}, {"filename": "/data/images/linux/cursor_18.png", "start": 40217, "end": 41856, "audio": 0}, {"filename": "/data/images/linux/cursor_19.png", "start": 41856, "end": 43482, "audio": 0}, {"filename": "/data/images/linux/cursor_20.png", "start": 43482, "end": 45053, "audio": 0}, {"filename": "/data/images/linux/cursor_21.png", "start": 45053, "end": 46590, "audio": 0}, {"filename": "/data/images/linux/cursor_22.png", "start": 46590, "end": 48089, "audio": 0}, {"filename": "/data/images/linux/cursor_23.png", "start": 48089, "end": 49539, "audio": 0}, {"filename": "/data/images/linux/cursor_24.png", "start": 49539, "end": 50955, "audio": 0}, {"filename": "/data/images/linux/cursor_25.png", "start": 50955, "end": 52330, "audio": 0}, {"filename": "/data/images/linux/cursor_26.png", "start": 52330, "end": 53672, "audio": 0}, {"filename": "/data/images/linux/cursor_27.png", "start": 53672, "end": 54978, "audio": 0}, {"filename": "/data/images/linux/cursor_28.png", "start": 54978, "end": 56246, "audio": 0}, {"filename": "/data/images/linux/cursor_29.png", "start": 56246, "end": 57468, "audio": 0}, {"filename": "/data/images/linux/cursor_30.png", "start": 57468, "end": 58650, "audio": 0}, {"filename": "/data/images/linux/cursor_31.png", "start": 58650, "end": 59788, "audio": 0}, {"filename": "/data/images/linux/cursor_32.png", "start": 59788, "end": 60891, "audio": 0}, {"filename": "/data/images/linux/cursor_33.png", "start": 60891, "end": 61955, "audio": 0}, {"filename": "/data/images/linux/cursor_34.png", "start": 61955, "end": 62971, "audio": 0}, {"filename": "/data/images/linux/cursor_35.png", "start": 62971, "end": 63931, "audio": 0}, {"filename": "/data/images/linux/cursor_36.png", "start": 63931, "end": 64854, "audio": 0}, {"filename": "/data/images/linux/cursor_37.png", "start": 64854, "end": 65738, "audio": 0}, {"filename": "/data/images/linux/cursor_38.png", "start": 65738, "end": 66578, "audio": 0}, {"filename": "/data/images/linux/cursor_39.png", "start": 66578, "end": 67374, "audio": 0}, {"filename": "/data/images/linux/cursor_40.png", "start": 67374, "end": 68116, "audio": 0}, {"filename": "/data/images/linux/cursor_41.png", "start": 68116, "end": 68806, "audio": 0}, {"filename": "/data/images/linux/cursor_42.png", "start": 68806, "end": 69455, "audio": 0}, {"filename": "/data/images/linux/cursor_43.png", "start": 69455, "end": 70056, "audio": 0}, {"filename": "/data/images/linux/cursor_44.png", "start": 70056, "end": 70606, "audio": 0}, {"filename": "/data/images/linux/cursor_45.png", "start": 70606, "end": 71091, "audio": 0}, {"filename": "/data/images/linux/cursor_46.png", "start": 71091, "end": 71527, "audio": 0}, {"filename": "/data/images/linux/cursor_47.png", "start": 71527, "end": 71900, "audio": 0}, {"filename": "/data/images/linux/cursor_48.png", "start": 71900, "end": 72210, "audio": 0}, {"filename": "/data/images/linux/linuxak1_00.png", "start": 72210, "end": 74220, "audio": 0}, {"filename": "/data/images/linux/linuxak1_01.png", "start": 74220, "end": 76255, "audio": 0}, {"filename": "/data/images/linux/linuxak1_02.png", "start": 76255, "end": 78290, "audio": 0}, {"filename": "/data/images/linux/linuxak1_03.png", "start": 78290, "end": 80294, "audio": 0}, {"filename": "/data/images/linux/linuxak1_04.png", "start": 80294, "end": 82303, "audio": 0}, {"filename": "/data/images/linux/linuxak1_05.png", "start": 82303, "end": 84239, "audio": 0}, {"filename": "/data/images/linux/linuxak2_00.png", "start": 84239, "end": 86099, "audio": 0}, {"filename": "/data/images/linux/linuxak2_01.png", "start": 86099, "end": 87988, "audio": 0}, {"filename": "/data/images/linux/linuxak2_02.png", "start": 87988, "end": 89880, "audio": 0}, {"filename": "/data/images/linux/linuxak2_03.png", "start": 89880, "end": 91759, "audio": 0}, {"filename": "/data/images/linux/linuxak2_04.png", "start": 91759, "end": 93609, "audio": 0}, {"filename": "/data/images/linux/linuxak2_05.png", "start": 93609, "end": 95444, "audio": 0}, {"filename": "/data/images/linux/ocel1.png", "start": 95444, "end": 96294, "audio": 0}, {"filename": "/data/images/linux/ocel2.png", "start": 96294, "end": 97687, "audio": 0}, {"filename": "/data/images/linux/ocel3.png", "start": 97687, "end": 98615, "audio": 0}, {"filename": "/data/images/linux/ocel4.png", "start": 98615, "end": 100831, "audio": 0}, {"filename": "/data/images/linux/popredi.png", "start": 100831, "end": 144714, "audio": 0}, {"filename": "/data/images/linux/poster.png", "start": 144714, "end": 543692, "audio": 0}, {"filename": "/data/images/linux/pozadi.png", "start": 543692, "end": 594517, "audio": 0}, {"filename": "/data/images/linux/python.png", "start": 594517, "end": 597649, "audio": 0}, {"filename": "/data/images/linux/text_00.png", "start": 597649, "end": 598108, "audio": 0}, {"filename": "/data/images/linux/text_01.png", "start": 598108, "end": 598542, "audio": 0}, {"filename": "/data/images/linux/text_02.png", "start": 598542, "end": 599022, "audio": 0}, {"filename": "/data/images/linux/text_03.png", "start": 599022, "end": 599507, "audio": 0}, {"filename": "/data/images/linux/text_04.png", "start": 599507, "end": 599998, "audio": 0}, {"filename": "/data/images/linux/text_05.png", "start": 599998, "end": 600478, "audio": 0}, {"filename": "/data/images/linux/text_06.png", "start": 600478, "end": 600973, "audio": 0}, {"filename": "/data/images/linux/text_07.png", "start": 600973, "end": 601446, "audio": 0}, {"filename": "/data/images/linux/text_08.png", "start": 601446, "end": 601934, "audio": 0}, {"filename": "/data/images/linux/text_09.png", "start": 601934, "end": 602411, "audio": 0}, {"filename": "/data/images/linux/text_10.png", "start": 602411, "end": 602884, "audio": 0}, {"filename": "/data/images/linux/text_11.png", "start": 602884, "end": 603375, "audio": 0}, {"filename": "/data/images/linux/text_12.png", "start": 603375, "end": 603848, "audio": 0}, {"filename": "/data/images/linux/text_13.png", "start": 603848, "end": 604340, "audio": 0}, {"filename": "/data/images/linux/text_14.png", "start": 604340, "end": 605146, "audio": 0}, {"filename": "/data/images/linux/text_15.png", "start": 605146, "end": 605569, "audio": 0}, {"filename": "/data/images/linux/wilber.png", "start": 605569, "end": 606821, "audio": 0}, {"filename": "/data/script/linux/code.lua", "start": 606821, "end": 618889, "audio": 0}, {"filename": "/data/script/linux/demo_dialogs_bg.lua", "start": 618889, "end": 620201, "audio": 0}, {"filename": "/data/script/linux/demo_dialogs_cs.lua", "start": 620201, "end": 620784, "audio": 0}, {"filename": "/data/script/linux/demo_dialogs_de.lua", "start": 620784, "end": 621856, "audio": 0}, {"filename": "/data/script/linux/demo_dialogs_en.lua", "start": 621856, "end": 622410, "audio": 0}, {"filename": "/data/script/linux/demo_dialogs_nl.lua", "start": 622410, "end": 623525, "audio": 0}, {"filename": "/data/script/linux/demo_dialogs_sv.lua", "start": 623525, "end": 624636, "audio": 0}, {"filename": "/data/script/linux/demo_poster.lua", "start": 624636, "end": 624893, "audio": 0}, {"filename": "/data/script/linux/dialogs_bg.lua", "start": 624893, "end": 637646, "audio": 0}, {"filename": "/data/script/linux/dialogs_cs.lua", "start": 637646, "end": 648623, "audio": 0}, {"filename": "/data/script/linux/dialogs_de.lua", "start": 648623, "end": 659914, "audio": 0}, {"filename": "/data/script/linux/dialogs_en.lua", "start": 659914, "end": 666623, "audio": 0}, {"filename": "/data/script/linux/dialogs.lua", "start": 666623, "end": 666661, "audio": 0}, {"filename": "/data/script/linux/dialogs_nl.lua", "start": 666661, "end": 677826, "audio": 0}, {"filename": "/data/script/linux/dialogs_ru.lua", "start": 677826, "end": 691004, "audio": 0}, {"filename": "/data/script/linux/dialogs_sv.lua", "start": 691004, "end": 702175, "audio": 0}, {"filename": "/data/script/linux/init.lua", "start": 702175, "end": 702819, "audio": 0}, {"filename": "/data/script/linux/models.lua", "start": 702819, "end": 705700, "audio": 0}, {"filename": "/data/sound/linux/cs/1-archlinux.ogg", "start": 705700, "end": 732320, "audio": 1}, {"filename": "/data/sound/linux/cs/1-balickovaci.ogg", "start": 732320, "end": 769478, "audio": 1}, {"filename": "/data/sound/linux/cs/1-dohnat.ogg", "start": 769478, "end": 796384, "audio": 1}, {"filename": "/data/sound/linux/cs/1-jazyka.ogg", "start": 796384, "end": 836067, "audio": 1}, {"filename": "/data/sound/linux/cs/1-nebavi.ogg", "start": 836067, "end": 856020, "audio": 1}, {"filename": "/data/sound/linux/cs/1-nepotrebuje.ogg", "start": 856020, "end": 900814, "audio": 1}, {"filename": "/data/sound/linux/cs/1-odpadnou.ogg", "start": 900814, "end": 943082, "audio": 1}, {"filename": "/data/sound/linux/cs/1-podruhe.ogg", "start": 943082, "end": 966991, "audio": 1}, {"filename": "/data/sound/linux/cs/1-pohodli.ogg", "start": 966991, "end": 1003641, "audio": 1}, {"filename": "/data/sound/linux/cs/1-prekonane.ogg", "start": 1003641, "end": 1047633, "audio": 1}, {"filename": "/data/sound/linux/cs/1-prvni.ogg", "start": 1047633, "end": 1073325, "audio": 1}, {"filename": "/data/sound/linux/cs/1-rozdil.ogg", "start": 1073325, "end": 1113190, "audio": 1}, {"filename": "/data/sound/linux/cs/1-rozhrani.ogg", "start": 1113190, "end": 1160307, "audio": 1}, {"filename": "/data/sound/linux/cs/1-trilobyte.ogg", "start": 1160307, "end": 1200400, "audio": 1}, {"filename": "/data/sound/linux/cs/1-ubuntu.ogg", "start": 1200400, "end": 1217618, "audio": 1}, {"filename": "/data/sound/linux/cs/1-wilber.ogg", "start": 1217618, "end": 1235819, "audio": 1}, {"filename": "/data/sound/linux/cs/1-zamaskovali.ogg", "start": 1235819, "end": 1278028, "audio": 1}, {"filename": "/data/sound/linux/cs/1-zkousel.ogg", "start": 1278028, "end": 1304399, "audio": 1}, {"filename": "/data/sound/linux/cs/2-abecedy.ogg", "start": 1304399, "end": 1328210, "audio": 1}, {"filename": "/data/sound/linux/cs/2-bubliny.ogg", "start": 1328210, "end": 1348871, "audio": 1}, {"filename": "/data/sound/linux/cs/2-C.ogg", "start": 1348871, "end": 1375988, "audio": 1}, {"filename": "/data/sound/linux/cs/2-hadi.ogg", "start": 1375988, "end": 1407315, "audio": 1}, {"filename": "/data/sound/linux/cs/2-maskot.ogg", "start": 1407315, "end": 1441754, "audio": 1}, {"filename": "/data/sound/linux/cs/2-naprogramovana.ogg", "start": 1441754, "end": 1477606, "audio": 1}, {"filename": "/data/sound/linux/cs/2-neni.ogg", "start": 1477606, "end": 1511284, "audio": 1}, {"filename": "/data/sound/linux/cs/2-nezaujata.ogg", "start": 1511284, "end": 1602855, "audio": 1}, {"filename": "/data/sound/linux/cs/2-pomala.ogg", "start": 1602855, "end": 1682913, "audio": 1}, {"filename": "/data/sound/linux/cs/2-postavene.ogg", "start": 1682913, "end": 1704066, "audio": 1}, {"filename": "/data/sound/linux/cs/2-prave.ogg", "start": 1704066, "end": 1721033, "audio": 1}, {"filename": "/data/sound/linux/cs/2-root.ogg", "start": 1721033, "end": 1779872, "audio": 1}, {"filename": "/data/sound/linux/cs/2-skriptik.ogg", "start": 1779872, "end": 1808815, "audio": 1}, {"filename": "/data/sound/linux/cs/2-slackware.ogg", "start": 1808815, "end": 1826958, "audio": 1}, {"filename": "/data/sound/linux/cs/2-svuj.ogg", "start": 1826958, "end": 1844952, "audio": 1}, {"filename": "/data/sound/linux/cs/2-trapnejsi.ogg", "start": 1844952, "end": 1878445, "audio": 1}, {"filename": "/data/sound/linux/cs/2-vykradacka.ogg", "start": 1878445, "end": 1932996, "audio": 1}, {"filename": "/data/sound/linux/cs/2-zapomel.ogg", "start": 1932996, "end": 1991567, "audio": 1}, {"filename": "/data/sound/linux/cs/m-linuxaci.ogg", "start": 1991567, "end": 2007357, "audio": 1}, {"filename": "/data/sound/linux/cs/m-nemyslis.ogg", "start": 2007357, "end": 2036114, "audio": 1}, {"filename": "/data/sound/linux/cs/m-nestaci.ogg", "start": 2036114, "end": 2057648, "audio": 1}, {"filename": "/data/sound/linux/cs/m-ostatni.ogg", "start": 2057648, "end": 2103795, "audio": 1}, {"filename": "/data/sound/linux/cs/m-radi.ogg", "start": 2103795, "end": 2139149, "audio": 1}, {"filename": "/data/sound/linux/cs/m-samem.ogg", "start": 2139149, "end": 2181705, "audio": 1}, {"filename": "/data/sound/linux/cs/m-sileny.ogg", "start": 2181705, "end": 2198548, "audio": 1}, {"filename": "/data/sound/linux/cs/m-tatinek.ogg", "start": 2198548, "end": 2235950, "audio": 1}, {"filename": "/data/sound/linux/cs/m-ukolem.ogg", "start": 2235950, "end": 2270092, "audio": 1}, {"filename": "/data/sound/linux/cs/m-vtipni.ogg", "start": 2270092, "end": 2306505, "audio": 1}, {"filename": "/data/sound/linux/cs/m-vykaslat.ogg", "start": 2306505, "end": 2362125, "audio": 1}, {"filename": "/data/sound/linux/cs/m-zadarmo.ogg", "start": 2362125, "end": 2383867, "audio": 1}, {"filename": "/data/sound/linux/cs/m-zamykali.ogg", "start": 2383867, "end": 2421096, "audio": 1}, {"filename": "/data/sound/linux/cs/v-alespon.ogg", "start": 2421096, "end": 2447657, "audio": 1}, {"filename": "/data/sound/linux/cs/v-argumenty.ogg", "start": 2447657, "end": 2476563, "audio": 1}, {"filename": "/data/sound/linux/cs/v-dole.ogg", "start": 2476563, "end": 2496047, "audio": 1}, {"filename": "/data/sound/linux/cs/v-forkovat.ogg", "start": 2496047, "end": 2540890, "audio": 1}, {"filename": "/data/sound/linux/cs/v-horydoly.ogg", "start": 2540890, "end": 2566869, "audio": 1}, {"filename": "/data/sound/linux/cs/v-kdojiny.ogg", "start": 2566869, "end": 2604453, "audio": 1}, {"filename": "/data/sound/linux/cs/v-musime.ogg", "start": 2604453, "end": 2629508, "audio": 1}, {"filename": "/data/sound/linux/cs/v-nabourali.ogg", "start": 2629508, "end": 2699891, "audio": 1}, {"filename": "/data/sound/linux/cs/v-osobne.ogg", "start": 2699891, "end": 2753701, "audio": 1}, {"filename": "/data/sound/linux/cs/v-prepinani.ogg", "start": 2753701, "end": 2795987, "audio": 1}, {"filename": "/data/sound/linux/cs/v-radeji.ogg", "start": 2795987, "end": 2840022, "audio": 1}, {"filename": "/data/sound/linux/cs/v-snazit.ogg", "start": 2840022, "end": 2955808, "audio": 1}, {"filename": "/data/sound/linux/cs/v-ven.ogg", "start": 2955808, "end": 2980537, "audio": 1}, {"filename": "/data/sound/linux/cs/v-vyrobil.ogg", "start": 2980537, "end": 3070047, "audio": 1}, {"filename": "/data/sound/linux/en/enter0.ogg", "start": 3070047, "end": 3075748, "audio": 1}, {"filename": "/data/sound/linux/en/enter10.ogg", "start": 3075748, "end": 3082890, "audio": 1}, {"filename": "/data/sound/linux/en/enter11.ogg", "start": 3082890, "end": 3089452, "audio": 1}, {"filename": "/data/sound/linux/en/enter12.ogg", "start": 3089452, "end": 3095345, "audio": 1}, {"filename": "/data/sound/linux/en/enter13.ogg", "start": 3095345, "end": 3102481, "audio": 1}, {"filename": "/data/sound/linux/en/enter1.ogg", "start": 3102481, "end": 3108137, "audio": 1}, {"filename": "/data/sound/linux/en/enter2.ogg", "start": 3108137, "end": 3113941, "audio": 1}, {"filename": "/data/sound/linux/en/enter3.ogg", "start": 3113941, "end": 3119791, "audio": 1}, {"filename": "/data/sound/linux/en/enter4.ogg", "start": 3119791, "end": 3125920, "audio": 1}, {"filename": "/data/sound/linux/en/enter5.ogg", "start": 3125920, "end": 3131973, "audio": 1}, {"filename": "/data/sound/linux/en/enter6.ogg", "start": 3131973, "end": 3137786, "audio": 1}, {"filename": "/data/sound/linux/en/enter7.ogg", "start": 3137786, "end": 3142906, "audio": 1}, {"filename": "/data/sound/linux/en/enter8.ogg", "start": 3142906, "end": 3149269, "audio": 1}, {"filename": "/data/sound/linux/en/enter9.ogg", "start": 3149269, "end": 3154807, "audio": 1}, {"filename": "/data/sound/linux/en/key0.ogg", "start": 3154807, "end": 3160696, "audio": 1}, {"filename": "/data/sound/linux/en/key10.ogg", "start": 3160696, "end": 3166316, "audio": 1}, {"filename": "/data/sound/linux/en/key11.ogg", "start": 3166316, "end": 3171872, "audio": 1}, {"filename": "/data/sound/linux/en/key12.ogg", "start": 3171872, "end": 3177401, "audio": 1}, {"filename": "/data/sound/linux/en/key13.ogg", "start": 3177401, "end": 3182978, "audio": 1}, {"filename": "/data/sound/linux/en/key14.ogg", "start": 3182978, "end": 3188531, "audio": 1}, {"filename": "/data/sound/linux/en/key15.ogg", "start": 3188531, "end": 3193884, "audio": 1}, {"filename": "/data/sound/linux/en/key16.ogg", "start": 3193884, "end": 3199338, "audio": 1}, {"filename": "/data/sound/linux/en/key17.ogg", "start": 3199338, "end": 3204797, "audio": 1}, {"filename": "/data/sound/linux/en/key18.ogg", "start": 3204797, "end": 3210344, "audio": 1}, {"filename": "/data/sound/linux/en/key19.ogg", "start": 3210344, "end": 3215894, "audio": 1}, {"filename": "/data/sound/linux/en/key1.ogg", "start": 3215894, "end": 3220910, "audio": 1}, {"filename": "/data/sound/linux/en/key20.ogg", "start": 3220910, "end": 3226582, "audio": 1}, {"filename": "/data/sound/linux/en/key21.ogg", "start": 3226582, "end": 3232205, "audio": 1}, {"filename": "/data/sound/linux/en/key22.ogg", "start": 3232205, "end": 3237779, "audio": 1}, {"filename": "/data/sound/linux/en/key23.ogg", "start": 3237779, "end": 3243277, "audio": 1}, {"filename": "/data/sound/linux/en/key24.ogg", "start": 3243277, "end": 3249146, "audio": 1}, {"filename": "/data/sound/linux/en/key25.ogg", "start": 3249146, "end": 3254602, "audio": 1}, {"filename": "/data/sound/linux/en/key26.ogg", "start": 3254602, "end": 3260022, "audio": 1}, {"filename": "/data/sound/linux/en/key27.ogg", "start": 3260022, "end": 3265240, "audio": 1}, {"filename": "/data/sound/linux/en/key28.ogg", "start": 3265240, "end": 3270734, "audio": 1}, {"filename": "/data/sound/linux/en/key29.ogg", "start": 3270734, "end": 3276461, "audio": 1}, {"filename": "/data/sound/linux/en/key2.ogg", "start": 3276461, "end": 3281793, "audio": 1}, {"filename": "/data/sound/linux/en/key3.ogg", "start": 3281793, "end": 3287535, "audio": 1}, {"filename": "/data/sound/linux/en/key4.ogg", "start": 3287535, "end": 3293002, "audio": 1}, {"filename": "/data/sound/linux/en/key5.ogg", "start": 3293002, "end": 3298482, "audio": 1}, {"filename": "/data/sound/linux/en/key6.ogg", "start": 3298482, "end": 3303317, "audio": 1}, {"filename": "/data/sound/linux/en/key7.ogg", "start": 3303317, "end": 3308740, "audio": 1}, {"filename": "/data/sound/linux/en/key8.ogg", "start": 3308740, "end": 3314196, "audio": 1}, {"filename": "/data/sound/linux/en/key9.ogg", "start": 3314196, "end": 3319597, "audio": 1}, {"filename": "/data/sound/linux/en/space0.ogg", "start": 3319597, "end": 3325715, "audio": 1}, {"filename": "/data/sound/linux/en/space10.ogg", "start": 3325715, "end": 3331631, "audio": 1}, {"filename": "/data/sound/linux/en/space11.ogg", "start": 3331631, "end": 3337185, "audio": 1}, {"filename": "/data/sound/linux/en/space12.ogg", "start": 3337185, "end": 3342700, "audio": 1}, {"filename": "/data/sound/linux/en/space13.ogg", "start": 3342700, "end": 3348734, "audio": 1}, {"filename": "/data/sound/linux/en/space14.ogg", "start": 3348734, "end": 3354346, "audio": 1}, {"filename": "/data/sound/linux/en/space15.ogg", "start": 3354346, "end": 3360215, "audio": 1}, {"filename": "/data/sound/linux/en/space16.ogg", "start": 3360215, "end": 3365762, "audio": 1}, {"filename": "/data/sound/linux/en/space17.ogg", "start": 3365762, "end": 3372058, "audio": 1}, {"filename": "/data/sound/linux/en/space1.ogg", "start": 3372058, "end": 3377960, "audio": 1}, {"filename": "/data/sound/linux/en/space2.ogg", "start": 3377960, "end": 3384183, "audio": 1}, {"filename": "/data/sound/linux/en/space3.ogg", "start": 3384183, "end": 3389994, "audio": 1}, {"filename": "/data/sound/linux/en/space4.ogg", "start": 3389994, "end": 3395946, "audio": 1}, {"filename": "/data/sound/linux/en/space5.ogg", "start": 3395946, "end": 3401845, "audio": 1}, {"filename": "/data/sound/linux/en/space6.ogg", "start": 3401845, "end": 3407764, "audio": 1}, {"filename": "/data/sound/linux/en/space7.ogg", "start": 3407764, "end": 3413604, "audio": 1}, {"filename": "/data/sound/linux/en/space8.ogg", "start": 3413604, "end": 3419809, "audio": 1}, {"filename": "/data/sound/linux/en/space9.ogg", "start": 3419809, "end": 3425775, "audio": 1}, {"filename": "/data/sound/linux/nl/m-linuxaci.ogg", "start": 3425775, "end": 3445466, "audio": 1}, {"filename": "/data/sound/linux/nl/m-nemyslis.ogg", "start": 3445466, "end": 3471082, "audio": 1}, {"filename": "/data/sound/linux/nl/m-nestaci.ogg", "start": 3471082, "end": 3491149, "audio": 1}, {"filename": "/data/sound/linux/nl/m-ostatni.ogg", "start": 3491149, "end": 3515528, "audio": 1}, {"filename": "/data/sound/linux/nl/m-radi.ogg", "start": 3515528, "end": 3545241, "audio": 1}, {"filename": "/data/sound/linux/nl/m-samem.ogg", "start": 3545241, "end": 3574129, "audio": 1}, {"filename": "/data/sound/linux/nl/m-sileny.ogg", "start": 3574129, "end": 3593368, "audio": 1}, {"filename": "/data/sound/linux/nl/m-tatinek.ogg", "start": 3593368, "end": 3620935, "audio": 1}, {"filename": "/data/sound/linux/nl/m-ukolem.ogg", "start": 3620935, "end": 3650892, "audio": 1}, {"filename": "/data/sound/linux/nl/m-vtipni.ogg", "start": 3650892, "end": 3676820, "audio": 1}, {"filename": "/data/sound/linux/nl/m-vykaslat.ogg", "start": 3676820, "end": 3714682, "audio": 1}, {"filename": "/data/sound/linux/nl/m-zadarmo.ogg", "start": 3714682, "end": 3736614, "audio": 1}, {"filename": "/data/sound/linux/nl/m-zamykali.ogg", "start": 3736614, "end": 3769453, "audio": 1}, {"filename": "/data/sound/linux/nl/v-alespon.ogg", "start": 3769453, "end": 3789306, "audio": 1}, {"filename": "/data/sound/linux/nl/v-argumenty.ogg", "start": 3789306, "end": 3809675, "audio": 1}, {"filename": "/data/sound/linux/nl/v-dole.ogg", "start": 3809675, "end": 3827856, "audio": 1}, {"filename": "/data/sound/linux/nl/v-forkovat.ogg", "start": 3827856, "end": 3855569, "audio": 1}, {"filename": "/data/sound/linux/nl/v-horydoly.ogg", "start": 3855569, "end": 3878690, "audio": 1}, {"filename": "/data/sound/linux/nl/v-kdojiny.ogg", "start": 3878690, "end": 3901438, "audio": 1}, {"filename": "/data/sound/linux/nl/v-musime.ogg", "start": 3901438, "end": 3920545, "audio": 1}, {"filename": "/data/sound/linux/nl/v-nabourali.ogg", "start": 3920545, "end": 3951003, "audio": 1}, {"filename": "/data/sound/linux/nl/v-osobne.ogg", "start": 3951003, "end": 3979058, "audio": 1}, {"filename": "/data/sound/linux/nl/v-prepinani.ogg", "start": 3979058, "end": 4000999, "audio": 1}, {"filename": "/data/sound/linux/nl/v-radeji.ogg", "start": 4000999, "end": 4022874, "audio": 1}, {"filename": "/data/sound/linux/nl/v-snazit.ogg", "start": 4022874, "end": 4061627, "audio": 1}, {"filename": "/data/sound/linux/nl/v-ven.ogg", "start": 4061627, "end": 4086667, "audio": 1}, {"filename": "/data/sound/linux/nl/v-vyrobil.ogg", "start": 4086667, "end": 4133153, "audio": 1}], "remote_package_size": 4133153, "package_uuid": "6b9d97c4-6389-4cde-8611-b391ae3df1f3"});

})();
