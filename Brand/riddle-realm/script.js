/**
 * Riddle Realm — Boot (Phase 14)
 * Fast, defensive startup.
 */
(function () {
  'use strict';

  var REQUIRED = ['Storage', 'Riddles', 'Game', 'UI'];

  function missingModules() {
    return REQUIRED.filter(function (n) {
      return typeof window[n] === 'undefined' && typeof eval(n) === 'undefined';
    });
  }

  function boot() {
    // Module presence (globals from script tags)
    var needed = ['Storage', 'Riddles', 'Game', 'UI'];
    for (var i = 0; i < needed.length; i++) {
      try {
        if (typeof eval(needed[i]) === 'undefined') {
          console.error('[Riddle Realm] Missing module:', needed[i]);
          return;
        }
      } catch (e) {
        console.error('[Riddle Realm] Missing module:', needed[i]);
        return;
      }
    }

    try {
      UI.init();
    } catch (err) {
      console.error('[Riddle Realm] Init failed:', err);
      // Still try to show the app shell
      var splash = document.getElementById('splash');
      var app = document.getElementById('app');
      if (splash) splash.classList.add('hidden');
      if (app) app.classList.remove('hidden');
      return;
    }

    UI.runSplash(function () {
      if (typeof console !== 'undefined' && console.log) {
        console.log(
          '%cRiddle Realm %cPhase 26 ready — daily riddle & share analytics',
          'color:#a78bfa;font-weight:bold',
          'color:#67e8f9'
        );
        if (typeof Riddles !== 'undefined') {
          console.log('Riddles loaded:', Riddles.count());
        }
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
  } else {
    boot();
  }
})();


/* Register service worker for offline / installable PWA */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch((err) => {
      console.warn('SW registration failed', err);
    });
  });
}
