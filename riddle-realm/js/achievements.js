/**
 * Riddle Realm — Achievements (Phase 9)
 * ======================================
 * Expandable badge system. Check after gameplay events.
 */
const Achievements = (function () {
  'use strict';

  const KEY = 'rr_achievements';

  /**
   * Definition list — add new ones here only.
   * type: counter key on player / custom
   * target: number to reach
   * reward: { xp, coins }
   */
  const DEFS = [
    {
      id: 'first_game',
      name: 'First Game',
      description: 'Finish your first Riddle Game session',
      emoji: '🎮',
      type: 'gamesPlayed',
      target: 1,
      reward: { xp: 15, coins: 5 }
    },
    {
      id: 'first_solve',
      name: 'First Spark',
      description: 'Solve your first riddle',
      emoji: '🌟',
      type: 'totalCorrect',
      target: 1,
      reward: { xp: 20, coins: 10 }
    },
    {
      id: 'correct_10',
      name: 'Getting Warm',
      description: 'Answer 10 riddles correctly',
      emoji: '🔥',
      type: 'totalCorrect',
      target: 10,
      reward: { xp: 40, coins: 20 }
    },
    {
      id: 'correct_50',
      name: 'Sharp Mind',
      description: 'Answer 50 riddles correctly',
      emoji: '🧠',
      type: 'totalCorrect',
      target: 50,
      reward: { xp: 100, coins: 50 }
    },
    {
      id: 'correct_100',
      name: 'Century Club',
      description: 'Answer 100 riddles correctly',
      emoji: '💯',
      type: 'totalCorrect',
      target: 100,
      reward: { xp: 200, coins: 100 }
    },
    {
      id: 'streak_5',
      name: 'On a Roll',
      description: 'Reach a 5-answer streak',
      emoji: '⚡',
      type: 'bestStreak',
      target: 5,
      reward: { xp: 30, coins: 15 }
    },
    {
      id: 'streak_15',
      name: 'Unstoppable',
      description: 'Reach a 15-answer streak',
      emoji: '🚀',
      type: 'bestStreak',
      target: 15,
      reward: { xp: 80, coins: 40 }
    },
    {
      id: 'daily_streak_3',
      name: 'Habit Former',
      description: 'Complete 3 daily challenges in a row',
      emoji: '📅',
      type: 'dailyStreak',
      target: 3,
      reward: { xp: 50, coins: 25 }
    },
    {
      id: 'daily_streak_7',
      name: 'Week Warrior',
      description: 'Complete 7 daily challenges in a row',
      emoji: '🏆',
      type: 'dailyStreak',
      target: 7,
      reward: { xp: 120, coins: 60 }
    },
    {
      id: 'games_10',
      name: 'Regular',
      description: 'Play 10 games',
      emoji: '🎮',
      type: 'gamesPlayed',
      target: 10,
      reward: { xp: 40, coins: 20 }
    },
    {
      id: 'games_50',
      name: 'Dedicated',
      description: 'Play 50 games',
      emoji: '🏅',
      type: 'gamesPlayed',
      target: 50,
      reward: { xp: 150, coins: 75 }
    },
    {
      id: 'level_5',
      name: 'Rising Star',
      description: 'Reach level 5',
      emoji: '⭐',
      type: 'level',
      target: 5,
      reward: { xp: 50, coins: 30 }
    },
    {
      id: 'level_10',
      name: 'Riddle Adept',
      description: 'Reach level 10',
      emoji: '🎖️',
      type: 'level',
      target: 10,
      reward: { xp: 120, coins: 60 }
    },
    {
      id: 'perfect_accuracy_20',
      name: 'Precision',
      description: 'Solve 20+ riddles with 90%+ accuracy',
      emoji: '🎯',
      type: 'custom',
      target: 1,
      reward: { xp: 80, coins: 40 }
    },
    {
      id: 'hints_used_5',
      name: 'Hint Explorer',
      description: 'Use hints 5 times',
      emoji: '💡',
      type: 'hintsUsed',
      target: 5,
      reward: { xp: 25, coins: 15 }
    },
    {
      id: 'coins_500',
      name: 'Treasure Hunter',
      description: 'Earn 500 coins lifetime',
      emoji: '🪙',
      type: 'totalCoinsEarned',
      target: 500,
      reward: { xp: 60, coins: 0 }
    }
  ];

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return { unlocked: {}, claimed: {} };
      const data = JSON.parse(raw);
      return {
        unlocked: data.unlocked || {},
        claimed: data.claimed || {}
      };
    } catch (e) {
      return { unlocked: {}, claimed: {} };
    }
  }

  function save(state) {
    localStorage.setItem(KEY, JSON.stringify(state));
  }

  function getPlayerMetric(type, player, extras) {
    if (type === 'dailyStreak') {
      return (extras && extras.dailyStreak) || 0;
    }
    if (type === 'hintsUsed') {
      return (extras && extras.hintsUsed) || getHintStats().total || 0;
    }
    if (type === 'custom') {
      // perfect accuracy check
      if (player.totalSolved >= 20) {
        const acc = player.totalCorrect / player.totalSolved;
        return acc >= 0.9 ? 1 : 0;
      }
      return 0;
    }
    return Number(player[type]) || 0;
  }

  function getHintStats() {
    try {
      const raw = localStorage.getItem('rr_hint_stats');
      return raw ? JSON.parse(raw) : { total: 0 };
    } catch (e) {
      return { total: 0 };
    }
  }

  /**
   * Check all achievements against current player state.
   * Returns list of newly unlocked achievement defs.
   */
  function check(extras = {}) {
    const player = Storage.loadPlayer();
    const state = load();
    const newly = [];

    // Enrich extras with daily streak if available
    if (typeof Daily !== 'undefined' && extras.dailyStreak == null) {
      extras.dailyStreak = Daily.getStatus().streak || 0;
    }
    if (extras.hintsUsed == null) {
      extras.hintsUsed = getHintStats().total || 0;
    }

    const allDefs = getAllDefs(player);
    for (const def of allDefs) {
      if (state.unlocked[def.id]) continue;
      const value = getPlayerMetric(def.type, player, extras);
      if (value >= def.target) {
        state.unlocked[def.id] = {
          at: Date.now(),
          value
        };
        newly.push(def);
      }
    }

    if (newly.length) save(state);
    return newly;
  }

  /**
   * Claim reward for an unlocked achievement
   */
  function claim(id) {
    const state = load();
    if (!state.unlocked[id]) return { ok: false, reason: 'locked' };
    if (state.claimed[id]) return { ok: false, reason: 'already_claimed' };

    const def = getAllDefs().find(d => d.id === id);
    if (!def) return { ok: false, reason: 'invalid' };

    if (def.reward.xp) Storage.addXp(def.reward.xp);
    if (def.reward.coins) Storage.addCoins(def.reward.coins);

    state.claimed[id] = Date.now();
    save(state);

    return { ok: true, def, reward: def.reward };
  }

  /**
   * Full list for UI
   */
  function getAll(extras = {}) {
    const player = Storage.loadPlayer();
    const state = load();
    if (typeof Daily !== 'undefined' && extras.dailyStreak == null) {
      extras.dailyStreak = Daily.getStatus().streak || 0;
    }
    extras.hintsUsed = extras.hintsUsed != null ? extras.hintsUsed : (getHintStats().total || 0);

    return getAllDefs(player).map(def => {
      const value = getPlayerMetric(def.type, player, extras);
      const unlocked = !!state.unlocked[def.id];
      const claimed = !!state.claimed[def.id];
      const progress = Math.min(100, Math.floor((value / def.target) * 100));
      return {
        ...def,
        value,
        progress,
        unlocked,
        claimed,
        locked: !unlocked
      };
    });
  }

  /**
   * Progressive milestones that keep growing as the player advances.
   * Generated from player stats so the list never "runs out".
   */
  function getProgressiveDefs(player) {
    const defs = [];
    const correct = player.totalCorrect || 0;
    const games = player.gamesPlayed || 0;
    const level = player.level || 1;
    const streak = player.bestStreak || 0;

    /**
     * Moderate ladder: fixed milestones + at most 2 steps ahead of the player.
     * Grows with play without flooding the achievements list.
     */
    function ladder(prefix, emoji, type, baseTargets, nameFn, descFn, rewardFn) {
      const current = type === 'level' ? level
        : type === 'bestStreak' ? streak
        : type === 'gamesPlayed' ? games
        : correct;

      const targets = baseTargets.slice();
      let last = targets[targets.length - 1] || 10;
      // Only add up to 2 future milestones beyond current progress
      let ahead = 0;
      while (ahead < 2) {
        last = Math.ceil(last * 2);
        if (last <= current && ahead === 0) {
          // still behind player — keep extending until we pass them, but cap total extras
          targets.push(last);
          if (targets.length > baseTargets.length + 6) break;
          continue;
        }
        if (last > current) {
          targets.push(last);
          ahead++;
        } else {
          targets.push(last);
        }
        if (targets.length > baseTargets.length + 8) break;
      }

      // De-dupe and sort
      const unique = [...new Set(targets)].sort((a, b) => a - b);
      unique.forEach(t => {
        defs.push({
          id: prefix + '_' + t,
          name: nameFn(t),
          description: descFn(t),
          emoji,
          type,
          target: t,
          reward: rewardFn(t),
          progressive: true
        });
      });
    }

    // Leaner base milestones — not too sparse, not too plentiful
    ladder('pc', '🌟', 'totalCorrect',
      [1, 10, 25, 50, 100, 250, 500, 1000],
      t => t === 1 ? 'First Spark' : t + ' Correct',
      t => 'Answer ' + t + ' riddles correctly',
      t => ({ xp: Math.min(400, 20 + Math.floor(t / 3)), coins: Math.min(200, 10 + Math.floor(t / 5)) })
    );
    ladder('pg', '🎮', 'gamesPlayed',
      [5, 15, 30, 75, 150],
      t => t + ' Games',
      t => 'Finish ' + t + ' game sessions',
      t => ({ xp: Math.min(300, 25 + t), coins: Math.min(150, 12 + Math.floor(t / 2)) })
    );
    ladder('pl', '⭐', 'level',
      [3, 5, 10, 20, 35, 50],
      t => 'Level ' + t,
      t => 'Reach level ' + t,
      t => ({ xp: Math.min(250, 30 + t * 2), coins: Math.min(180, 15 + t) })
    );
    ladder('ps', '🔥', 'bestStreak',
      [5, 10, 20, 40],
      t => t + '-Streak',
      t => 'Reach a ' + t + '-answer streak',
      t => ({ xp: Math.min(280, 25 + t * 2), coins: Math.min(160, 12 + t) })
    );

    return defs;
  }

  function getAllDefs(player) {
    return DEFS.concat(getProgressiveDefs(player || Storage.loadPlayer()));
  }

  function getUnlockedCount() {
    const state = load();
    return Object.keys(state.unlocked).length;
  }

  return {
    DEFS,
    check,
    claim,
    getAll,
    getUnlockedCount,
    load
  };
})();
