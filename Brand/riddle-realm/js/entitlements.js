/**
 * Riddle Realm — Entitlements (Phase 22)
 * Free AI: 20 requests / calendar day (local date).
 * Pro features require verified entitlement (future payment) or Demo Pro (dev only).
 * localStorage.plan / isPro alone is NOT trusted as payment proof for security claims.
 */
const Entitlements = (function () {
  'use strict';

  const DEMO_KEY = 'rr_demo_pro';
  const USAGE_KEY = 'rr_ai_usage';

  const LIMITS = {
    free: {
      aiDaily: 20,
      features: {
        core_game: true,
        daily_challenge: true,
        basic_hints: true,
        ai_hint: true,
        ai_explain: true,
        ai_ask: true,
        ai_practice: false,
        ai_advanced_hint: false,
        ai_personalized: false,
        premium_cosmetics: false,
        premium_categories: false,
        advanced_stats: false,
        canCreateBasicMultiplayer: true,
        canCreateAdvancedMultiplayer: false,
        canCreateBasicBattle: true,
        canCreateAdvancedBattle: false
      }
    },
    pro: {
      aiDaily: 200,
      features: {
        core_game: true,
        daily_challenge: true,
        basic_hints: true,
        ai_hint: true,
        ai_explain: true,
        ai_ask: true,
        ai_practice: true,
        ai_advanced_hint: true,
        ai_personalized: true,
        premium_cosmetics: true,
        premium_categories: true,
        advanced_stats: true,
        canCreateBasicMultiplayer: true,
        canCreateAdvancedMultiplayer: true,
        canCreateBasicBattle: true,
        canCreateAdvancedBattle: true
      }
    }
  };

  function todayKey() {
    const d = new Date();
    return (
      d.getFullYear() +
      '-' +
      String(d.getMonth() + 1).padStart(2, '0') +
      '-' +
      String(d.getDate()).padStart(2, '0')
    );
  }

  function isVerifiedPro() {
    try {
      return typeof Shop !== 'undefined' && Shop.isVerifiedPro && Shop.isVerifiedPro() === true;
    } catch (e) {
      return false;
    }
  }

  function isDemoPro() {
    try {
      return localStorage.getItem(DEMO_KEY) === '1';
    } catch (e) {
      return false;
    }
  }

  function setDemoPro(enabled) {
    try {
      if (enabled) localStorage.setItem(DEMO_KEY, '1');
      else localStorage.removeItem(DEMO_KEY);
    } catch (e) {}
  }

  function getPlan() {
    if (isVerifiedPro() || isDemoPro()) return 'pro';
    return 'free';
  }

  function isPro() {
    return getPlan() === 'pro';
  }

  function hasFeature(feature) {
    const plan = getPlan();
    return !!(LIMITS[plan].features[feature]);
  }

  function getDailyLimit() {
    return LIMITS[getPlan()].aiDaily;
  }

  function loadUsage() {
    try {
      const raw = localStorage.getItem(USAGE_KEY);
      if (!raw) return { date: todayKey(), count: 0, byType: {} };
      const data = JSON.parse(raw);
      if (data.date !== todayKey()) return { date: todayKey(), count: 0, byType: {} };
      return data;
    } catch (e) {
      return { date: todayKey(), count: 0, byType: {} };
    }
  }

  function saveUsage(u) {
    try {
      localStorage.setItem(USAGE_KEY, JSON.stringify(u));
    } catch (e) {}
  }

  function getRemainingUsage() {
    return Math.max(0, getDailyLimit() - (loadUsage().count || 0));
  }

  function getUsage() {
    const u = loadUsage();
    return {
      date: u.date,
      used: u.count || 0,
      limit: getDailyLimit(),
      remaining: getRemainingUsage(),
      byType: u.byType || {},
      plan: getPlan()
    };
  }

  function getUsageDisplay() {
    const u = getUsage();
    return u.used + ' / ' + u.limit;
  }

  function consumeAiUsage(requestType) {
    if (getRemainingUsage() <= 0) {
      if (typeof Analytics !== 'undefined') {
        Analytics.track('ai_limit_reached', { plan: getPlan() });
      }
      return { ok: false, reason: 'limit_reached', remaining: 0, limit: getDailyLimit() };
    }
    const u = loadUsage();
    u.count = (u.count || 0) + 1;
    u.byType = u.byType || {};
    u.byType[requestType || 'unknown'] = (u.byType[requestType || 'unknown'] || 0) + 1;
    saveUsage(u);
    if (typeof Analytics !== 'undefined') {
      Analytics.track('ai_request', { type: requestType, plan: getPlan(), used: u.count, limit: getDailyLimit() });
    }
    return { ok: true, remaining: getRemainingUsage(), used: u.count, limit: getDailyLimit() };
  }

  function getLimits() {
    return {
      free: { aiDaily: LIMITS.free.aiDaily },
      pro: { aiDaily: LIMITS.pro.aiDaily }
    };
  }

  function getStatus() {
    return {
      plan: getPlan(),
      isPro: isPro(),
      isVerifiedPro: isVerifiedPro(),
      isDemoPro: isDemoPro(),
      usage: getUsage(),
      limits: getLimits(),
      note: isDemoPro()
        ? 'DEMO PRO (development only) — not a real payment'
        : isVerifiedPro()
          ? 'Verified Pro (payment path)'
          : 'Free plan — 20 AI requests / day'
    };
  }

  return {
    LIMITS: LIMITS,
    getPlan: getPlan,
    isPro: isPro,
    isVerifiedPro: isVerifiedPro,
    isDemoPro: isDemoPro,
    setDemoPro: setDemoPro,
    hasFeature: hasFeature,
    getDailyLimit: getDailyLimit,
    getRemainingUsage: getRemainingUsage,
    getUsage: getUsage,
    getUsageDisplay: getUsageDisplay,
    consumeAiUsage: consumeAiUsage,
    getLimits: getLimits,
    getStatus: getStatus
  };
})();
