/**
 * Daily challenge service — deterministic assignment + reward validation.
 * Phase 26. Anonymous guests identified by guestKey only.
 */
const crypto = require('crypto');
const DailyAssignment = require('../models/DailyAssignment');
const DailyAttempt = require('../models/DailyAttempt');
const Riddle = require('../models/Riddle');
const { getConnectionState } = require('../config/database');

const RIDDLE_COUNT = 5;
const BONUS_XP = 50;
const BONUS_COINS = 25;
const APP_TIMEZONE = process.env.APP_TIMEZONE || 'UTC';

function dateKeyInTimezone(tz) {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz || APP_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(new Date());
    const y = parts.find((p) => p.type === 'year').value;
    const m = parts.find((p) => p.type === 'month').value;
    const d = parts.find((p) => p.type === 'day').value;
    return y + '-' + m + '-' + d;
  } catch (e) {
    const d = new Date();
    return (
      d.getUTCFullYear() +
      '-' +
      String(d.getUTCMonth() + 1).padStart(2, '0') +
      '-' +
      String(d.getUTCDate()).padStart(2, '0')
    );
  }
}

function todayKey() {
  return dateKeyInTimezone(APP_TIMEZONE);
}

function yesterdayKey() {
  // Approximate: subtract 24h then format in app timezone
  try {
    const now = new Date(Date.now() - 86400000);
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: APP_TIMEZONE,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(now);
    const y = parts.find((p) => p.type === 'year').value;
    const m = parts.find((p) => p.type === 'month').value;
    const d = parts.find((p) => p.type === 'day').value;
    return y + '-' + m + '-' + d;
  } catch (e) {
    const d = new Date(Date.now() - 86400000);
    return (
      d.getUTCFullYear() +
      '-' +
      String(d.getUTCMonth() + 1).padStart(2, '0') +
      '-' +
      String(d.getUTCDate()).padStart(2, '0')
    );
  }
}

function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
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

function selectIds(allIds, dateKey, count) {
  if (!allIds.length) return [];
  const rng = seededRandom(hashString(dateKey + '-riddle-realm-server'));
  const indices = allIds.map((_, i) => i);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = indices[i];
    indices[i] = indices[j];
    indices[j] = tmp;
  }
  return indices.slice(0, Math.min(count, allIds.length)).map((i) => allIds[i]);
}

function normalizeGuestKey(raw) {
  const s = String(raw || '').trim();
  if (!s || s.length < 8 || s.length > 64) return null;
  if (!/^[a-zA-Z0-9_-]+$/.test(s)) return null;
  return s;
}

async function getOrCreateAssignment(dateKey) {
  let assignment = await DailyAssignment.findOne({ dateKey });
  if (assignment) return assignment;

  let allIds = [];
  let difficulties = [];

  if (getConnectionState().isConnected) {
    const docs = await Riddle.find({ active: true }).select('externalId difficulty').lean();
    if (docs.length) {
      allIds = docs.map((r) => r.externalId || String(r._id));
      const chosen = selectIds(allIds, dateKey, RIDDLE_COUNT);
      const byId = {};
      docs.forEach((r) => {
        byId[r.externalId || String(r._id)] = r.difficulty || 'medium';
      });
      difficulties = chosen.map((id) => byId[id] || 'medium');
      allIds = chosen;
    }
  }

  // Fallback stable placeholder ids if DB has no riddles yet
  if (!allIds.length) {
    allIds = selectIds(
      Array.from({ length: 50 }, (_, i) => 'seed-' + String(i + 1).padStart(3, '0')),
      dateKey,
      RIDDLE_COUNT
    );
    difficulties = allIds.map(() => 'medium');
  }

  try {
    assignment = await DailyAssignment.create({
      dateKey,
      timezone: APP_TIMEZONE,
      riddleIds: allIds,
      riddleCount: allIds.length,
      difficulties
    });
  } catch (err) {
    // Race: another request created it
    if (err && err.code === 11000) {
      assignment = await DailyAssignment.findOne({ dateKey });
    } else {
      throw err;
    }
  }
  return assignment;
}

async function getTodayForGuest(guestKey) {
  const dateKey = todayKey();
  const assignment = await getOrCreateAssignment(dateKey);
  let attempt = await DailyAttempt.findOne({ guestKey, dateKey });

  return {
    dateKey,
    timezone: APP_TIMEZONE,
    riddleIds: assignment.riddleIds,
    riddleCount: assignment.riddleIds.length,
    difficulties: assignment.difficulties || [],
    bonusXp: BONUS_XP,
    bonusCoins: BONUS_COINS,
    attempt: attempt
      ? {
          started: attempt.started,
          completed: attempt.completed,
          score: attempt.score,
          correct: attempt.correct,
          wrong: attempt.wrong,
          streak: attempt.streak,
          rewardClaimed: attempt.rewardClaimed,
          xpAwarded: attempt.xpAwarded,
          coinsAwarded: attempt.coinsAwarded
        }
      : null
  };
}

