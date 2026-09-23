/**
 * Riddle Realm — Streaks & Rewards (Phase 6)
 * ===========================================
 * Daily login reward, streak milestones, fair recovery.
 * No dark patterns — clear, optional, generous.
 */
const Streaks = (function () {
  'use strict';

  const KEY = 'rr_streaks';

  // Milestone rewards (claimed once when reached)
  const MILESTONES = [
    { days: 3,  coins: 30,  xp: 40,  label: '3-Day Spark',   emoji: '✨' },
    { days: 7,  coins: 80,  xp: 100, label: 'Week Warrior',  emoji: '🔥' },
    { days: 14, coins: 150, xp: 200, label: 'Fortnight Focus', emoji: '💎' },
    { days: 30, coins: 400, xp: 500, label: 'Month Master',  emoji: '👑' }
  ];

  const LOGIN_XP = 15;
  const LOGIN_COINS = 10;
  const RECOVERY_COST = 40; // coins to restore a broken streak (fair, optional)

  function todayKey() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  function yesterdayKey() {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
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

  function defaultState() {
    return {
      currentStreak: 0,
      bestStreak: 0,
      lastLoginDate: null,
      lastDailyDate: null,
      loginClaimedDate: null,
      claimedMilestones: [], // array of day numbers already claimed
      freezeAvailable: true,  // one free freeze
      recoveryUsedDate: null
    };
  }

  /**
   * Call on app open — handles login reward eligibility
   */
  function onAppOpen() {
    const state = load();
    const today = todayKey();
    // Nothing else needed here; claimLoginReward is explicit
    return state;
  }

  /**
   * Can the player claim today's login reward?
   */
  function canClaimLogin() {
    const state = load();
    return state.loginClaimedDate !== todayKey();
  }

  /**
   * Claim daily login reward
   */
  function claimLoginReward() {
    const state = load();
    const today = todayKey();
    if (state.loginClaimedDate === today) {
      return { ok: false, reason: 'already_claimed' };
    }

    Storage.addXp(LOGIN_XP);
    Storage.addCoins(LOGIN_COINS);

    state.loginClaimedDate = today;
    // Soft login streak tracking (separate from daily challenge streak)
    if (state.lastLoginDate === yesterdayKey()) {
      // consecutive login — no extra reward, just note
    }
    state.lastLoginDate = today;
    save(state);

    return {
      ok: true,
      xp: LOGIN_XP,
      coins: LOGIN_COINS
    };
  }

  /**
   * Sync with Daily module after a daily challenge is completed.
   * Call from UI after Daily.completeChallenge.
   */
  function onDailyCompleted(dailyStreak) {
    const state = load();
    const today = todayKey();

    state.currentStreak = dailyStreak || state.currentStreak;
    if (state.currentStreak > state.bestStreak) {
      state.bestStreak = state.currentStreak;
    }
    state.lastDailyDate = today;
    save(state);

    // Check newly unlocked milestones
    return getClaimableMilestones();
  }

  /**
   * Milestones the player has reached but not yet claimed
   */
  function getClaimableMilestones() {
    const state = load();
    const claimed = new Set(state.claimedMilestones || []);
    return MILESTONES.filter(m => state.currentStreak >= m.days && !claimed.has(m.days));
  }

  /**
   * Claim a milestone reward
   */
  function claimMilestone(days) {
    const state = load();
    const milestone = MILESTONES.find(m => m.days === days);
    if (!milestone) return { ok: false, reason: 'invalid' };
    if (state.currentStreak < days) return { ok: false, reason: 'not_reached' };
    if ((state.claimedMilestones || []).includes(days)) {
      return { ok: false, reason: 'already_claimed' };
    }

    Storage.addXp(milestone.xp);
    Storage.addCoins(milestone.coins);

    state.claimedMilestones = [...(state.claimedMilestones || []), days];
    save(state);

    return {
      ok: true,
      milestone,
      xp: milestone.xp,
      coins: milestone.coins
    };
  }

  /**
   * Fair streak recovery:
   * - One free freeze per lifetime (or we can refresh later)
   * - Or pay coins to restore if streak was broken yesterday
   */
  function canRecover() {
    const state = load();
    const daily = typeof Daily !== 'undefined' ? Daily.getStatus() : null;

    // If daily is already completed today, no recovery needed
    if (daily && daily.completed) return { ok: false, reason: 'already_ok' };

    // If current streak is > 0 and last daily was yesterday, still fine
    if (state.lastDailyDate === yesterdayKey() && state.currentStreak > 0) {
      return { ok: false, reason: 'still_active' };
    }

    // Streak is broken (missed a day) but had a streak before
    if (state.currentStreak === 0 && state.bestStreak > 0) {
      // Offer recovery of bestStreak - or last known
      return {
        ok: true,
        free: state.freezeAvailable,
        cost: RECOVERY_COST,
        restoreTo: Math.max(1, state.bestStreak - 1) // restore near best
      };
    }

    return { ok: false, reason: 'nothing_to_recover' };
  }

  function recoverStreak() {
    const info = canRecover();
    if (!info.ok) return info;

    const state = load();
    const player = Storage.loadPlayer();

    if (info.free && state.freezeAvailable) {
      state.freezeAvailable = false;
    } else {
      if ((player.coins || 0) < RECOVERY_COST) {
        return { ok: false, reason: 'not_enough_coins' };
      }
      Storage.savePlayer({ coins: player.coins - RECOVERY_COST });
    }

    state.currentStreak = info.restoreTo;
    state.recoveryUsedDate = todayKey();
    save(state);

    // Also push into Daily state so UI stays in sync
    if (typeof Daily !== 'undefined') {
      try {
        const dState = Daily.getToday();
        dState.streak = info.restoreTo;
        localStorage.setItem('rr_daily', JSON.stringify(dState));
      } catch (e) { /* ignore */ }
    }

    return { ok: true, restoredTo: info.restoreTo, usedFree: info.free };
  }

  function getStatus() {
    const state = load();
    return {
      currentStreak: state.currentStreak || 0,
      bestStreak: state.bestStreak || 0,
      canClaimLogin: canClaimLogin(),
      loginXp: LOGIN_XP,
      loginCoins: LOGIN_COINS,
      claimableMilestones: getClaimableMilestones(),
      allMilestones: MILESTONES.map(m => ({
        ...m,
        claimed: (state.claimedMilestones || []).includes(m.days),
        reached: (state.currentStreak || 0) >= m.days
      })),
      recovery: canRecover(),
      freezeAvailable: state.freezeAvailable
    };
  }

  return {
    onAppOpen,
    canClaimLogin,
    claimLoginReward,
    onDailyCompleted,
    getClaimableMilestones,
    claimMilestone,
    canRecover,
    recoverStreak,
    getStatus,
    MILESTONES,
    LOGIN_XP,
    LOGIN_COINS,
    RECOVERY_COST
  };
})();
