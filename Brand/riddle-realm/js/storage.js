/**
 * Riddle Realm — Storage Module (Phase 4)
 * Safe LocalStorage wrapper with full player progression model.
 */
const Storage = (function () {
  'use strict';

  const KEYS = {
    SETTINGS: 'rr_settings',
    PLAYER: 'rr_player',
    GUEST_KEY: 'rr_guest_key'
  };

  const DEFAULT_SETTINGS = {
    theme: 'dark',
    sfx: true,
    music: true,
    haptic: true,
    textSize: 'medium',      // small | medium | large
    reducedMotion: false,
    highContrast: false
  };

  const DEFAULT_PLAYER = {
    name: 'Riddler',
    level: 1,
    xp: 0,
    xpNeeded: 100,          // First level is reachable quickly
    coins: 0,
    hearts: 5,
    maxHearts: 5,
    totalSolved: 0,
    totalCorrect: 0,
    totalWrong: 0,
    bestStreak: 0,
    currentStreak: 0,
    bestScore: 0,           // Best single-session score
    gamesPlayed: 0,
    totalXpEarned: 0,       // Lifetime XP (never decreases)
    totalCoinsEarned: 0
  };

  // Rank titles by level
  const RANKS = [
    { min: 1,  title: 'Novice Thinker' },
    { min: 3,  title: 'Curious Mind' },
    { min: 5,  title: 'Sharp Solver' },
    { min: 8,  title: 'Logic Apprentice' },
    { min: 12, title: 'Riddle Hunter' },
    { min: 18, title: 'Puzzle Adept' },
    { min: 25, title: 'Master Thinker' },
    { min: 35, title: 'Realm Champion' },
    { min: 50, title: 'Legend of Riddles' }
  ];

  function safeParse(raw, fallback) {
    try {
      if (!raw) return structuredClone(fallback);
      const data = JSON.parse(raw);
      return { ...fallback, ...data };
    } catch (e) {
      console.warn('[Storage] Parse failed, using defaults', e);
      return structuredClone(fallback);
    }
  }

  function loadSettings() {
    return safeParse(localStorage.getItem(KEYS.SETTINGS), DEFAULT_SETTINGS);
  }

  function saveSettings(partial) {
    const current = loadSettings();
    const next = { ...current, ...partial };
    localStorage.setItem(KEYS.SETTINGS, JSON.stringify(next));
    return next;
  }

  /**
   * Stable anonymous guest id for server daily/share APIs.
   * Not a login — just a device-local opaque key.
   */
  function getGuestKey() {
    try {
      let key = localStorage.getItem(KEYS.GUEST_KEY);
      if (key && /^[a-zA-Z0-9_-]{12,64}$/.test(key)) return key;
      key =
        'g_' +
        Date.now().toString(36) +
        '_' +
        Math.random().toString(36).slice(2, 12) +
        Math.random().toString(36).slice(2, 8);
      localStorage.setItem(KEYS.GUEST_KEY, key);
      return key;
    } catch (e) {
      return 'g_fallback_' + String(Date.now());
    }
  }

  function loadPlayer() {
    return safeParse(localStorage.getItem(KEYS.PLAYER), DEFAULT_PLAYER);
  }

  function savePlayer(partial) {
    const current = loadPlayer();
    const next = { ...current, ...partial };
    // Sanity clamps
    next.coins = Math.max(0, Number(next.coins) || 0);
    next.hearts = Math.max(0, Math.min(next.maxHearts || 5, Number(next.hearts) || 0));
    next.xp = Math.max(0, Number(next.xp) || 0);
    next.level = Math.max(1, Number(next.level) || 1);
    next.xpNeeded = Math.max(50, Number(next.xpNeeded) || 100);
    next.totalSolved = Math.max(0, Number(next.totalSolved) || 0);
    next.totalCorrect = Math.max(0, Number(next.totalCorrect) || 0);
    next.totalWrong = Math.max(0, Number(next.totalWrong) || 0);
    next.bestStreak = Math.max(0, Number(next.bestStreak) || 0);
    next.currentStreak = Math.max(0, Number(next.currentStreak) || 0);
    next.bestScore = Math.max(0, Number(next.bestScore) || 0);
    next.gamesPlayed = Math.max(0, Number(next.gamesPlayed) || 0);
    next.totalXpEarned = Math.max(0, Number(next.totalXpEarned) || 0);
    next.totalCoinsEarned = Math.max(0, Number(next.totalCoinsEarned) || 0);
    localStorage.setItem(KEYS.PLAYER, JSON.stringify(next));
    return next;
  }

  function resetPlayer() {
    localStorage.setItem(KEYS.PLAYER, JSON.stringify(DEFAULT_PLAYER));
    return structuredClone(DEFAULT_PLAYER);
  }

  function getRank(level) {
    let title = RANKS[0].title;
    for (const r of RANKS) {
      if (level >= r.min) title = r.title;
    }
    return title;
  }

  /**
   * XP required for a given level (simple curve)
   */
  function xpForLevel(level) {
    // Level 1→2: 100, then climbs through 100 Arena levels
    let needed = 100;
    const cap = Math.min(Math.max(1, Number(level) || 1), 100);
    for (let i = 1; i < cap; i++) {
      needed = Math.floor(needed * 1.12) + 15;
    }
    return needed;
  }

  /**
   * Apply XP gain and handle level-ups.
   * Returns { player, leveledUp, levelsGained }
   */
  function addXp(amount) {
    const player = loadPlayer();
    let xp = (player.xp || 0) + amount;
    let level = player.level || 1;
    let xpNeeded = player.xpNeeded || xpForLevel(level);
    let levelsGained = 0;

    while (xp >= xpNeeded) {
      xp -= xpNeeded;
      level += 1;
      levelsGained += 1;
      xpNeeded = xpForLevel(level);
    }

    const updated = savePlayer({
      xp,
      level,
      xpNeeded,
      totalXpEarned: (player.totalXpEarned || 0) + amount
    });

    return { player: updated, leveledUp: levelsGained > 0, levelsGained };
  }

  function addCoins(amount) {
    const player = loadPlayer();
    return savePlayer({
      coins: (player.coins || 0) + amount,
      totalCoinsEarned: (player.totalCoinsEarned || 0) + amount
    });
  }

  function getAccuracy(player) {
    const p = player || loadPlayer();
    if (!p.totalSolved) return null;
    return Math.round((p.totalCorrect / p.totalSolved) * 100);
  }

  return {
    loadSettings,
    saveSettings,
    loadPlayer,
    savePlayer,
    getGuestKey,
    resetPlayer,
    getRank,
    xpForLevel,
    addXp,
    addCoins,
    getAccuracy,
    DEFAULT_PLAYER,
    DEFAULT_SETTINGS,
    RANKS
  };
})();
