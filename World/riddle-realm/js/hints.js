/**
 * Riddle Realm — Hint System (Phase 8)
 * =====================================
 * Configurable hints paid with coins.
 * Types: reveal_letter | remove_options | extra_clue | skip
 */
const Hints = (function () {
  'use strict';

  // Configurable costs & effects
  const CONFIG = {
    // Economy tuning (Phase 9):
    // ~5 coins per correct answer → clue ≈ 2 solves, letter ≈ 3, 50/50 ≈ 5, skip ≈ 8
    extra_clue: {
      id: 'extra_clue',
      label: 'Clue',
      emoji: '💡',
      cost: 8,
      description: 'Show the riddle hint'
    },
    reveal_letter: {
      id: 'reveal_letter',
      label: 'Reveal Letter',
      emoji: '🔤',
      cost: 12,
      description: 'Reveal one letter of the answer'
    },
    remove_options: {
      id: 'remove_options',
      label: '50/50',
      emoji: '✂️',
      cost: 18,
      description: 'Remove two wrong options'
    },
    skip: {
      id: 'skip',
      label: 'Skip',
      emoji: '⏭️',
      cost: 35,
      description: 'Skip this riddle (no points)'
    }
  };

  const STATS_KEY = 'rr_hint_stats';

  /**
   * Per-riddle usage tracking (resets each riddle)
   * { revealedIndexes: number[], removedOptions: string[], clueShown: bool, skipped: bool }
   */
  let usage = resetUsage();

  function resetUsage() {
    return {
      revealedIndexes: [],
      removedOptions: [],
      clueShown: false,
      skipped: false
    };
  }

  function onNewRiddle() {
    usage = resetUsage();
  }

  function getConfig() {
    return { ...CONFIG };
  }

  function canAfford(type) {
    const cfg = CONFIG[type];
    if (!cfg) return false;
    // Free pack charge counts as affordable
    if (typeof Shop !== 'undefined') {
      const free = Shop.getFreeHints();
      if ((free[type] || 0) > 0) return true;
    }
    const player = Storage.loadPlayer();
    return (player.coins || 0) >= cfg.cost;
  }

  function spend(type) {
    const cfg = CONFIG[type];
    if (!cfg) return { ok: false, reason: 'invalid' };

    // Prefer free pack charges
    if (typeof Shop !== 'undefined' && Shop.useFreeHint(type)) {
      _recordStat(type);
      const player = Storage.loadPlayer();
      return { ok: true, cost: 0, free: true, remaining: player.coins || 0 };
    }

    const player = Storage.loadPlayer();
    if ((player.coins || 0) < cfg.cost) {
      return { ok: false, reason: 'not_enough_coins', cost: cfg.cost };
    }
    Storage.savePlayer({ coins: player.coins - cfg.cost });
    _recordStat(type);
    return { ok: true, cost: cfg.cost, remaining: player.coins - cfg.cost };
  }

  function _recordStat(type) {
    try {
      const raw = localStorage.getItem(STATS_KEY);
      const stats = raw ? JSON.parse(raw) : { total: 0, byType: {} };
      stats.total = (stats.total || 0) + 1;
      stats.byType = stats.byType || {};
      stats.byType[type] = (stats.byType[type] || 0) + 1;
      stats.coinsSpent = (stats.coinsSpent || 0) + (CONFIG[type] ? CONFIG[type].cost : 0);
      stats.lastUsed = Date.now();
      localStorage.setItem(STATS_KEY, JSON.stringify(stats));
    } catch (e) { /* ignore */ }
  }

  function getStats() {
    try {
      const raw = localStorage.getItem(STATS_KEY);
      const stats = raw ? JSON.parse(raw) : {};
      return {
        total: stats.total || 0,
        coinsSpent: stats.coinsSpent || 0,
        byType: {
          extra_clue: (stats.byType && stats.byType.extra_clue) || 0,
          reveal_letter: (stats.byType && stats.byType.reveal_letter) || 0,
          remove_options: (stats.byType && stats.byType.remove_options) || 0,
          skip: (stats.byType && stats.byType.skip) || 0
        },
        lastUsed: stats.lastUsed || null
      };
    } catch (e) {
      return { total: 0, coinsSpent: 0, byType: {}, lastUsed: null };
    }
  }

  /**
   * Reveal one unrevealed letter from the answer
   */
  function revealLetter(riddle) {
    if (!riddle) return { ok: false, reason: 'no_riddle' };
    if (!canAfford('reveal_letter')) return { ok: false, reason: 'not_enough_coins', cost: CONFIG.reveal_letter.cost };

    const answer = String(riddle.answer);
    const letters = [];
    for (let i = 0; i < answer.length; i++) {
      if (/[a-zA-Z0-9]/.test(answer[i]) && !usage.revealedIndexes.includes(i)) {
        letters.push(i);
      }
    }
    if (!letters.length) return { ok: false, reason: 'all_revealed' };

    const spendResult = spend('reveal_letter');
    if (!spendResult.ok) return spendResult;

    const idx = letters[Math.floor(Math.random() * letters.length)];
    usage.revealedIndexes.push(idx);

    // Build masked display: e _ h o
    const display = answer.split('').map((ch, i) => {
      if (!/[a-zA-Z0-9]/.test(ch)) return ch;
      return usage.revealedIndexes.includes(i) ? ch.toUpperCase() : '_';
    }).join(' ');

    return {
      ok: true,
      type: 'reveal_letter',
      cost: spendResult.cost,
      free: !!spendResult.free,
      remaining: spendResult.remaining,
      index: idx,
      letter: answer[idx],
      display,
      revealedIndexes: [...usage.revealedIndexes]
    };
  }

  /**
   * Remove up to 2 incorrect options
   */
  function removeOptions(riddle) {
    if (!riddle || !Array.isArray(riddle.options)) {
      return { ok: false, reason: 'no_options' };
    }
    if (!canAfford('remove_options')) {
      return { ok: false, reason: 'not_enough_coins', cost: CONFIG.remove_options.cost };
    }

    const correctNorm = Riddles.normalize(riddle.answer);
    const wrong = riddle.options.filter(opt => {
      const n = Riddles.normalize(opt);
      return n !== correctNorm && !usage.removedOptions.includes(opt);
    });

    if (wrong.length === 0) return { ok: false, reason: 'none_left' };

    const spendResult = spend('remove_options');
    if (!spendResult.ok) return spendResult;

    // Remove up to 2
    const toRemove = [];
    const shuffled = [...wrong].sort(() => Math.random() - 0.5);
    for (let i = 0; i < Math.min(2, shuffled.length); i++) {
      toRemove.push(shuffled[i]);
      usage.removedOptions.push(shuffled[i]);
    }

    return {
      ok: true,
      type: 'remove_options',
      cost: spendResult.cost,
      free: !!spendResult.free,
      remaining: spendResult.remaining,
      removed: toRemove,
      allRemoved: [...usage.removedOptions]
    };
  }

  /**
   * Show the riddle's hint text
   */
  function extraClue(riddle) {
    if (!riddle) return { ok: false, reason: 'no_riddle' };
    if (usage.clueShown) return { ok: false, reason: 'already_shown' };
    if (!riddle.hint) return { ok: false, reason: 'no_hint' };
    if (!canAfford('extra_clue')) {
      return { ok: false, reason: 'not_enough_coins', cost: CONFIG.extra_clue.cost };
    }

    const spendResult = spend('extra_clue');
    if (!spendResult.ok) return spendResult;

    usage.clueShown = true;
    return {
      ok: true,
      type: 'extra_clue',
      cost: spendResult.cost,
      free: !!spendResult.free,
      remaining: spendResult.remaining,
      hint: riddle.hint
    };
  }

  /**
   * Skip current riddle (no XP/coins, counts as neither correct nor wrong for score)
   */
  function skip(riddle) {
    if (!riddle) return { ok: false, reason: 'no_riddle' };
    if (!canAfford('skip')) {
      return { ok: false, reason: 'not_enough_coins', cost: CONFIG.skip.cost };
    }

    const spendResult = spend('skip');
    if (!spendResult.ok) return spendResult;

    usage.skipped = true;
    return {
      ok: true,
      type: 'skip',
      cost: spendResult.cost,
      free: !!spendResult.free,
      remaining: spendResult.remaining
    };
  }

  function getUsage() {
    return { ...usage, removedOptions: [...usage.removedOptions], revealedIndexes: [...usage.revealedIndexes] };
  }

  /**
   * Apply a hint by type
   */
  function use(type, riddle) {
    switch (type) {
      case 'reveal_letter': return revealLetter(riddle);
      case 'remove_options': return removeOptions(riddle);
      case 'extra_clue': return extraClue(riddle);
      case 'skip': return skip(riddle);
      default: return { ok: false, reason: 'invalid' };
    }
  }

  return {
    CONFIG,
    getConfig,
    canAfford,
    use,
    revealLetter,
    removeOptions,
    extraClue,
    skip,
    onNewRiddle,
    getUsage,
    resetUsage,
    getStats
  };
})();
