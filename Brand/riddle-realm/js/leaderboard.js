/**
 * Riddle Realm — Leaderboard (Phase 12)
 * ======================================
 * Local personal bests only.
 * Architecture ready for future global backend (no fake server).
 */
const Leaderboard = (function () {
  'use strict';

  const KEY = 'rr_leaderboard';
  const MAX_ENTRIES = 10;

  function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function weekKey() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
    const week1 = new Date(d.getFullYear(), 0, 4);
    const weekNum = 1 + Math.round(((d - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
    return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
  }

  function defaultState() {
    return {
      allTime: [],          // { score, mode, category, date, correct }
      byCategory: {},       // category -> [{ score, date, mode }]
      daily: {},            // dateKey -> [{ score, mode, category }]
      weekly: {},           // weekKey -> [{ score, mode, category }]
      bestByMode: {}        // mode -> best score
    };
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return defaultState();
      return { ...defaultState(), ...JSON.parse(raw) };
    } catch (e) {
      return defaultState();
    }
  }

  function save(state) {
    localStorage.setItem(KEY, JSON.stringify(state));
  }

  function insertSorted(list, entry, max) {
    const next = [...list, entry].sort((a, b) => b.score - a.score);
    return next.slice(0, max || MAX_ENTRIES);
  }

  /**
   * Record a finished session score
   */
  function record(session) {
    if (!session || !session.score || session.score <= 0) return null;

    const state = load();
    const entry = {
      score: session.score,
      mode: session.mode || 'classic',
      category: session.category || null,
      correct: session.correctCount || 0,
      date: todayKey(),
      at: Date.now()
    };

    // All-time
    state.allTime = insertSorted(state.allTime || [], entry, MAX_ENTRIES);

    // By mode
    const mode = entry.mode;
    if (!state.bestByMode[mode] || entry.score > state.bestByMode[mode]) {
      state.bestByMode[mode] = entry.score;
    }

    // By category
    if (entry.category && entry.category !== 'daily') {
      const cat = entry.category;
      if (!state.byCategory[cat]) state.byCategory[cat] = [];
      state.byCategory[cat] = insertSorted(state.byCategory[cat], entry, 5);
    }

    // Daily
    const dk = todayKey();
    if (!state.daily[dk]) state.daily[dk] = [];
    state.daily[dk] = insertSorted(state.daily[dk], entry, 5);
    // Prune old daily keys (keep 14 days)
    const dailyKeys = Object.keys(state.daily).sort().reverse();
    dailyKeys.slice(14).forEach(k => delete state.daily[k]);

    // Weekly
    const wk = weekKey();
    if (!state.weekly[wk]) state.weekly[wk] = [];
    state.weekly[wk] = insertSorted(state.weekly[wk], entry, 5);
    const weekKeys = Object.keys(state.weekly).sort().reverse();
    weekKeys.slice(8).forEach(k => delete state.weekly[k]);

    save(state);
    return entry;
  }

  function getAllTime() {
    return load().allTime || [];
  }

  function getDaily() {
    return load().daily[todayKey()] || [];
  }

  function getWeekly() {
    return load().weekly[weekKey()] || [];
  }

  function getByCategory(cat) {
    return (load().byCategory || {})[cat] || [];
  }

  function getBestByMode() {
    return load().bestByMode || {};
  }

  function getSummary() {
    const state = load();
    const player = Storage.loadPlayer();
    return {
      personalBest: player.bestScore || (state.allTime[0] && state.allTime[0].score) || 0,
      allTime: state.allTime || [],
      daily: state.daily[todayKey()] || [],
      weekly: state.weekly[weekKey()] || [],
      bestByMode: state.bestByMode || {},
      byCategory: state.byCategory || {},
      date: todayKey(),
      week: weekKey()
    };
  }

  /**
   * Future: replace this with API call when backend exists.
   * Do not invent fake global players.
   */
  function getGlobalPlaceholder() {
    return {
      available: false,
      message: 'Global leaderboards will connect when a backend is added.'
    };
  }

  const FRIENDS_KEY = 'rr_friends_scores';

  function loadFriends() {
    try {
      const raw = localStorage.getItem(FRIENDS_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }

  function saveFriends(list) {
    localStorage.setItem(FRIENDS_KEY, JSON.stringify(list.slice(0, 30)));
  }

  /**
   * Add / update a friend score from a shared challenge payload.
   * This is the social leaderboard until a real server exists.
   */
  function addFriendFromChallenge(challenge) {
    if (!challenge || challenge.score == null) return null;
    const list = loadFriends();
    const name = (challenge.name || 'Friend').slice(0, 24);
    const entry = {
      name,
      score: Number(challenge.score) || 0,
      mode: challenge.mode || 'classic',
      level: challenge.level || 1,
      at: challenge.at || Date.now()
    };
    // Replace same name with higher score, else append
    const idx = list.findIndex(f => f.name.toLowerCase() === name.toLowerCase());
    if (idx >= 0) {
      if (entry.score >= list[idx].score) list[idx] = entry;
    } else {
      list.push(entry);
    }
    list.sort((a, b) => b.score - a.score);
    saveFriends(list);
    return entry;
  }

  function getFriends() {
    return loadFriends().sort((a, b) => b.score - a.score);
  }

  function getSocialBoard() {
    const player = Storage.loadPlayer();
    const you = {
      name: (player.name || 'You') + ' (you)',
      score: player.bestScore || 0,
      mode: 'best',
      isYou: true
    };
    const friends = getFriends().map(f => ({ ...f, isYou: false }));
    return [you, ...friends].sort((a, b) => b.score - a.score).slice(0, 20);
  }

  return {
    record,
    getAllTime,
    getDaily,
    getWeekly,
    getByCategory,
    getBestByMode,
    getSummary,
    getGlobalPlaceholder,
    addFriendFromChallenge,
    getFriends,
    getSocialBoard
  };
})();
