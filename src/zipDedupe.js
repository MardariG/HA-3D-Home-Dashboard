/**
 * In-flight deduplication for ZIPTools.getZIP.
 *
 * Upstream ZIPTools caches only COMPLETED zips (ZIPTools.openedZips). While
 * a zip is still downloading, every additional getZIP call for the same URL
 * starts another full XMLHttpRequest. During home loading, hundreds of
 * embedded contents (models, textures, icons) all point into the home zip,
 * which produced hundreds of parallel multi-megabyte downloads of the same
 * file (observed: ~15 GB transferred to open one 12 MB home).
 *
 * This wrapper keeps a single download per URL and queues the other
 * observers until it settles. It must run AFTER the vendor scripts have
 * defined the global ZIPTools (bundle scripts are injected at the end of
 * <body> with blocking loading, so that ordering holds for both pages).
 */
export function installZipRequestDeduplication() {
  var ZIPTools = window.ZIPTools;
  if (!ZIPTools || ZIPTools.__dedupeInstalled) {
    return;
  }
  ZIPTools.__dedupeInstalled = true;

  var pendingObservers = {};
  var originalGetZIP = ZIPTools.getZIP;
  var originalClear = ZIPTools.clear;

  ZIPTools.getZIP = function (url, synchronous, zipObserver) {
    if (zipObserver === undefined) {
      zipObserver = synchronous;
      synchronous = false;
    }
    if (synchronous || (url in ZIPTools.openedZips)) {
      // Synchronous calls and cache hits keep the original behavior
      return originalGetZIP.call(ZIPTools, url, synchronous, zipObserver);
    }
    if (url in pendingObservers) {
      // Same zip already downloading: wait for it instead of re-fetching
      pendingObservers[url].push(zipObserver);
      return;
    }
    pendingObservers[url] = [zipObserver];
    var settle = function (callbackName, argument) {
      var observers = pendingObservers[url];
      delete pendingObservers[url];
      if (observers) {
        for (var i = 0; i < observers.length; i++) {
          if (observers[i][callbackName] !== undefined) {
            observers[i][callbackName](argument);
          }
        }
      }
    };
    originalGetZIP.call(ZIPTools, url, false, {
      zipReady: function (zip) {
        settle('zipReady', zip);
      },
      zipError: function (error) {
        settle('zipError', error);
      },
      progression: function (part, info, percentage) {
        var observers = pendingObservers[url];
        if (observers) {
          for (var i = 0; i < observers.length; i++) {
            if (observers[i].progression !== undefined) {
              observers[i].progression(part, info, percentage);
            }
          }
        }
      }
    });
  };

  ZIPTools.clear = function () {
    // Aborted requests never notify their observers; drop the queues so a
    // later getZIP for the same URL starts a fresh download.
    pendingObservers = {};
    return originalClear.call(ZIPTools);
  };
}
