/**
 * Riddle Realm — Pricing (Phase 23)
 * DISPLAY-ONLY. No payments are processed.
 * Regional amounts are CONFIGURED values, not live FX quotes.
 */
const Pricing = (function () {
  'use strict';

  const BASE = {
    currency: 'USD',
    symbol: '$',
    monthly: 4.99,
    yearly: 49.99
  };

  /**
   * Configured regional list prices (not auto-converted).
   * Add/edit entries here; do not invent live exchange rates.
   * Amounts are integers or decimals in local major units.
   */
  const REGIONAL = {
    USD: { currency: 'USD', symbol: '$', monthly: 4.99, yearly: 49.99, locales: ['en-US', 'en'] },
    NGN: { currency: 'NGN', symbol: '₦', monthly: 7500, yearly: 75000, locales: ['en-NG', 'ha-NG', 'yo-NG', 'ig-NG'] },
    GBP: { currency: 'GBP', symbol: '£', monthly: 3.99, yearly: 39.99, locales: ['en-GB'] },
    EUR: { currency: 'EUR', symbol: '€', monthly: 4.99, yearly: 49.99, locales: ['de', 'fr', 'es', 'it', 'nl', 'pt', 'fi', 'el'] },
    CAD: { currency: 'CAD', symbol: 'CA$', monthly: 6.99, yearly: 69.99, locales: ['en-CA', 'fr-CA'] },
    AUD: { currency: 'AUD', symbol: 'A$', monthly: 7.99, yearly: 79.99, locales: ['en-AU'] }
  };

  function detectCurrency() {
    try {
      const lang = String(navigator.language || navigator.userLanguage || 'en-US').toLowerCase();
      const region = lang.indexOf('-') !== -1 ? lang.split('-').pop() : '';
      // Region code first (more reliable than language alone)
      if (region === 'ng') return 'NGN';
      if (region === 'gb' || region === 'uk') return 'GBP';
      if (region === 'ca') return 'CAD';
      if (region === 'au') return 'AUD';
      if (['de','fr','es','it','nl','pt','fi','el','at','be','ie'].indexOf(region) !== -1) return 'EUR';
      if (region === 'us') return 'USD';
      // Locale list match
      const keys = Object.keys(REGIONAL);
      for (var i = 0; i < keys.length; i++) {
        const locs = REGIONAL[keys[i]].locales || [];
        for (var j = 0; j < locs.length; j++) {
          if (lang === String(locs[j]).toLowerCase()) return keys[i];
        }
      }
      if (/^(de|fr|es|it|nl|pt|fi|el)/.test(lang)) return 'EUR';
    } catch (e) {}
    return 'USD';
  }

  function getConfig(currencyCode) {
    const code = String(currencyCode || detectCurrency()).toUpperCase();
    if (REGIONAL[code]) return Object.assign({}, REGIONAL[code]);
    return Object.assign({}, REGIONAL.USD);
  }

  function formatAmount(amount, currency) {
    const cfg = getConfig(currency);
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency',
        currency: cfg.currency,
        maximumFractionDigits: cfg.currency === 'NGN' ? 0 : 2
      }).format(amount);
    } catch (e) {
      return cfg.symbol + amount;
    }
  }

  function getDisplayPrices(currencyCode) {
    const cfg = getConfig(currencyCode);
    const monthlyLabel = formatAmount(cfg.monthly, cfg.currency) + '/month';
    const yearlyLabel = formatAmount(cfg.yearly, cfg.currency) + '/year';
    const yearlyMonthly = cfg.yearly / 12;
    return {
      currency: cfg.currency,
      symbol: cfg.symbol,
      monthly: cfg.monthly,
      yearly: cfg.yearly,
      monthlyLabel: monthlyLabel,
      yearlyLabel: yearlyLabel,
      yearlyValueNote: 'Better value · ~' + formatAmount(yearlyMonthly, cfg.currency) + '/month',
      isFallbackUsd: cfg.currency === 'USD',
      disclaimer: 'Prices shown in your local currency where configured. Display only — payment is not connected.',
      base: { monthly: BASE.monthly, yearly: BASE.yearly, currency: BASE.currency }
    };
  }

  function getSupportedCurrencies() {
    return Object.keys(REGIONAL).map(function (k) {
      const c = REGIONAL[k];
      return { currency: c.currency, symbol: c.symbol, monthly: c.monthly, yearly: c.yearly };
    });
  }

  function getStatus() {
    const display = getDisplayPrices();
    return {
      paymentConnected: false,
      providers: {
        paystack: 'NOT CONNECTED',
        flutterwave: 'NOT CONNECTED',
        moniepoint: 'NOT CONNECTED',
        stripe: 'NOT CONNECTED'
      },
      base: BASE,
      display: display,
      supported: getSupportedCurrencies()
    };
  }

  return {
    BASE: BASE,
    REGIONAL: REGIONAL,
    detectCurrency: detectCurrency,
    getConfig: getConfig,
    getDisplayPrices: getDisplayPrices,
    getSupportedCurrencies: getSupportedCurrencies,
    formatAmount: formatAmount,
    getStatus: getStatus
  };
})();
