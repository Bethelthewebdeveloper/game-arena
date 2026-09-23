/**
 * Riddle Realm — Analytics Foundation (Phase 15)
 * ================================================
 * Local gameplay metrics only. No third-party tracking.
 * Ready to export / sync to a real backend later.
 */
const Analytics = (function () {
  'use strict';

  const KEY = 'rr_analytics';

  function defaultState() {
    return {
      gamesStarted: 0,
      gamesCompleted: 0,
      riddlesAnswered: 0,
      correct: 0,
      wrong: 0,
      hintsUsed: 0,
      totalSessionMs: 0,
      sessions: 0,
      byCategory: {},      // cat -> { answered, correct }
      byDifficulty: {},    // easy|medium|hard|expert -> { answered, correct }
      byMode: {},          // mode -> { started, completed, scoreSum }
      firstPlayedAt: null,
      lastPlayedAt: null,
      daysPlayed: [],      // YYYY-MM-DD unique retention markers
      missionRotations: 0,
      missionClaims: 0,
      aiRequests: 0,
      aiLimitReached: 0,
      shopOpened: 0,
      shopUnlocks: 0,
      coinsSpentTotal: 0,
      proModalOpens: 0,
      proUpgradeClicks: 0,
      dailyStarts: 0,
      dailyCompletes: 0,
      shareInitiations: 0,
      shareByChannel: {}
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

  function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function touchDay(state) {
    const key = todayKey();
    if (!state.daysPlayed.includes(key)) {
      state.daysPlayed.push(key);
      // keep last 90 days
      if (state.daysPlayed.length > 90) state.daysPlayed = state.daysPlayed.slice(-90);
    }
    state.lastPlayedAt = Date.now();
    if (!state.firstPlayedAt) state.firstPlayedAt = state.lastPlayedAt;
  }

  function track(event, payload = {}) {
    const state = load();
    touchDay(state);

    switch (event) {
      case 'ai_request':
        state.aiRequests = (state.aiRequests || 0) + 1;
        break;
      case 'ai_limit_reached':
        state.aiLimitReached = (state.aiLimitReached || 0) + 1;
        break;
      case 'shop_open':
        state.shopOpened = (state.shopOpened || 0) + 1;
        break;
      case 'shop_unlock':
        state.shopUnlocks = (state.shopUnlocks || 0) + 1;
        break;
      case 'coins_spent':
        state.coinsSpentTotal = (state.coinsSpentTotal || 0) + (payload.amount || 0);
        break;
      case 'pro_modal_open':
        state.proModalOpens = (state.proModalOpens || 0) + 1;
        break;
      case 'pro_upgrade_click':
        state.proUpgradeClicks = (state.proUpgradeClicks || 0) + 1;
        break;

      case 'game_start':
        state.gamesStarted += 1;
        state.sessions += 1;
        if (payload.mode) {
          if (!state.byMode[payload.mode]) state.byMode[payload.mode] = { started: 0, completed: 0, scoreSum: 0 };
          state.byMode[payload.mode].started += 1;
        }
        break;

      case 'game_complete':
        state.gamesCompleted += 1;
        if (payload.mode) {
          if (!state.byMode[payload.mode]) state.byMode[payload.mode] = { started: 0, completed: 0, scoreSum: 0 };
          state.byMode[payload.mode].completed += 1;
          state.byMode[payload.mode].scoreSum += (payload.score || 0);
        }
        if (payload.durationMs) state.totalSessionMs += payload.durationMs;
        break;

      case 'answer':
        state.riddlesAnswered += 1;
        if (payload.correct) state.correct += 1;
        else state.wrong += 1;
        if (payload.category) {
          if (!state.byCategory[payload.category]) state.byCategory[payload.category] = { answered: 0, correct: 0 };
          state.byCategory[payload.category].answered += 1;
          if (payload.correct) state.byCategory[payload.category].correct += 1;
        }
        if (payload.difficulty) {
          if (!state.byDifficulty[payload.difficulty]) state.byDifficulty[payload.difficulty] = { answered: 0, correct: 0 };
          state.byDifficulty[payload.difficulty].answered += 1;
          if (payload.correct) state.byDifficulty[payload.difficulty].correct += 1;
        }
        break;

      case 'hint':
        state.hintsUsed += 1;
        break;

      case 'mission_claim':
        state.missionClaims += 1;
        break;

      case 'mission_rotate':
        state.missionRotations += 1;
        break;

      case 'daily_start':
        state.dailyStarts = (state.dailyStarts || 0) + 1;
        break;

      case 'daily_complete':
        state.dailyCompletes = (state.dailyCompletes || 0) + 1;
        break;

      case 'share_initiated':
        state.shareInitiations = (state.shareInitiations || 0) + 1;
        if (payload.channel) {
          if (!state.shareByChannel) state.shareByChannel = {};
          state.shareByChannel[payload.channel] =
            (state.shareByChannel[payload.channel] || 0) + 1;
        }
        break;

      default:
        break;
    }

    save(state);
    return state;
  }

  function getSummary() {
    const s = load();
    const accuracy = s.riddlesAnswered > 0
      ? Math.round((s.correct / s.riddlesAnswered) * 100)
      : null;
    const avgSessionMs = s.sessions > 0 ? Math.round(s.totalSessionMs / s.sessions) : 0;
    return {
      ...s,
      accuracy,
      avgSessionMs,
      retentionDays: (s.daysPlayed || []).length
    };
  }

  /**
   * Future cloud export shape — no network call yet
   */
  function exportPayload() {
    return {
      version: 1,
      exportedAt: Date.now(),
      data: getSummary()
    };
  }

  return {
    track,
    getSummary,
    exportPayload,
    load
  };
})();
