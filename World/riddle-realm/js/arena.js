/**
 * Game Arena — shared progression for every game.
 * Wraps Storage XP / coins / level. No fake values.
 */
const Arena = (function () {
  'use strict';

  const STATS_KEY = 'ga_game_stats';
  const LB_KEY = 'ga_game_boards';
  const RECENT_KEY = 'ga_recent_games';

  const GAMES = [
    { id: 'riddle', title: 'Riddle Game', emoji: '🧩', status: 'live', type: 'Puzzle', blurb: 'Classic, timed, and daily riddles.', screen: 'home', accent: '#7c5cff' },
    { id: 'reflex', title: 'Reflex Challenge', emoji: '⚡', status: 'live', type: 'Arcade', blurb: 'Tap the instant the target appears.', screen: 'minigame', accent: '#f5c542' },
    { id: 'memory', title: 'Memory Challenge', emoji: '🧠', status: 'live', type: 'Puzzle', blurb: 'Match pairs with as few moves as you can.', screen: 'minigame', accent: '#38bdf8' },
    { id: 'penalty', title: 'Penalty Shootout', emoji: '⚽', status: 'live', type: 'Sports', blurb: 'Five shots. Beat the keeper.', screen: 'minigame', accent: '#34d399' },
    { id: 'rps', title: 'Rock Paper Scissors', emoji: '✊', status: 'live', type: 'Duel', blurb: 'Fast rounds. Build a win streak.', screen: 'minigame', accent: '#fb7185' },
    { id: 'wordclash', title: 'Word Clash', emoji: '🔤', status: 'live', type: 'Word', blurb: 'Unscramble and match words against the clock.', screen: 'minigame', accent: '#a78bfa' },
    { id: 'trivia', title: 'Trivia Rush', emoji: '🎯', status: 'live', type: 'Quiz', blurb: 'Answer fast. Keep the streak alive.', screen: 'minigame', accent: '#f97316' }
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
    if (!n || typeof Storage === 'undefined' || !Storage.addXp) return { ok: false, reason: 'no_xp' };
    const out = Storage.addXp(n);
    return { ok: true, amount: n, source: source || 'game', leveledUp: out.leveledUp, player: out.player };
  }

  function awardCoins(amount, source) {
    const n = Math.max(0, Math.floor(Number(amount) || 0));
    if (!n || typeof Storage === 'undefined' || !Storage.addCoins) return { ok: false, reason: 'no_coins' };
    const updated = Storage.addCoins(n);
    return { ok: true, amount: n, source: source || 'game', player: updated };
  }

  function loadJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      return fallback;
    }
  }

  function saveJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {}
  }

  function statsAll() {
    return loadJson(STATS_KEY, {});
  }

  function statsFor(gameId) {
    return statsAll()[gameId] || {};
  }

  function saveStats(gameId, patch) {
    const all = statsAll();
    all[gameId] = Object.assign({}, all[gameId] || {}, patch);
    saveJson(STATS_KEY, all);
    return all[gameId];
  }

  function boardsAll() {
    return loadJson(LB_KEY, {});
  }

  function boardFor(gameId) {
    return boardsAll()[gameId] || [];
  }

  function pushScore(gameId, entry) {
    if (!entry || !(entry.score > 0)) return boardFor(gameId);
    const all = boardsAll();
    const list = (all[gameId] || []).concat([entry]).sort(function (a, b) { return b.score - a.score; }).slice(0, 10);
    all[gameId] = list;
    saveJson(LB_KEY, all);
    return list;
  }

  function recent() {
    return loadJson(RECENT_KEY, []);
  }

  function noteRecent(gameId) {
    const list = recent().filter(function (id) { return id !== gameId; });
    list.unshift(gameId);
    saveJson(RECENT_KEY, list.slice(0, 8));
  }

  function uniqueGamesPlayed() {
    return Object.keys(statsAll()).length;
  }

  /**
   * Record a finished session. Rewards only come from this path.
   */
  function finishSession(result) {
    const gameId = result.gameId;
    const score = Math.max(0, Math.floor(Number(result.score) || 0));
    const stats = Object.assign({}, statsFor(gameId));
    stats.plays = (stats.plays || 0) + 1;
    stats.lastScore = score;
    if (score > (stats.bestScore || 0)) {
      stats.bestScore = score;
      result.newRecord = true;
    } else {
      result.newRecord = false;
    }
    if (result.meta) Object.assign(stats, result.meta);
    saveStats(gameId, stats);
    noteRecent(gameId);
    pushScore(gameId, {
      score: score,
      mode: result.mode || '',
      difficulty: result.difficulty || '',
      date: new Date().toISOString().slice(0, 10)
    });

    if (typeof Storage !== 'undefined') {
      const p = Storage.loadPlayer();
      Storage.savePlayer({ gamesPlayed: (p.gamesPlayed || 0) + 1 });
    }

    const xp = Math.min(40, 8 + Math.floor(score / 50) + (result.bonusXp || 0));
    const coins = Math.min(12, 2 + Math.floor(score / 120) + (result.bonusCoins || 0));
    const xpOut = awardXp(xp, gameId);
    const coinOut = awardCoins(coins, gameId);

    const extras = {
      uniqueGames: uniqueGamesPlayed(),
      reflexBestMsInv: ((statsFor('reflex').bestMs) > 0 && statsFor('reflex').bestMs <= 280) ? 1 : 0,
      memoryFewestInv: ((statsFor('memory').fewestMoves) > 0 && statsFor('memory').fewestMoves <= 16) ? 1 : 0,
      penaltyPerfect: statsFor('penalty').perfect || 0,
      rpsBestStreak: statsFor('rps').bestWinStreak || 0,
      wordBest: statsFor('wordclash').bestScore || 0,
      triviaBestStreak: statsFor('trivia').bestStreak || 0
    };
    let unlocked = [];
    if (typeof Achievements !== 'undefined' && Achievements.check) {
      unlocked = Achievements.check(extras) || [];
    }

    return {
      score: score,
      xp: xpOut.ok ? xpOut.amount : 0,
      coins: coinOut.ok ? coinOut.amount : 0,
      leveledUp: !!(xpOut.leveledUp),
      newRecord: !!result.newRecord,
      achievements: unlocked,
      stats: statsFor(gameId),
      board: boardFor(gameId)
    };
  }

  function gameById(id) {
    return GAMES.filter(function (g) { return g.id === id; })[0] || null;
  }

  function games() {
    return GAMES.slice();
  }

  function ownerSnapshot() {
    const all = statsAll();
    return GAMES.map(function (g) {
      const s = all[g.id] || {};
      return {
        id: g.id,
        title: g.title,
        status: g.status,
        plays: s.plays || 0,
        bestScore: s.bestScore || 0
      };
    });
  }

  return {
    games: games,
    gameById: gameById,
    profile: profile,
    awardXp: awardXp,
    awardCoins: awardCoins,
    statsFor: statsFor,
    boardFor: boardFor,
    recent: recent,
    finishSession: finishSession,
    uniqueGamesPlayed: uniqueGamesPlayed,
    ownerSnapshot: ownerSnapshot
  };
})();
