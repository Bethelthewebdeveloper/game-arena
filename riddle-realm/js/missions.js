/**
 * Riddle Realm — Missions (Phase 10 + 11 weekly/history)
 * ========================================================
 * Daily + Weekly missions. History of completed days kept.
 */
const Missions = (function () {
  'use strict';

  const KEY = 'rr_missions';
  const HISTORY_KEY = 'rr_missions_history';
  const HISTORY_LIMIT = 14; // days of history

  const DAILY_POOL = [
    { id: 'solve_5', name: 'Warm-Up', description: 'Solve 5 riddles correctly', emoji: '✏️', type: 'correct', target: 5, difficulty: 'easy', reward: { xp: 30, coins: 15 } },
    { id: 'solve_10', name: 'Brain Workout', description: 'Solve 10 riddles correctly', emoji: '🧠', type: 'correct', target: 10, difficulty: 'normal', reward: { xp: 50, coins: 25 } },
    { id: 'earn_xp_50', name: 'XP Hunter', description: 'Earn 50 XP today', emoji: '⭐', type: 'xp', target: 50, difficulty: 'easy', reward: { xp: 20, coins: 20 } },
    { id: 'earn_xp_100', name: 'XP Surge', description: 'Earn 100 XP today', emoji: '💫', type: 'xp', target: 100, difficulty: 'normal', reward: { xp: 40, coins: 30 } },
    { id: 'play_3', name: 'Session Starter', description: 'Finish 3 game sessions', emoji: '🎮', type: 'games', target: 3, difficulty: 'easy', reward: { xp: 25, coins: 15 } },
    { id: 'daily_done', name: 'Daily Duty', description: "Complete today's Daily Challenge", emoji: '📅', type: 'daily', target: 1, difficulty: 'normal', reward: { xp: 40, coins: 20 } },
    { id: 'no_hints_5', name: 'Pure Skill', description: 'Solve 5 riddles without using hints', emoji: '💪', type: 'no_hint_correct', target: 5, difficulty: 'hard', reward: { xp: 45, coins: 25 } },
    { id: 'streak_3', name: 'Hot Streak', description: 'Get a 3-correct streak in one session', emoji: '🔥', type: 'session_streak', target: 3, difficulty: 'normal', reward: { xp: 30, coins: 15 } },
    { id: 'category_any', name: 'Topic Focus', description: 'Complete a Category challenge', emoji: '📂', type: 'category_complete', target: 1, difficulty: 'normal', reward: { xp: 35, coins: 18 } },
    { id: 'timed_run', name: 'Against the Clock', description: 'Finish a Timed mode run', emoji: '⏱️', type: 'timed_complete', target: 1, difficulty: 'hard', reward: { xp: 35, coins: 20 } }
  ];

  const WEEKLY_POOL = [
    { id: 'w_solve_30', name: 'Weekly Grind', description: 'Solve 30 riddles this week', emoji: '📚', type: 'correct', target: 30, difficulty: 'normal', reward: { xp: 100, coins: 60 } },
    { id: 'w_solve_50', name: 'Scholar', description: 'Solve 50 riddles this week', emoji: '🎓', type: 'correct', target: 50, difficulty: 'hard', reward: { xp: 150, coins: 80 } },
    { id: 'w_games_10', name: 'Active Week', description: 'Finish 10 game sessions this week', emoji: '🕹️', type: 'games', target: 10, difficulty: 'normal', reward: { xp: 80, coins: 50 } },
    { id: 'w_daily_4', name: 'Reliable', description: 'Complete 4 Daily Challenges this week', emoji: '📆', type: 'daily', target: 4, difficulty: 'hard', reward: { xp: 120, coins: 70 } },
    { id: 'w_xp_300', name: 'XP Marathon', description: 'Earn 300 XP this week', emoji: '✨', type: 'xp', target: 300, difficulty: 'normal', reward: { xp: 80, coins: 50 } },
    { id: 'w_no_hint_15', name: 'Self-Reliant', description: '15 correct answers without hints this week', emoji: '🛡️', type: 'no_hint_correct', target: 15, difficulty: 'expert', reward: { xp: 100, coins: 55 } }
  ];

  function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  /** ISO week key: YYYY-Www */
  function weekKey() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    // Thursday in current week decides the year
    d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
    const week1 = new Date(d.getFullYear(), 0, 4);
    const weekNum = 1 + Math.round(((d - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
    return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
  }

  function hashStr(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function pickFromPool(pool, key, count) {
    const seed = hashStr(key);
    const indices = pool.map((_, i) => i);
    let s = seed;
    for (let i = indices.length - 1; i > 0; i--) {
      s = (s * 1664525 + 1013904223) >>> 0;
      const j = s % (i + 1);
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    return indices.slice(0, count).map(i => {
      const t = pool[i];
      return {
        id: t.id,
        name: t.name,
        description: t.description,
        emoji: t.emoji,
        type: t.type,
        target: t.target,
        difficulty: t.difficulty || 'normal',
        reward: { ...t.reward },
        progress: 0,
        completed: false,
        claimed: false
      };
    });
  }

  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function save(state) {
    localStorage.setItem(KEY, JSON.stringify(state));
  }

  function loadHistory() {
    try {
      const raw = localStorage.getItem(HISTORY_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function pushHistory(entry) {
    const hist = loadHistory();
    // Replace same date if exists
    const filtered = hist.filter(h => h.date !== entry.date);
    filtered.unshift(entry);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(filtered.slice(0, HISTORY_LIMIT)));
  }

  function archiveIfNeeded(oldState) {
    if (!oldState || !oldState.date) return;
    if (oldState.date === todayKey()) return;
    const completed = (oldState.missions || []).filter(m => m.completed).length;
    const claimed = (oldState.missions || []).filter(m => m.claimed).length;
    pushHistory({
      date: oldState.date,
      completed,
      claimed,
      total: (oldState.missions || []).length,
      missions: (oldState.missions || []).map(m => ({
        id: m.id,
        name: m.name,
        completed: m.completed,
        claimed: m.claimed
      }))
    });
  }

  function getToday() {
    const key = todayKey();
    let state = load();
    if (!state || state.date !== key) {
      archiveIfNeeded(state);
      const prevWeekly = state && state.weekly;
      const wKey = weekKey();
      let weekly;
      if (prevWeekly && prevWeekly.week === wKey) {
        weekly = prevWeekly;
      } else {
        weekly = {
          week: wKey,
          missions: pickFromPool(WEEKLY_POOL, wKey + '-weekly', 2)
        };
      }
      state = {
        date: key,
        missions: pickFromPool(DAILY_POOL, key + '-missions', 3),
        weekly
      };
      save(state);
    } else if (!state.weekly || state.weekly.week !== weekKey()) {
      state.weekly = {
        week: weekKey(),
        missions: pickFromPool(WEEKLY_POOL, weekKey() + '-weekly', 2)
      };
      save(state);
    }
    return state;
  }

  function getMissions() {
    return getToday().missions;
  }

  function getWeekly() {
    return getToday().weekly.missions;
  }

  function record(type, amount = 1) {
    const state = getToday();
    const completed = [];

    function apply(list) {
      list.forEach(m => {
        if (m.completed) return;
        if (m.type !== type) return;
        m.progress = Math.min(m.target, (m.progress || 0) + amount);
        if (m.progress >= m.target) {
          m.completed = true;
          completed.push({ ...m, scope: list === state.missions ? 'daily' : 'weekly' });
        }
      });
    }

    apply(state.missions);
    apply(state.weekly.missions);
    save(state);
    return completed;
  }

  /**
   * Build a single mission object from a pool template
   */
  function fromTemplate(t) {
    return {
      id: t.id,
      name: t.name,
      description: t.description,
      emoji: t.emoji,
      type: t.type,
      target: t.target,
      difficulty: t.difficulty || 'normal',
      reward: { ...t.reward },
      progress: 0,
      completed: false,
      claimed: false
    };
  }

  /**
   * After claim, swap in a fresh mission the player does not already have active.
   */
  const ROTATION_KEY = 'rr_mission_rotations';

  function loadRotations() {
    try {
      const raw = localStorage.getItem(ROTATION_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) { return []; }
  }

  function pushRotation(entry) {
    const list = loadRotations();
    list.unshift(entry);
    localStorage.setItem(ROTATION_KEY, JSON.stringify(list.slice(0, 50)));
  }

  /**
   * Rotation logic:
   * 1. Player claims a completed mission → reward granted.
   * 2. That mission id goes into "retired" for this day/week.
   * 3. A replacement is picked from the same pool, preferring:
   *    - not currently active
   *    - not recently retired
   *    - similar or higher difficulty when possible
   * 4. Replacement starts at 0 progress.
   * 5. Event is stored in rotation history (last 50).
   */
  function replaceClaimedMission(state, scope, claimedId, claimedTier) {
    const pool = scope === 'weekly' ? WEEKLY_POOL : DAILY_POOL;
    const list = scope === 'weekly' ? state.weekly.missions : state.missions;
    const activeIds = new Set(list.map(m => m.id));
    if (!state.retired) state.retired = { daily: [], weekly: [] };
    const retiredKey = scope === 'weekly' ? 'weekly' : 'daily';
    const retired = state.retired[retiredKey] || [];
    retired.push(claimedId);
    state.retired[retiredKey] = retired.slice(-20);

    const exclude = new Set([...activeIds, ...retired]);
    let available = pool.filter(t => !exclude.has(t.id));
    if (!available.length) available = pool.filter(t => t.id !== claimedId);
    if (!available.length) return null;

    // Prefer same or higher difficulty tier
    const tier = claimedTier || 'normal';
    const order = { easy: 0, normal: 1, hard: 2, expert: 3 };
    const ranked = available.slice().sort((a, b) => {
      const da = order[a.difficulty || 'normal'] || 1;
      const db = order[b.difficulty || 'normal'] || 1;
      const ta = order[tier] || 1;
      // prefer >= claimed difficulty, then closer
      const sa = da >= ta ? da - ta : 10 + (ta - da);
      const sb = db >= ta ? db - ta : 10 + (ta - db);
      return sa - sb;
    });

    const seed = hashStr(claimedId + '-' + Date.now() + '-' + (state.date || ''));
    // Pick among top half of ranked list for variety
    const top = ranked.slice(0, Math.max(1, Math.ceil(ranked.length / 2)));
    const pick = top[seed % top.length];
    const replacement = fromTemplate(pick);

    pushRotation({
      at: Date.now(),
      date: state.date,
      scope,
      claimedId,
      claimedName: claimedId,
      newId: replacement.id,
      newName: replacement.name,
      newDifficulty: replacement.difficulty || 'normal'
    });

    if (typeof Analytics !== 'undefined') {
      Analytics.track('mission_rotate', { scope, from: claimedId, to: replacement.id });
    }

    return replacement;
  }

  function claim(id) {
    const state = getToday();
    let list = state.missions;
    let index = list.findIndex(x => x.id === id);
    let scope = 'daily';
    if (index < 0) {
      list = state.weekly.missions;
      index = list.findIndex(x => x.id === id);
      scope = 'weekly';
    }
    if (index < 0) return { ok: false, reason: 'not_found' };
    const m = list[index];
    if (!m.completed) return { ok: false, reason: 'not_complete' };
    if (m.claimed) return { ok: false, reason: 'already_claimed' };

    if (m.reward.xp) Storage.addXp(m.reward.xp);
    if (m.reward.coins) Storage.addCoins(m.reward.coins);

    // Grant reward, then rotate to a new mission
    const claimedSnapshot = { ...m, claimed: true };
    if (typeof Analytics !== 'undefined') Analytics.track('mission_claim', { id: m.id, scope });
    const replacement = replaceClaimedMission(state, scope, m.id, m.difficulty || 'normal');
    if (replacement) {
      list[index] = replacement;
    } else {
      m.claimed = true;
    }

    save(state);
    return {
      ok: true,
      mission: claimedSnapshot,
      reward: claimedSnapshot.reward,
      scope,
      replacement: replacement || null
    };
  }

  function getStatus() {
    const state = getToday();
    return {
      date: state.date,
      missions: state.missions,
      weekly: state.weekly.missions,
      week: state.weekly.week,
      completedCount: state.missions.filter(m => m.completed).length,
      claimedCount: state.missions.filter(m => m.claimed).length,
      total: state.missions.length,
      weeklyCompleted: state.weekly.missions.filter(m => m.completed).length,
      weeklyTotal: state.weekly.missions.length,
      history: loadHistory()
    };
  }

  function getHistory() {
    return loadHistory();
  }

  return {
    getToday,
    getMissions,
    getWeekly,
    record,
    claim,
    getStatus,
    getHistory,
    getRotationHistory: loadRotations,
    DAILY_POOL,
    WEEKLY_POOL
  };
})();
