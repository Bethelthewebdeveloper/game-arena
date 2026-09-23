/**
 * Riddle Realm — Shop (Phase 22)
 * Curated Free (coin) + Pro cosmetics. No pay-to-win.
 * isPro is NEVER set by Upgrade clicks — only verified payment path later.
 */
const Shop = (function () {
  'use strict';

  const KEY = 'rr_shop';

  /** Curated catalog — quality over quantity */
  const CATALOG = {
    themes: [
      { id: 'theme_midnight', name: 'Midnight', emoji: '🌙', cost: 0, tier: 'free', hue: 250, desc: 'Deep purple night' },
      { id: 'theme_daylight', name: 'Daylight', emoji: '☀️', cost: 0, tier: 'free', hue: 45, desc: 'Bright warm day' },
      { id: 'theme_ocean', name: 'Ocean', emoji: '🌊', cost: 500, tier: 'coin', hue: 200, desc: 'Cool sea blues' },
      { id: 'theme_forest', name: 'Forest', emoji: '🌲', cost: 450, tier: 'coin', hue: 140, desc: 'Green canopy' },
      { id: 'theme_sunset', name: 'Sunset', emoji: '🌅', cost: 550, tier: 'coin', hue: 20, desc: 'Orange dusk' },
      { id: 'theme_ember', name: 'Ember', emoji: '🔥', cost: 600, tier: 'coin', hue: 10, desc: 'Warm fire tones' },
      { id: 'theme_mint', name: 'Mint', emoji: '🍃', cost: 400, tier: 'coin', hue: 160, desc: 'Fresh mint' },
      { id: 'theme_sand', name: 'Sand', emoji: '🏖️', cost: 350, tier: 'coin', hue: 35, desc: 'Desert sand' },
      { id: 'theme_aurora', name: 'Aurora', emoji: '🌌', cost: 0, tier: 'pro', hue: 280, desc: 'Northern lights' },
      { id: 'theme_neon', name: 'Neon City', emoji: '🌃', cost: 0, tier: 'pro', hue: 310, desc: 'Electric neon' },
      { id: 'theme_royal', name: 'Royal', emoji: '👑', cost: 0, tier: 'pro', hue: 270, desc: 'Regal violet' },
      { id: 'theme_glacier', name: 'Glacier', emoji: '❄️', cost: 0, tier: 'pro', hue: 190, desc: 'Icy blue' },
      { id: 'theme_crimson', name: 'Crimson', emoji: '🌹', cost: 0, tier: 'pro', hue: 0, desc: 'Deep red' },
      { id: 'theme_jade', name: 'Jade', emoji: '💎', cost: 0, tier: 'pro', hue: 155, desc: 'Jade green' }
    ],
    avatars: [
      { id: 'av_wizard', name: 'Wizard', emoji: '🧙', cost: 0, tier: 'free', desc: 'Starter avatar' },
      { id: 'av_owl', name: 'Owl', emoji: '🦉', cost: 0, tier: 'free', desc: 'Wise starter' },
      { id: 'av_fox', name: 'Fox', emoji: '🦊', cost: 300, tier: 'coin', desc: 'Clever fox' },
      { id: 'av_bot', name: 'Bot', emoji: '🤖', cost: 350, tier: 'coin', desc: 'Logic bot' },
      { id: 'av_star', name: 'Star', emoji: '⭐', cost: 250, tier: 'coin', desc: 'Bright star' },
      { id: 'av_panda', name: 'Panda', emoji: '🐼', cost: 400, tier: 'coin', desc: 'Calm panda' },
      { id: 'av_lion', name: 'Lion', emoji: '🦁', cost: 450, tier: 'coin', desc: 'Bold lion' },
      { id: 'av_dolphin', name: 'Dolphin', emoji: '🐬', cost: 380, tier: 'coin', desc: 'Swift dolphin' },
      { id: 'av_drake', name: 'Drake', emoji: '🐉', cost: 0, tier: 'pro', desc: 'Pro dragon' },
      { id: 'av_royal', name: 'Royal', emoji: '👑', cost: 0, tier: 'pro', desc: 'Pro crown' },
      { id: 'av_unicorn', name: 'Unicorn', emoji: '🦄', cost: 0, tier: 'pro', desc: 'Pro unicorn' },
      { id: 'av_phoenix', name: 'Phoenix', emoji: '🔥', cost: 0, tier: 'pro', desc: 'Pro phoenix' },
      { id: 'av_crystal', name: 'Crystal', emoji: '💎', cost: 0, tier: 'pro', desc: 'Pro crystal' },
      { id: 'av_rocket', name: 'Rocket', emoji: '🚀', cost: 0, tier: 'pro', desc: 'Pro rocket' }
    ],
    packs: [
      { id: 'pack_clue_3', name: '3× Extra Clues', emoji: '💡', cost: 200, tier: 'coin', type: 'extra_clue', amount: 3, desc: '3 free clue uses' },
      { id: 'pack_letter_3', name: '3× Reveal Letter', emoji: '🔤', cost: 250, tier: 'coin', type: 'reveal_letter', amount: 3, desc: '3 letter reveals' },
      { id: 'pack_5050_3', name: '3× Remove Options', emoji: '✂️', cost: 300, tier: 'coin', type: 'remove_options', amount: 3, desc: '3 fifty-fifty uses' },
      { id: 'pack_clue_5', name: '5× Extra Clues', emoji: '💡', cost: 320, tier: 'coin', type: 'extra_clue', amount: 5, desc: '5 free clue uses' },
      { id: 'pack_mixed', name: 'Starter Hint Bundle', emoji: '🧰', cost: 400, tier: 'coin', type: 'extra_clue', amount: 2, desc: '2 clues (bundle entry)' },
      { id: 'pack_pro_clue', name: 'Pro Clue Pack ×10', emoji: '✨', cost: 0, tier: 'pro', type: 'extra_clue', amount: 10, desc: 'Pro: 10 clues' },
      { id: 'pack_pro_letter', name: 'Pro Letter Pack ×10', emoji: '✨', cost: 0, tier: 'pro', type: 'reveal_letter', amount: 10, desc: 'Pro: 10 letters' },
      { id: 'pack_pro_5050', name: 'Pro 50/50 Pack ×10', emoji: '✨', cost: 0, tier: 'pro', type: 'remove_options', amount: 10, desc: 'Pro: 10 fifty-fifties' },
      { id: 'pack_pro_mega', name: 'Pro Mega Hints ×15', emoji: '👑', cost: 0, tier: 'pro', type: 'extra_clue', amount: 15, desc: 'Pro mega pack' }
    ]
  };

  function defaultState() {
    return {
      owned: { theme_midnight: true, theme_daylight: true, av_wizard: true, av_owl: true },
      equipped: { theme: 'theme_midnight', avatar: 'av_wizard' },
      freeHints: { extra_clue: 0, reveal_letter: 0, remove_options: 0 },
      isPro: false
    };
  }

  /** Map Phase-15 procedural IDs → Phase-22 curated IDs */
  const LEGACY_MAP = {
    theme_0: 'theme_midnight',
    theme_1: 'theme_daylight',
    av_0: 'av_wizard',
    av_1: 'av_owl'
  };

  function migrateId(id) {
    if (!id) return id;
    if (LEGACY_MAP[id]) return LEGACY_MAP[id];
    return id;
  }

  function knownId(id) {
    if (!id) return false;
    const list = CATALOG.themes.concat(CATALOG.avatars).concat(CATALOG.packs);
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return true;
    }
    return false;
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defaultState();
      const data = JSON.parse(raw);
      const base = defaultState();
      const ownedIn = data.owned || {};
      const owned = Object.assign({}, base.owned);
      Object.keys(ownedIn).forEach(function (k) {
        if (ownedIn[k]) {
          const nk = migrateId(k);
          if (knownId(nk) || nk.indexOf('pack_') === 0) owned[nk] = true;
        }
      });
      const eqIn = data.equipped || {};
      let theme = migrateId(eqIn.theme) || base.equipped.theme;
      let avatar = migrateId(eqIn.avatar) || base.equipped.avatar;
      if (!knownId(theme)) theme = base.equipped.theme;
      if (!knownId(avatar)) avatar = base.equipped.avatar;
      return {
        owned: owned,
        equipped: { theme: theme, avatar: avatar },
        freeHints: Object.assign({}, base.freeHints, data.freeHints || {}),
        isPro: !!data.isPro
      };
    } catch (e) {
      return defaultState();
    }
  }

  function save(state) {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {}
  }

  function allItems() {
    return CATALOG.themes
      .concat(CATALOG.avatars)
      .concat(CATALOG.packs)
      .map(function (it) {
        return Object.assign({ kind: it.id.indexOf('theme_') === 0 ? 'theme' : it.id.indexOf('av_') === 0 ? 'avatar' : 'pack' }, it);
      });
  }

  function findItem(id) {
    const list = allItems();
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return null;
  }

  /** Verified Pro only — never Demo Pro (Demo handled by Entitlements for UI testing). */
  function isVerifiedPro() {
    return !!load().isPro;
  }

  function isPro() {
    if (typeof Entitlements !== 'undefined' && Entitlements.isPro) {
      return Entitlements.isPro();
    }
    return isVerifiedPro();
  }

  /**
   * ONLY call after real payment / server verification.
   * Upgrade button must NOT call this.
   */
  function setPro(flag) {
    const state = load();
    state.isPro = !!flag;
    save(state);
    return state.isPro;
  }

  function getByKind(kind, tierFilter) {
    const map = { theme: 'themes', avatar: 'avatars', pack: 'packs' };
    const key = map[kind] || kind;
    let list = (CATALOG[key] || []).map(function (it) {
      return Object.assign({ kind: kind }, it);
    });
    if (tierFilter === 'coin' || tierFilter === 'free') {
      list = list.filter(function (it) {
        return it.tier === 'free' || it.tier === 'coin';
      });
    } else if (tierFilter === 'pro') {
      list = list.filter(function (it) {
        return it.tier === 'pro';
      });
    }
    return list;
  }

  function getPage(kind, options) {
    options = options || {};
    const tier = options.tier || 'all';
    const items = getByKind(kind, tier === 'all' ? null : tier);
    return {
      items: items,
      page: 0,
      pageSize: items.length,
      total: items.length,
      totalPages: 1,
      tier: tier,
      coinLimit: items.filter(function (i) {
        return i.tier !== 'pro';
      }).length,
      catalogSize: allItems().length
    };
  }

  function getCatalog() {
    return {
      themes: getByKind('theme'),
      avatars: getByKind('avatar'),
      packs: getByKind('pack')
    };
  }

  function counts() {
    function split(kind) {
      const all = getByKind(kind);
      return {
        free: all.filter(function (i) {
          return i.tier === 'free' || i.tier === 'coin';
        }).length,
        pro: all.filter(function (i) {
          return i.tier === 'pro';
        }).length
      };
    }
    return { themes: split('theme'), avatars: split('avatar'), packs: split('pack'), total: allItems().length };
  }

  function isOwned(id) {
    return !!load().owned[id];
  }

  function buy(id) {
    const state = load();
    const item = findItem(id);
    if (!item) return { ok: false, reason: 'not_found' };
    if (item.kind !== 'pack' && state.owned[id]) return { ok: false, reason: 'already_owned', item: item };
    if (item.tier === 'pro' && !isPro()) return { ok: false, reason: 'pro_required', item: item };

    if (item.tier !== 'pro' && item.cost > 0) {
      const player = Storage.loadPlayer();
      if ((player.coins || 0) < item.cost) {
        return {
          ok: false,
          reason: 'not_enough_coins',
          cost: item.cost,
          have: player.coins || 0,
          item: item
        };
      }
      Storage.savePlayer({ coins: (player.coins || 0) - item.cost });
      if (typeof Analytics !== 'undefined') {
        Analytics.track('coins_spent', { amount: item.cost, itemId: item.id, kind: item.kind });
        Analytics.track('shop_unlock', { itemId: item.id, kind: item.kind, cost: item.cost });
      }
    }

    if (item.kind === 'pack') {
      state.freeHints[item.type] = (state.freeHints[item.type] || 0) + (item.amount || 1);
    } else {
      state.owned[item.id] = true;
    }
    save(state);
    return {
      ok: true,
      item: item,
      category: item.kind === 'pack' ? 'packs' : item.kind + 's',
      remaining: Storage.loadPlayer().coins || 0
    };
  }

  function equip(id) {
    const state = load();
    const item = findItem(id);
    if (!item || (item.kind !== 'theme' && item.kind !== 'avatar')) {
      return { ok: false, reason: 'not_found' };
    }
    if (item.tier === 'pro' && !isPro()) return { ok: false, reason: 'pro_required', item: item };
    if (!state.owned[item.id] && item.tier !== 'free') return { ok: false, reason: 'not_owned' };
    if (item.kind === 'theme') {
      state.equipped.theme = item.id;
      state.owned[item.id] = true;
      save(state);
      return { ok: true, type: 'theme', id: item.id, item: item };
    }
    state.equipped.avatar = item.id;
    state.owned[item.id] = true;
    save(state);
    return { ok: true, type: 'avatar', id: item.id, item: item };
  }

  function getEquipped() {
    return load().equipped;
  }

  function getAvatarEmoji() {
    const eq = getEquipped().avatar || 'av_wizard';
    const item = findItem(eq);
    return (item && item.emoji) || '🧙';
  }

  function getThemeHue() {
    const eq = getEquipped().theme || 'theme_midnight';
    const item = findItem(eq);
    return item && typeof item.hue === 'number' ? item.hue : null;
  }

  function useFreeHint(type) {
    const state = load();
    if ((state.freeHints[type] || 0) > 0) {
      state.freeHints[type] -= 1;
      save(state);
      return true;
    }
    return false;
  }

  function getFreeHints() {
    return Object.assign({}, load().freeHints);
  }

  function getState() {
    const state = load();
    return {
      owned: Object.assign({}, state.owned),
      equipped: Object.assign({}, state.equipped),
      freeHints: Object.assign({}, state.freeHints),
      isPro: isPro(),
      isVerifiedPro: isVerifiedPro(),
      counts: counts()
    };
  }

  function getItem(kind, index) {
    const list = getByKind(kind);
    return list[index] || null;
  }

  return {
    getCatalog: getCatalog,
    getPage: getPage,
    getItem: getItem,
    findItem: findItem,
    isOwned: isOwned,
    buy: buy,
    equip: equip,
    getEquipped: getEquipped,
    getAvatarEmoji: getAvatarEmoji,
    getThemeHue: getThemeHue,
    useFreeHint: useFreeHint,
    getFreeHints: getFreeHints,
    getState: getState,
    isPro: isPro,
    isVerifiedPro: isVerifiedPro,
    setPro: setPro,
    counts: counts,
    CATALOG: CATALOG
  };
})();
