/**
 * Riddle Realm — Core Game Engine (Phase 7)
 * ===========================================
 * Supports multiple game modes on one state machine.
 * Modes: classic | timed | survival | category | daily
 * UI never mutates state — only calls these methods.
 */
const Game = (function () {
  'use strict';

  const STATE = {
    IDLE: 'idle',
    PLAYING: 'playing',
    FEEDBACK: 'feedback',
    GAMEOVER: 'gameover'
  };

  const MODES = {
    CLASSIC: 'classic',     // Fixed set, lives matter
    TIMED: 'timed',         // Race the clock
    SURVIVAL: 'survival',   // Infinite pool until lives run out
    CATEGORY: 'category',   // One category, fixed set
    DAILY: 'daily'          // Fixed daily set
  };

  // Default mode configs
  const MODE_CONFIG = {
    classic:  { limit: 10, lives: 5,  timeLimit: null, infinite: false },
    timed:    { limit: 50, lives: 99, timeLimit: 60,   infinite: false }, // 60 seconds
    survival: { limit: 5,  lives: 3,  timeLimit: null, infinite: true  }, // top-up pool
    category: { limit: 8,  lives: 5,  timeLimit: null, infinite: false },
    daily:    { limit: 5,  lives: 5,  timeLimit: null, infinite: false }
  };

  let state = emptyState();
  let timerId = null;

  function emptyState() {
    return {
      status: STATE.IDLE,
      mode: null,
      riddles: [],
      index: 0,
      score: 0,
      lives: 5,
      maxLives: 5,
      correctCount: 0,
      wrongCount: 0,
      currentStreak: 0,
      category: null,
      isDaily: false,
      timeLimit: null,      // seconds, null = no timer
      timeLeft: null,
      timerExpired: false,
      lastResult: null,
      totalXpEarned: 0,
      totalCoinsEarned: 0
    };
  }

  function stopTimer() {
    if (timerId) {
      clearInterval(timerId);
      timerId = null;
    }
  }

  function startTimer() {
    stopTimer();
    if (!state.timeLimit) return;
    state.timeLeft = state.timeLimit;
    timerId = setInterval(() => {
      if (state.status !== STATE.PLAYING && state.status !== STATE.FEEDBACK) {
        stopTimer();
        return;
      }
      state.timeLeft = Math.max(0, (state.timeLeft || 0) - 1);
      if (state.timeLeft <= 0) {
        state.timerExpired = true;
        state.status = STATE.GAMEOVER;
        stopTimer();
        // Notify UI if a callback is registered
        if (typeof window !== 'undefined' && typeof window.__onGameTimerEnd === 'function') {
          window.__onGameTimerEnd();
        }
      }
    }, 1000);
  }

  /**
   * Generic mode starter
   * @param {string} mode - one of MODES
   * @param {object} options - { category, limit, lives, timeLimit, riddleList }
   */
  function startMode(mode, options = {}) {
    stopTimer();
    const cfg = { ...(MODE_CONFIG[mode] || MODE_CONFIG.classic), ...options };

    let session;
    if (options.riddleList && options.riddleList.length) {
      session = options.riddleList;
    } else if (cfg.infinite) {
      // Survival: start with a pool, will top up later
      session = Riddles.getSession(options.category || null, cfg.limit || 8);
    } else {
      session = Riddles.getSession(options.category || null, cfg.limit);
    }

    if (!session.length) {
      console.warn('[Game] No riddles for mode:', mode);
      return false;
    }

    const player = Storage.loadPlayer();
    const maxLives = cfg.lives || player.maxHearts || 5;

    state = {
      status: STATE.PLAYING,
      mode: mode,
      riddles: session,
      index: 0,
      score: 0,
      lives: maxLives,
      maxLives: maxLives,
      correctCount: 0,
      wrongCount: 0,
      currentStreak: 0,
      category: options.category || (mode === 'daily' ? 'daily' : null),
      isDaily: mode === MODES.DAILY,
      timeLimit: cfg.timeLimit,
      timeLeft: cfg.timeLimit,
      timerExpired: false,
      lastResult: null,
      totalXpEarned: 0,
      totalCoinsEarned: 0,
      infinite: !!cfg.infinite
    };

    startTimer();
    if (typeof Hints !== 'undefined' && Hints.onNewRiddle) {
      Hints.onNewRiddle();
    }
    return true;
  }

  // Convenience wrappers
  function startClassic(category = null) {
    return startMode(MODES.CLASSIC, { category, limit: 10, lives: 5 });
  }

  function startTimed() {
    return startMode(MODES.TIMED, { limit: 40, lives: 99, timeLimit: 60 });
  }

  function startSurvival() {
    return startMode(MODES.SURVIVAL, { limit: 8, lives: 3, infinite: true });
  }

  function startCategory(category) {
    return startMode(MODES.CATEGORY, { category, limit: 8, lives: 5 });
  }

  function startDaily(riddleList) {
    return startMode(MODES.DAILY, { riddleList, lives: 5 });
  }

  // Legacy alias
  function start(category = null, limit = 10) {
    return startMode(MODES.CLASSIC, { category, limit });
  }

  function getCurrentRiddle() {
    if (state.status !== STATE.PLAYING && state.status !== STATE.FEEDBACK) return null;
    return state.riddles[state.index] || null;
  }

  function getProgress() {
    if (state.mode === MODES.TIMED || state.infinite) {
      return { current: state.correctCount + state.wrongCount + 1, total: null };
    }
    return {
      current: state.index + 1,
      total: state.riddles.length
    };
  }

  function submitAnswer(userAnswer) {
    if (state.status !== STATE.PLAYING) return null;
    if (state.timerExpired) return null;

    const riddle = getCurrentRiddle();
    if (!riddle) return null;

    const isCorrect = Riddles.checkAnswer(riddle, userAnswer);
    let earnedXp = 0;
    let earnedCoins = 0;

    if (isCorrect) {
      // Timed mode: bonus for speed
      let scoreGain = 10 + (riddle.xp || 10);
      if (state.mode === MODES.TIMED && state.timeLeft != null) {
        scoreGain += Math.min(20, Math.floor(state.timeLeft / 3));
      }
      state.score += scoreGain;
      state.correctCount += 1;
      state.currentStreak += 1;
      earnedXp = riddle.xp || 20;
      earnedCoins = riddle.coins || 5;
      // Survival: small bonus
      if (state.mode === MODES.SURVIVAL) {
        earnedXp = Math.floor(earnedXp * 1.2);
        earnedCoins = Math.floor(earnedCoins * 1.2);
      }
      state.totalXpEarned += earnedXp;
      state.totalCoinsEarned += earnedCoins;
    } else {
      state.wrongCount += 1;
      state.currentStreak = 0;
      // Timed mode: wrong answers don't cost lives (lives are effectively unlimited)
      if (state.mode !== MODES.TIMED) {
        state.lives = Math.max(0, state.lives - 1);
      }
    }

    state.lastResult = {
      correct: isCorrect,
      riddle,
      earnedXp,
      earnedCoins,
      explanation: riddle.explanation || ''
    };

    state.status = STATE.FEEDBACK;
    _persistProgress(isCorrect, earnedXp, earnedCoins);

    // Lives-based game over (not timed)
    if (state.mode !== MODES.TIMED && state.lives <= 0) {
      state.status = STATE.GAMEOVER;
      stopTimer();
    }

    return state.lastResult;
  }

  /**
   * Skip current riddle (no score, no life loss)
   */
  function skipRiddle() {
    if (state.status !== STATE.PLAYING) return false;
    state.lastResult = {
      correct: false,
      skipped: true,
      riddle: getCurrentRiddle(),
      earnedXp: 0,
      earnedCoins: 0,
      explanation: ''
    };
    state.status = STATE.FEEDBACK;
    return next();
  }

  function next() {
    if (state.status === STATE.GAMEOVER) return false;
    if (state.timerExpired) {
      state.status = STATE.GAMEOVER;
      return false;
    }

    if (state.status === STATE.FEEDBACK) {
      state.index += 1;
      state.lastResult = null;
      if (typeof Hints !== 'undefined' && Hints.onNewRiddle) {
        Hints.onNewRiddle();
      }

      // Survival: top up the pool when near the end
      if (state.infinite && state.index >= state.riddles.length - 1) {
        const more = Riddles.getSession(state.category, 8);
        // Avoid immediate duplicates of the last few
        const recentIds = new Set(state.riddles.slice(-5).map(r => r.id));
        const fresh = more.filter(r => !recentIds.has(r.id));
        state.riddles = state.riddles.concat(fresh.length ? fresh : more);
      }

      if (!state.infinite && state.index >= state.riddles.length) {
        state.status = STATE.GAMEOVER;
        stopTimer();
        return false;
      }

      // Safety: if somehow no more riddles
      if (state.index >= state.riddles.length) {
        state.status = STATE.GAMEOVER;
        stopTimer();
        return false;
      }

      state.status = STATE.PLAYING;
      return true;
    }
    return false;
  }

  function isGameOver() {
    return state.status === STATE.GAMEOVER;
  }

  function getState() {
    return {
      status: state.status,
      mode: state.mode,
      score: state.score,
      lives: state.lives,
      maxLives: state.maxLives,
      correctCount: state.correctCount,
      wrongCount: state.wrongCount,
      currentStreak: state.currentStreak,
      category: state.category,
      isDaily: !!state.isDaily,
      timeLimit: state.timeLimit,
      timeLeft: state.timeLeft,
      timerExpired: !!state.timerExpired,
      lastResult: state.lastResult,
      totalXpEarned: state.totalXpEarned,
      totalCoinsEarned: state.totalCoinsEarned,
      progress: getProgress(),
      riddleCount: state.riddles.length,
      infinite: !!state.infinite
    };
  }

  function restart() {
    const mode = state.mode || MODES.CLASSIC;
    const category = state.category;
    if (mode === MODES.TIMED) return startTimed();
    if (mode === MODES.SURVIVAL) return startSurvival();
    if (mode === MODES.DAILY) return false; // daily can't restart same day via engine
    if (mode === MODES.CATEGORY) return startCategory(category);
    return startClassic(category);
  }

  function _persistProgress(isCorrect, xp, coins) {
    const player = Storage.loadPlayer();
    const updates = {
      totalSolved: (player.totalSolved || 0) + 1,
      hearts: state.mode === MODES.TIMED ? player.hearts : state.lives
    };

    let levelUpInfo = { leveledUp: false, levelsGained: 0 };

    if (isCorrect) {
      updates.totalCorrect = (player.totalCorrect || 0) + 1;
      updates.currentStreak = (player.currentStreak || 0) + 1;
      if (updates.currentStreak > (player.bestStreak || 0)) {
        updates.bestStreak = updates.currentStreak;
      }
      Storage.addCoins(coins);
      levelUpInfo = Storage.addXp(xp);
    } else {
      updates.totalWrong = (player.totalWrong || 0) + 1;
      updates.currentStreak = 0;
    }

    Storage.savePlayer(updates);
    if (state.lastResult) {
      state.lastResult.leveledUp = levelUpInfo.leveledUp;
      state.lastResult.levelsGained = levelUpInfo.levelsGained;
      state.lastResult.newLevel = levelUpInfo.player ? levelUpInfo.player.level : null;
    }
    return levelUpInfo;
  }

  function recordSessionEnd() {
    stopTimer();
    const player = Storage.loadPlayer();
    const updates = {
      gamesPlayed: (player.gamesPlayed || 0) + 1,
      hearts: player.maxHearts || 5
    };
    if (state.score > (player.bestScore || 0)) {
      updates.bestScore = state.score;
    }
    Storage.savePlayer(updates);
  }

  function forceGameOver() {
    stopTimer();
    state.status = STATE.GAMEOVER;
  }

  return {
    start,
    startMode,
    startClassic,
    startTimed,
    startSurvival,
    startCategory,
    startDaily,
    submitAnswer,
    skipRiddle,
    next,
    getCurrentRiddle,
    getState,
    isGameOver,
    restart,
    forceGameOver,
    recordSessionEnd,
    stopTimer,
    STATE,
    MODES,
    MODE_CONFIG
  };
})();
