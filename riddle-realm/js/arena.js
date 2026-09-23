/**
 * Game Arena — shared player progression for every future game.
 * Wraps existing Storage XP / coins / level. No fake values.
 */
const Arena = (function () {
  'use strict';

  const GAMES = [
    {
      id: 'riddle',
      title: 'Riddle Game',
      emoji: '🧩',
      status: 'live',
      blurb: 'Classic, timed, and daily riddles. The first Arena game.',
      screen: 'home'
    },
    {
      id: 'coming-word',
      title: 'Word Clash',
      emoji: '🔤',
      status: 'soon',
      blurb: 'Coming Soon'
    },
    {
      id: 'coming-quiz',
      title: 'Trivia Rush',
      emoji: '⚡',
      status: 'soon',
      blurb: 'Coming Soon'
    }
  ];

  function player() {
    return typeof Storage !== 'undefined' ? Storage.loadPlayer() : {};
  }

  function profile() {
    const p = player();
    const rank = typeof Storage !== 'undefined' && Storage.getRank ? Storage.getRank(p.level || 1) : '';
    return {
      name: p.name || 'Player',
      level: p.level || 1,
      xp: p.xp || 0,
      xpNeeded: p.xpNeeded || 100,
      coins: p.coins || 0,
      streak: p.currentStreak || 0,
      bestStreak: p.bestStreak || 0,
      gamesPlayed: p.gamesPlayed || 0,
      totalCorrect: p.totalCorrect || 0,
      bestScore: p.bestScore || 0,
      rank: rank
    };
  }

  function awardXp(amount, source) {
    const n = Math.max(0, Math.floor(Number(amount) || 0));
    if (!n || typeof Storage === 'undefined' || !Storage.addXp) {
      return { ok: false, reason: 'no_xp' };
    }
    const out = Storage.addXp(n);
    if (typeof Analytics !== 'undefined' && Analytics.track) {
      Analytics.track('arena_xp', { amount: n, source: source || 'game', level: out.player.level });
    }
    return { ok: true, amount: n, source: source || 'game', leveledUp: out.leveledUp, player: out.player };
  }

  function awardCoins(amount, source) {
    const n = Math.max(0, Math.floor(Number(amount) || 0));
    if (!n || typeof Storage === 'undefined' || !Storage.addCoins) {
      return { ok: false, reason: 'no_coins' };
    }
    const updated = Storage.addCoins(n);
    if (typeof Analytics !== 'undefined' && Analytics.track) {
      Analytics.track('arena_coins', { amount: n, source: source || 'game' });
    }
    return { ok: true, amount: n, source: source || 'game', player: updated };
  }

  function games() {
    return GAMES.slice();
  }

  return {
    games: games,
    profile: profile,
    awardXp: awardXp,
    awardCoins: awardCoins
  };
})();