async function startAttempt(guestKey) {
  const dateKey = todayKey();
  const assignment = await getOrCreateAssignment(dateKey);
  let attempt = await DailyAttempt.findOne({ guestKey, dateKey });

  if (attempt && attempt.completed) {
    return { ok: false, code: 'ALREADY_COMPLETED', attempt };
  }

  if (!attempt) {
    attempt = await DailyAttempt.create({
      guestKey,
      dateKey,
      riddleIds: assignment.riddleIds,
      started: true,
      startedAt: new Date()
    });
  } else if (!attempt.started) {
    attempt.started = true;
    attempt.startedAt = attempt.startedAt || new Date();
    await attempt.save();
  }

  return {
    ok: true,
    dateKey,
    riddleIds: assignment.riddleIds,
    attempt
  };
}

async function completeAttempt(guestKey, payload) {
  const dateKey = todayKey();
  const assignment = await getOrCreateAssignment(dateKey);
  let attempt = await DailyAttempt.findOne({ guestKey, dateKey });

  if (attempt && attempt.completed && attempt.rewardClaimed) {
    return {
      ok: false,
      code: 'REWARD_ALREADY_CLAIMED',
      message: 'Daily reward already claimed for today',
      attempt: publicAttempt(attempt)
    };
  }

  const score = Math.max(0, Math.min(100000, parseInt(payload.score, 10) || 0));
  const correct = Math.max(0, Math.min(RIDDLE_COUNT, parseInt(payload.correct, 10) || 0));
  const wrong = Math.max(0, Math.min(RIDDLE_COUNT, parseInt(payload.wrong, 10) || 0));
  const sessionXp = Math.max(0, Math.min(5000, parseInt(payload.sessionXp, 10) || 0));
  const sessionCoins = Math.max(0, Math.min(2000, parseInt(payload.sessionCoins, 10) || 0));

  // Streak: if yesterday completed, continue; else start at 1
  let streak = 1;
  const yKey = yesterdayKey();
  const yesterday = await DailyAttempt.findOne({ guestKey, dateKey: yKey, completed: true });
  if (yesterday) {
    streak = (yesterday.streak || 0) + 1;
  }

  if (!attempt) {
    attempt = new DailyAttempt({
      guestKey,
      dateKey,
      riddleIds: assignment.riddleIds,
      started: true,
      startedAt: new Date()
    });
  }

  if (attempt.completed && attempt.rewardClaimed) {
    return {
      ok: false,
      code: 'REWARD_ALREADY_CLAIMED',
      message: 'Daily reward already claimed for today',
      attempt: publicAttempt(attempt)
    };
  }

  const alreadyClaimed = !!attempt.rewardClaimed;
  let bonusXp = 0;
  let bonusCoins = 0;
  let xpAwarded = attempt.xpAwarded || 0;
  let coinsAwarded = attempt.coinsAwarded || 0;

  if (!alreadyClaimed) {
    bonusXp = BONUS_XP;
    bonusCoins = BONUS_COINS;
    xpAwarded = sessionXp + bonusXp;
    coinsAwarded = sessionCoins + bonusCoins;
  }

  attempt.started = true;
  attempt.completed = true;
  attempt.score = score;
  attempt.correct = correct;
  attempt.wrong = wrong;
  attempt.streak = streak;
  attempt.xpAwarded = xpAwarded;
  attempt.coinsAwarded = coinsAwarded;
  attempt.bonusXp = alreadyClaimed ? attempt.bonusXp : bonusXp;
  attempt.bonusCoins = alreadyClaimed ? attempt.bonusCoins : bonusCoins;
  attempt.rewardClaimed = true;
  attempt.completedAt = attempt.completedAt || new Date();
  attempt.riddleIds = attempt.riddleIds && attempt.riddleIds.length ? attempt.riddleIds : assignment.riddleIds;

  if (payload.difficultyBreakdown && typeof payload.difficultyBreakdown === 'object') {
    attempt.difficultyBreakdown = payload.difficultyBreakdown;
  }

  await attempt.save();

  return {
    ok: true,
    alreadyClaimed,
    rewardGranted: !alreadyClaimed,
    bonusXp: alreadyClaimed ? 0 : bonusXp,
    bonusCoins: alreadyClaimed ? 0 : bonusCoins,
    xpAwarded,
    coinsAwarded,
    streak,
    attempt: publicAttempt(attempt)
  };
}

function publicAttempt(a) {
  if (!a) return null;
  return {
    dateKey: a.dateKey,
    started: a.started,
    completed: a.completed,
    score: a.score,
    correct: a.correct,
    wrong: a.wrong,
    streak: a.streak,
    rewardClaimed: a.rewardClaimed,
    xpAwarded: a.xpAwarded,
    coinsAwarded: a.coinsAwarded,
    bonusXp: a.bonusXp,
    bonusCoins: a.bonusCoins,
    completedAt: a.completedAt
  };
}

