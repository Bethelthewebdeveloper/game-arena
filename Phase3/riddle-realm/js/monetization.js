/**
 * Riddle Realm — Monetization (Phase 23)
 * Display pricing + future payment adapter hooks.
 * NO payment provider integrated. Upgrade never grants Pro.
 */
const Monetization = (function () {
  'use strict';

  function productFromPricing() {
    const p =
      typeof Pricing !== 'undefined'
        ? Pricing.getDisplayPrices()
        : { currency: 'USD', monthly: 4.99, yearly: 49.99, monthlyLabel: '$4.99/month', yearlyLabel: '$49.99/year' };
    return {
      id: 'rr_pro',
      name: 'Riddle Realm Pro',
      description: 'Premium cosmetics and expanded AI. Cosmetics only — no pay-to-win.',
      currency: p.currency,
      displayPrice: p.monthlyLabel,
      monthlyLabel: p.monthlyLabel,
      yearlyLabel: p.yearlyLabel,
      yearlyValueNote: p.yearlyValueNote || '',
      monthly: p.monthly,
      yearly: p.yearly,
      value: p.monthly,
      disclaimer: p.disclaimer || 'Payment is not connected yet.'
    };
  }

  function isPro() {
    if (typeof Entitlements !== 'undefined' && Entitlements.isPro) return Entitlements.isPro();
    return typeof Shop !== 'undefined' && Shop.isVerifiedPro && Shop.isVerifiedPro();
  }

  function onPremiumInterest(source) {
    const product = productFromPricing();
    if (typeof MetaPixel !== 'undefined') {
      MetaPixel.viewContent({
        name: product.name,
        category: 'premium',
        type: 'product'
      });
    }
    if (typeof Analytics !== 'undefined') {
      Analytics.track('pro_modal_open', { source: source || 'unknown' });
    }
    return { ok: true, product: product, source: source || 'unknown' };
  }

  /**
   * Upgrade intent. Does NOT start real checkout.
   * Does NOT fire InitiateCheckout (no checkout system yet).
   * Does NOT grant Pro. Does NOT fire Purchase.
   */
  function startCheckout() {
    const product = productFromPricing();
    if (typeof Analytics !== 'undefined') {
      Analytics.track('pro_upgrade_click', {});
    }
    return {
      ok: true,
      paymentReady: false,
      sessionId: null,
      product: product,
      message: 'Secure payment is not available yet. Payment will be connected in a future phase.'
    };
  }

  function grantProAfterVerifiedPayment(verification) {
    if (!verification || !verification.verifiedByServer) {
      return {
        ok: false,
        reason: 'verification_required',
        message: 'Pro is granted only after server/payment verification.'
      };
    }
    if (typeof Shop !== 'undefined' && Shop.setPro) {
      Shop.setPro(true);
    }
    if (typeof MetaPixel !== 'undefined' && verification.firePurchase) {
      MetaPixel.purchaseVerified(
        {
          verifiedByServer: true,
          name: 'Riddle Realm Pro',
          currency: verification.currency || 'USD',
          value: verification.value
        },
        verification.eventID
      );
    }
    return { ok: true, isPro: true };
  }

  function onProItemBlocked(item) {
    onPremiumInterest(item && item.kind ? item.kind : 'shop');
    return {
      ok: false,
      reason: 'pro_required',
      product: productFromPricing(),
      item: item || null,
      message: 'This item is part of Riddle Realm Pro.'
    };
  }

  function getProduct() {
    return productFromPricing();
  }

  function getStatus() {
    const pricing = typeof Pricing !== 'undefined' ? Pricing.getStatus() : null;
    return {
      isPro: isPro(),
      product: getProduct(),
      paymentReady: false,
      pricing: pricing,
      note: 'Store/web payments not connected yet. Pro cosmetics stay locked until verified unlock.'
    };
  }

  return {
    isPro: isPro,
    onPremiumInterest: onPremiumInterest,
    startCheckout: startCheckout,
    grantProAfterVerifiedPayment: grantProAfterVerifiedPayment,
    onProItemBlocked: onProItemBlocked,
    getProduct: getProduct,
    getStatus: getStatus
  };
})();
