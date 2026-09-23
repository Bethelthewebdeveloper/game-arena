/**
 * Riddle Realm — Daily Challenge Module (Phase 5 + 26)
 * =====================================================
 * Deterministic daily set (same riddles all day).
 * Local play always works; when MongoDB is up, server validates rewards
 * so the same day cannot be claimed twice for the same guestKey.
 */
const Daily = (function () {
  'use strict';

  const STORAGE_KEY = 'rr_daily';
  const RIDDLE_COUNT = 5;
  const BONUS_XP = 50;
  const BONUS_COINS = 25;

  function todayKey() {
    const d = new Date();
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  function seededRandom(seed) {
    let t = seed >>> 0;
    return function () {
      t += 0x6d2b79f5;
      let r = Math.imul(t ^ (t >>> 15), 1 | t);
      r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hashString(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function selectRiddlesForDate(dateKey, count) {
    const all = Riddles.getAll();
    if (!all.length) return [];

    const rng = seededRandom(hashString(dateKey + '-riddle-realm'));
    const indices = all.map(function (_, i) {
      return i;
    });

    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = indices[i];
      indices[i] = indices[j];
      indices[j] = tmp;
    }

    return indices.slice(0, Math.min(count, all.length)).map(function (i) {
      return all[i];
    });
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch (e) {
      return null;
    }
  }

  function saveState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function guestKey() {
    return typeof Storage !== 'undefined' && Storage.getGuestKey
      ? Storage.getGuestKey()
      : null;
  }

  function getToday() {
    const key = todayKey();
    let state = loadState();

    if (!state || state.date !== key) {
      let streak = 0;
      if (state && state.completed) {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yKey =
          yesterday.getFullYear() +
          '-' +
          String(yesterday.getMonth() + 1).padStart(2, '0') +
          '-' +
          String(yesterday.getDate()).padStart(2, '0');
        if (state.date === yKey) {
          streak = state.streak || 0;
        }
      }

      const riddles = selectRiddlesForDate(key, RIDDLE_COUNT);
      state = {
        date: key,
        riddleIds: riddles.map(function (r) {
          return r.id;
        }),
        completed: false,
        score: 0,
        correct: 0,
        wrong: 0,
        xpEarned: 0,
        coinsEarned: 0,
        bonusClaimed: false,
        streak: streak,
        started: false,
        serverSynced: false
      };
      saveState(state);
    }

    return state;
  }

  function getTodayRiddles() {
    const state = getToday();
    return state.riddleIds
      .map(function (id) {
        return Riddles.getById(id);
      })
      .filter(Boolean);
  }

  /**
   * Optional: pull server assignment / completion for this guest.
   * Does not block local play if the API is down.
   */
  async function syncFromServer() {
    if (typeof API === 'undefined') return getStatus();
    const gk = guestKey();
    if (!gk) return getStatus();

    const res = await API.request('/api/daily/today', {
      headers: { 'X-Guest-Key': gk }
    });
    if (!res.ok) return getStatus();

    const data = res.data && res.data.data;
    if (!data) return getStatus();

    const state = getToday();
    if (data.dateKey && data.dateKey === state.date && data.riddleIds && data.riddleIds.length) {
      // Prefer server ids when they resolve in local catalog
      const resolved = data.riddleIds
        .map(function (id) {
          return Riddles.getById(id);
        })
        .filter(Boolean);
      if (resolved.length >= Math.min(3, RIDDLE_COUNT)) {
        state.riddleIds = resolved.map(function (r) {
          return r.id;
        });
      }
    }

    if (data.attempt) {
      if (data.attempt.completed) {
        state.completed = true;
        state.score = data.attempt.score || state.score;
        state.correct = data.attempt.correct || state.correct;
        state.wrong = data.attempt.wrong || state.wrong;
        state.streak = data.attempt.streak || state.streak;
        state.bonusClaimed = !!data.attempt.rewardClaimed;
        state.xpEarned = data.attempt.xpAwarded || state.xpEarned;
        state.coinsEarned = data.attempt.coinsAwarded || state.coinsEarned;
      }
      if (data.attempt.started) state.started = true;
      state.serverSynced = true;
    }
    saveState(state);
    return getStatus();
  }

  function startChallenge() {
    const state = getToday();
    if (state.completed) {
      return { ok: false, reason: 'already_completed' };
    }

    const riddles = getTodayRiddles();
    if (!riddles.length) {
      return { ok: false, reason: 'no_riddles' };
    }

    const started = Game.startDaily(riddles);
    if (!started) return { ok: false, reason: 'engine_failed' };

    state.started = true;
    saveState(state);

    // Fire-and-forget server start
    if (typeof API !== 'undefined') {
      const gk = guestKey();
      if (gk) {
        API.request('/api/daily/start', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Guest-Key': gk },
          body: JSON.stringify({ guestKey: gk })
        }).catch(function () {});
      }
    }

    if (typeof Analytics !== 'undefined') {
      Analytics.track('daily_start', {});
    }

    return { ok: true };
  }

  /**
   * Record local completion + try server reward validation.
   * Local bonus is granted only if not already claimed locally.
   * Server rejects double-claim when MongoDB is available.
   */
  function completeChallenge(sessionState) {
    const state = getToday();
    if (state.completed && state.bonusClaimed) return state;

    state.completed = true;
    state.score = sessionState.score || 0;
    state.correct = sessionState.correctCount || 0;
    state.wrong = sessionState.wrongCount || 0;
    state.xpEarned = sessionState.totalXpEarned || 0;
    state.coinsEarned = sessionState.totalCoinsEarned || 0;

    if (!state.bonusClaimed) {
      state.streak = (state.streak || 0) + 1;
      Storage.addXp(BONUS_XP);
      Storage.addCoins(BONUS_COINS);
      state.xpEarned += BONUS_XP;
      state.coinsEarned += BONUS_COINS;
      state.bonusClaimed = true;
    }

    saveState(state);

    // Server validation (async) — if already claimed server-side, no extra local grant
    if (typeof API !== 'undefined') {
      const gk = guestKey();
      if (gk) {
        API.request('/api/daily/complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Guest-Key': gk },
          body: JSON.stringify({
            guestKey: gk,
            score: state.score,
            correct: state.correct,
            wrong: state.wrong,
            sessionXp: sessionState.totalXpEarned || 0,
            sessionCoins: sessionState.totalCoinsEarned || 0
          })
        })
          .then(function (res) {
            if (res.ok && res.data && res.data.data) {
              const d = res.data.data;
              if (d.streak != null) {
                const s = getToday();
                s.streak = d.streak;
                s.serverSynced = true;
                saveState(s);
              }
            }
          })
          .catch(function () {});
      }
    }

    if (typeof Analytics !== 'undefined') {
      Analytics.track('daily_complete', {
        score: state.score,
        streak: state.streak
      });
    }

    return state;
  }

  function getStatus() {
    const state = getToday();
    return {
      date: state.date,
      completed: state.completed,
      score: state.score,
      correct: state.correct,
      wrong: state.wrong,
      xpEarned: state.xpEarned,
      coinsEarned: state.coinsEarned,
      streak: state.streak || 0,
      riddleCount: state.riddleIds ? state.riddleIds.length : RIDDLE_COUNT,
      bonusXp: BONUS_XP,
      bonusCoins: BONUS_COINS,
      bonusClaimed: !!state.bonusClaimed,
      serverSynced: !!state.serverSynced
    };
  }

  return {
    todayKey: todayKey,
    getToday: getToday,
    getTodayRiddles: getTodayRiddles,
    startChallenge: startChallenge,
    completeChallenge: completeChallenge,
    syncFromServer: syncFromServer,
    getStatus: getStatus,
    RIDDLE_COUNT: RIDDLE_COUNT,
    BONUS_XP: BONUS_XP,
    BONUS_COINS: BONUS_COINS
  };
})();
