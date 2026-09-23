/**
 * Riddle Realm — Meta Pixel (Phase 18A)
 * =====================================
 * Marketing analytics ONLY. Separate from js/analytics.js (gameplay).
 * Pixel ID from Meta: 1045975441458918
 * Does not load until marketing consent is granted (when required).
 * Never fires Purchase without server verification path.
 */
const MetaPixel = (function () {
  'use strict';

  // Official Pixel ID provided by the product owner — do not invent another.
  const PIXEL_ID = '1045975441458918';
  const CONSENT_KEY = 'rr_marketing_consent';

  let initialized = false;
  let scriptInjected = false;

  function getConsent() {
    try {
      const v = localStorage.getItem(CONSENT_KEY);
      // null = not chosen yet; 'granted' | 'denied'
      return v;
    } catch (e) {
      return 'denied';
    }
  }

  function setConsent(value) {
    try {
      localStorage.setItem(CONSENT_KEY, value === 'granted' ? 'granted' : 'denied');
    } catch (e) { /* ignore */ }
    if (value === 'granted') {
      init();
    }
  }

  function hasConsent() {
    return getConsent() === 'granted';
  }

  /**
   * Inject Meta base snippet (matches official Meta structure).
   * Only runs after consent is granted.
   */
  function injectBase() {
    if (scriptInjected || typeof document === 'undefined') return;
    if (!hasConsent()) return;

    // Official fbq bootstrap
    /* eslint-disable */
    !(function (f, b, e, v, n, t, s) {
      if (f.fbq) return;
      n = f.fbq = function () {
        n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
      };
      if (!f._fbq) f._fbq = n;
      n.push = n;
      n.loaded = !0;
      n.version = '2.0';
      n.queue = [];
      t = b.createElement(e);
      t.async = !0;
      t.src = v;
      s = b.getElementsByTagName(e)[0];
      s.parentNode.insertBefore(t, s);
    })(window, document, 'script', 'https://connect.facebook.net/en_US/fbevents.js');
    /* eslint-enable */

    // Noscript fallback image
    if (!document.getElementById('meta-pixel-noscript')) {
      var ns = document.createElement('noscript');
      ns.id = 'meta-pixel-noscript';
      ns.innerHTML =
        '<img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=' +
        PIXEL_ID +
        '&ev=PageView&noscript=1" alt="" />';
      document.body.appendChild(ns);
    }

    scriptInjected = true;
  }

  function init() {
    if (initialized) return;
    if (!hasConsent()) return;
    injectBase();
    if (typeof window.fbq !== 'function') {
      // fbq queues until script loads
    }
    try {
      window.fbq('init', PIXEL_ID);
      window.fbq('track', 'PageView');
      initialized = true;
    } catch (e) {
      console.warn('[MetaPixel] init failed', e);
    }
  }

  /**
   * Track a standard or custom event. No-op without consent.
   * @param {string} eventName
   * @param {object} [params] — never include secrets or PII
   * @param {object} [options] — { eventID } for deduplication
   */
  function track(eventName, params, options) {
    if (!hasConsent()) return false;
    if (!initialized) init();
    if (typeof window.fbq !== 'function') return false;

    try {
      const safe = sanitizeParams(params || {});
      if (options && options.eventID) {
        window.fbq('track', eventName, safe, { eventID: options.eventID });
      } else {
        window.fbq('track', eventName, safe);
      }
      return true;
    } catch (e) {
      console.warn('[MetaPixel] track failed', e);
      return false;
    }
  }

  function trackCustom(eventName, params, options) {
    if (!hasConsent()) return false;
    if (!initialized) init();
    if (typeof window.fbq !== 'function') return false;
    try {
      const safe = sanitizeParams(params || {});
      if (options && options.eventID) {
        window.fbq('trackCustom', eventName, safe, { eventID: options.eventID });
      } else {
        window.fbq('trackCustom', eventName, safe);
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  /** Strip anything that must never leave the device */
  function sanitizeParams(obj) {
    const blocked = /password|token|secret|card|cvv|iban|ssn|email|phone|address/i;
    const out = {};
    Object.keys(obj).forEach(function (k) {
      if (blocked.test(k)) return;
      var v = obj[k];
      if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
        out[k] = v;
      }
    });
    return out;
  }

  function uniqueEventId(prefix) {
    return (
      (prefix || 'rr') +
      '_' +
      Date.now().toString(36) +
      '_' +
      Math.random().toString(36).slice(2, 10)
    );
  }

  // ---- Marketing event helpers (safe surface for the app) ----

  function pageView() {
    return track('PageView');
  }

  function viewContent(content) {
    return track('ViewContent', {
      content_name: content && content.name,
      content_category: content && content.category,
      content_type: (content && content.type) || 'product'
    });
  }

  /** Premium interest / start of paid flow */
  function initiateCheckout(info) {
    const eventID = uniqueEventId('checkout');
    track(
      'InitiateCheckout',
      {
        content_name: (info && info.name) || 'Riddle Realm Pro',
        content_category: 'premium',
        currency: (info && info.currency) || 'USD',
        value: info && typeof info.value === 'number' ? info.value : undefined
      },
      { eventID: eventID }
    );
    return eventID;
  }

  /**
   * Purchase — ONLY call after backend/payment provider confirms payment.
   * Frontend must not invent success.
   */
  function purchaseVerified(info, eventID) {
    if (!info || !info.verifiedByServer) {
      console.warn('[MetaPixel] Purchase blocked — server verification required');
      return false;
    }
    return track(
      'Purchase',
      {
        content_name: info.name || 'Riddle Realm Pro',
        currency: info.currency || 'USD',
        value: typeof info.value === 'number' ? info.value : 0
      },
      { eventID: eventID || uniqueEventId('purchase') }
    );
  }

  function gameStartMarketing() {
    return trackCustom('GameStart', { content_name: 'Riddle Realm' });
  }

  function premiumInterest() {
    return trackCustom('PremiumInterest', { content_name: 'Riddle Realm Pro' });
  }

  function getStatus() {
    return {
      pixelId: PIXEL_ID,
      consent: getConsent(),
      initialized: initialized,
      scriptInjected: scriptInjected
    };
  }

  return {
    PIXEL_ID: PIXEL_ID,
    getConsent: getConsent,
    setConsent: setConsent,
    hasConsent: hasConsent,
    init: init,
    track: track,
    trackCustom: trackCustom,
    pageView: pageView,
    viewContent: viewContent,
    initiateCheckout: initiateCheckout,
    purchaseVerified: purchaseVerified,
    gameStartMarketing: gameStartMarketing,
    premiumInterest: premiumInterest,
    getStatus: getStatus,
    uniqueEventId: uniqueEventId
  };
})();