async function getFounderDailyStats() {
  const dateKey = todayKey();

  // When Mongo is down, do not buffer queries forever — return honest empty stats.
  if (!getConnectionState().isConnected) {
    return {
      dateKey,
      timezone: APP_TIMEZONE,
      today: {
        plays: 0,
        completions: 0,
        completionRate: null,
        averageScore: null,
        correctAnswers: 0,
        incorrectAnswers: 0,
        correctPct: null,
        incorrectPct: null,
        coinsAwarded: 0,
        xpAwarded: 0,
        rewardsClaimed: 0,
        riddleIds: [],
        difficulties: [],
        mostSuccessfulDifficulty: null
      },
      streaks: { activeCompletersWithStreak: 0, averageStreak: null },
      trend: [],
      hasData: false,
      message: 'No data available yet.'
    };
  }

  const assignment = await DailyAssignment.findOne({ dateKey }).lean();

  const [plays, completions, scoreAgg, rewardAgg, streakAgg, byDiff] = await Promise.all([
    DailyAttempt.countDocuments({ dateKey, started: true }),
    DailyAttempt.countDocuments({ dateKey, completed: true }),
    DailyAttempt.aggregate([
      { $match: { dateKey, completed: true } },
      {
        $group: {
          _id: null,
          avgScore: { $avg: '$score' },
          correct: { $sum: '$correct' },
          wrong: { $sum: '$wrong' },
          coins: { $sum: '$coinsAwarded' },
          xp: { $sum: '$xpAwarded' }
        }
      }
    ]),
    DailyAttempt.countDocuments({ dateKey, rewardClaimed: true }),
    DailyAttempt.aggregate([
      { $match: { completed: true, streak: { $gte: 1 } } },
      { $group: { _id: null, activeStreaks: { $sum: 1 }, avgStreak: { $avg: '$streak' } } }
    ]),
    DailyAttempt.aggregate([
      { $match: { completed: true } },
      { $group: { _id: null, count: { $sum: 1 } } }
    ])
  ]);

  // Last 7 days activity
  const trend = await DailyAttempt.aggregate([
    {
      $group: {
        _id: '$dateKey',
        plays: { $sum: { $cond: ['$started', 1, 0] } },
        completions: { $sum: { $cond: ['$completed', 1, 0] } },
        avgScore: { $avg: { $cond: ['$completed', '$score', null] } }
      }
    },
    { $sort: { _id: -1 } },
    { $limit: 14 }
  ]);

  // Most successful difficulty from assignment difficulties + correct ratios is limited;
  // use completed attempts' correct/wrong as proxy
  const stats = scoreAgg[0] || {};
  const completionRate = plays > 0 ? Math.round((completions / plays) * 1000) / 10 : null;
  const totalAnswers = (stats.correct || 0) + (stats.wrong || 0);
  const correctPct = totalAnswers > 0 ? Math.round(((stats.correct || 0) / totalAnswers) * 1000) / 10 : null;
  const incorrectPct = totalAnswers > 0 ? Math.round(((stats.wrong || 0) / totalAnswers) * 1000) / 10 : null;

  // Difficulty from today's assignment
  let mostSuccessfulDifficulty = null;
  if (assignment && assignment.difficulties && assignment.difficulties.length) {
    const counts = {};
    assignment.difficulties.forEach((d) => {
      counts[d] = (counts[d] || 0) + 1;
    });
    mostSuccessfulDifficulty = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0] || null;
  }

  return {
    dateKey,
    timezone: APP_TIMEZONE,
    today: {
      plays,
      completions,
      completionRate,
      averageScore: stats.avgScore != null ? Math.round(stats.avgScore * 10) / 10 : null,
      correctAnswers: stats.correct || 0,
      incorrectAnswers: stats.wrong || 0,
      correctPct,
      incorrectPct,
      coinsAwarded: stats.coins || 0,
      xpAwarded: stats.xp || 0,
      rewardsClaimed: rewardAgg,
      riddleIds: assignment ? assignment.riddleIds : [],
      difficulties: assignment ? assignment.difficulties : [],
      mostSuccessfulDifficulty
    },
    streaks: {
      activeCompletersWithStreak: (streakAgg[0] && streakAgg[0].activeStreaks) || 0,
      averageStreak: streakAgg[0] && streakAgg[0].avgStreak != null
        ? Math.round(streakAgg[0].avgStreak * 10) / 10
        : null
    },
    trend: trend.map((t) => ({
      date: t._id,
      plays: t.plays,
      completions: t.completions,
      averageScore: t.avgScore != null ? Math.round(t.avgScore * 10) / 10 : null
    })),
    hasData: plays > 0 || completions > 0
  };
}

module.exports = {
  RIDDLE_COUNT,
  BONUS_XP,
  BONUS_COINS,
  APP_TIMEZONE,
  todayKey,
  normalizeGuestKey,
  getTodayForGuest,
  startAttempt,
  completeAttempt,
  getFounderDailyStats,
  publicAttempt
};
