/**
 * Founder-only APIs — server enforces role=founder
 * Phase 23–26: overview + analytics + daily riddle + social share
 */
const express = require('express');
const User = require('../models/User');
const Riddle = require('../models/Riddle');
const AiUsage = require('../models/AiUsage');
const { authenticateFounderAny } = require('../middleware/auth');
const dailyService = require('../services/dailyService');
const shareRoutes = require('./share');
const roomStore = require('../services/roomStore');
const battleStore = require('../services/battleStore');
const challengeStore = require('../services/challengeStore');
const eventLog = require('../services/eventLog');
const { getConnectionState } = require('../config/database');

const router = express.Router();
// Access-key session OR Mongo founder session — never public
router.use(authenticateFounderAny);

router.get('/live', async (req, res, next) => {
  try {
    const mp = await safeMpStats();
    const battles = battleStore.stats();
    const challenges = challengeStore.stats();
    const activity = eventLog.recent(30);
    const today = eventLog.countsToday();
    res.json({
      success: true,
      data: {
        connection: 'LIVE',
        generatedAt: new Date().toISOString(),
        overview: {
          activeBattles: battles.live,
          activeMultiplayerRooms: mp.activeMatches || 0,
          activeChallenges: challenges.active,
          activityEventsToday: today.total,
          roomsCreated: mp.roomsCreated || 0,
          challengeOpens: challenges.opened,
          challengePlayed: challenges.played
        },
        battles: battles.battles || [],
        rooms: typeof roomStore.listLiveRooms === 'function' ? roomStore.listLiveRooms() : [],
        challenges: challenges,
        activity: activity,
        timers: mp.timers || { withTimer: 0 },
        pro: { paymentIntegration: 'NOT_IMPLEMENTED', purchases: 'Not connected' },
        note: 'Values update from verified server events. Share clicks are initiations only. Payments are not connected.'
      }
    });
  } catch (err) {
    next(err);
  }
});

function todayKey() {
  const d = new Date();
  return (
    d.getFullYear() +
    '-' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(d.getDate()).padStart(2, '0')
  );
}

router.get('/overview', async (req, res, next) => {
  try {
    const dbOk = getConnectionState().isConnected;
    let total = null;
    let students = null;
    let parents = null;
    let teachers = null;
    let founders = null;
    let riddles = null;
    let newUsers7 = null;

    if (dbOk) {
      [total, students, parents, teachers, founders, riddles] = await Promise.all([
        User.countDocuments({}),
        User.countDocuments({ role: 'student' }),
        User.countDocuments({ role: 'parent' }),
        User.countDocuments({ role: 'teacher' }),
        User.countDocuments({ role: 'founder' }),
        Riddle.countDocuments({ active: true })
      ]);
      const since7 = new Date(Date.now() - 7 * 864e5);
      newUsers7 = await User.countDocuments({ createdAt: { $gte: since7 } });
    }

    const dateKey = todayKey();
    let aiToday = { devices: 0, requests: 0 };
    if (dbOk) {
      try {
        const agg = await AiUsage.aggregate([
          { $match: { dateKey } },
          { $group: { _id: null, devices: { $sum: 1 }, requests: { $sum: '$count' } } }
        ]);
        if (agg[0]) aiToday = { devices: agg[0].devices, requests: agg[0].requests };
      } catch (e) {}
    }

    let daily = null;
    let share = null;
    try {
      daily = await dailyService.getFounderDailyStats();
    } catch (e) {
      daily = { hasData: false, error: e.message };
    }
    try {
      share = await shareRoutes.getShareStats();
    } catch (e) {
      share = { hasData: false, total: 0, error: e.message };
    }

    res.json({
      success: true,
      data: {
        users: { total, students, parents, teachers, founders, newLast7Days: newUsers7 },
        content: { activeRiddles: riddles },
        ai: {
          date: dateKey,
          devicesActiveToday: aiToday.devices,
          requestsToday: aiToday.requests,
          freeDailyLimit: parseInt(process.env.AI_DAILY_FREE_LIMIT, 10) || 20
        },
        dailyRiddle: {
          plays: daily && daily.today ? daily.today.plays : 0,
          completions: daily && daily.today ? daily.today.completions : 0,
          averageScore: daily && daily.today ? daily.today.averageScore : null,
          activeStreaks: daily && daily.streaks ? daily.streaks.activeCompletersWithStreak : 0,
          hasData: !!(daily && daily.hasData)
        },
        socialSharing: {
          totalInitiations: share && share.total != null ? share.total : 0,
          hasData: !!(share && share.hasData)
        },
        multiplayer: await safeMpStats(),
        monetization: {
          note: 'Payment tracking is not connected yet.',
          proVerified: getConnectionState().isConnected
            ? await User.countDocuments({ proVerified: true })
            : null,
          baseMonthlyUsd: 4.99,
          baseYearlyUsd: 49.99,
          paymentSystem: 'NOT CONNECTED',
          providers: {
            paystack: 'NOT CONNECTED',
            flutterwave: 'NOT CONNECTED',
            moniepoint: 'NOT CONNECTED',
            stripe: 'NOT CONNECTED'
          }
        },
        generatedAt: new Date().toISOString()
      }
    });
  } catch (err) {
    next(err);
  }
});

async function safeMpStats() {
  try {
    return await roomStore.getStats();
  } catch (e) {
    return { hasData: false, message: 'No data available yet.' };
  }
}

router.get('/analytics', async (req, res, next) => {
  try {
    const dateKey = todayKey();
    let aiToday = { devices: 0, requests: 0 };
    let activeRiddles = null;
    const dbOk = getConnectionState().isConnected;
    if (dbOk) {
      try {
        const agg = await AiUsage.aggregate([
          { $match: { dateKey } },
          { $group: { _id: null, devices: { $sum: 1 }, requests: { $sum: '$count' } } }
        ]);
        if (agg[0]) aiToday = { devices: agg[0].devices, requests: agg[0].requests };
      } catch (e) {}
      try {
        activeRiddles = await Riddle.countDocuments({ active: true });
      } catch (e) {}
    }

    let dailyStats = null;
    let shareStats = null;
    try {
      dailyStats = await dailyService.getFounderDailyStats();
    } catch (e) {
      dailyStats = { hasData: false, message: 'No data available yet.' };
    }
    try {
      shareStats = await shareRoutes.getShareStats();
    } catch (e) {
      shareStats = { hasData: false, total: 0, message: 'No data available yet.' };
    }

    res.json({
      success: true,
      data: {
        overview: {
          note: 'Server aggregates MongoDB data. Device-only metrics are not invented.',
          activeRiddles,
          dailyRiddlePlays: dailyStats && dailyStats.today ? dailyStats.today.plays : 0,
          dailyRiddleCompletions: dailyStats && dailyStats.today ? dailyStats.today.completions : 0,
          averageDailyScore: dailyStats && dailyStats.today ? dailyStats.today.averageScore : null,
          activeStreaks: dailyStats && dailyStats.streaks
            ? dailyStats.streaks.activeCompletersWithStreak
            : 0,
          socialShareInitiations: shareStats && shareStats.total != null ? shareStats.total : 0
        },
        dailyRiddle: dailyStats && dailyStats.hasData
          ? {
              dateKey: dailyStats.dateKey,
              timezone: dailyStats.timezone,
              plays: dailyStats.today.plays,
              completions: dailyStats.today.completions,
              completionRate: dailyStats.today.completionRate,
              averageScore: dailyStats.today.averageScore,
              correctAnswers: dailyStats.today.correctAnswers,
              incorrectAnswers: dailyStats.today.incorrectAnswers,
              correctPct: dailyStats.today.correctPct,
              incorrectPct: dailyStats.today.incorrectPct,
              coinsAwarded: dailyStats.today.coinsAwarded,
              xpAwarded: dailyStats.today.xpAwarded,
              mostSuccessfulDifficulty: dailyStats.today.mostSuccessfulDifficulty,
              riddleCount: (dailyStats.today.riddleIds || []).length,
              difficulties: dailyStats.today.difficulties,
              streakActivity: dailyStats.streaks,
              activityTrends: dailyStats.trend
            }
          : { message: 'No data available yet.' },
        socialSharing: shareStats && shareStats.hasData
          ? {
              note: shareStats.note,
              totalShareInitiations: shareStats.total,
              whatsappShareInitiations: shareStats.byChannel.whatsapp,
              nativeShareInitiations: shareStats.byChannel.native,
              copyResultClicks: shareStats.byChannel.copy,
              shareButtonClicks: shareStats.byChannel.share_button,
              byChannel: shareStats.byChannel,
              last7Days: shareStats.last7Days
            }
          : { message: 'No data available yet.' },
        economy: {
          note: 'Coin earn/spend is device-local until a progress sync API exists.',
          coinsEarned: null,
          coinsSpent: null,
          themesUnlocked: null,
          avatarsUnlocked: null,
          hintPacksUnlocked: null
        },
        ai: {
          date: dateKey,
          devicesActiveToday: aiToday.devices,
          requestsToday: aiToday.requests,
          freeDailyLimit: parseInt(process.env.AI_DAILY_FREE_LIMIT, 10) || 20,
          limitReached: null
        },
        pro: {
          note: 'No purchases. Display-only interest events are client-side until billing exists.',
          proVerifiedUsers: await User.countDocuments({ proVerified: true }),
          pageViews: null,
          upgradeClicks: null
        },
        pricing: {
          baseMonthlyUsd: 4.99,
          baseYearlyUsd: 49.99,
          supportedCurrencies: ['USD', 'NGN', 'GBP', 'EUR', 'CAD', 'AUD'],
          regionalConfigured: true,
          paymentConnected: false
        },
        marketing: {
          metaPixelIdConfigured: true,
          metaPixelId: '1045975441458918',
          note: 'Pixel loads only after marketing consent. Purchase is blocked without server verification.',
          eventsImplemented: ['PageView', 'ViewContent', 'InitiateCheckout(legacy helper)', 'Purchase(verified only)'],
          purchaseWiredToCheckout: false
        },
        payments: {
          status: 'NOT CONNECTED',
          paystack: 'NOT CONNECTED',
          flutterwave: 'NOT CONNECTED',
          moniepoint: 'NOT CONNECTED',
          stripe: 'NOT CONNECTED',
          message: 'Payment tracking is not connected yet. No revenue is reported.'
        },
        generatedAt: new Date().toISOString()
      }
    });
  } catch (err) {
    next(err);
  }
});

/** GET /api/founder/daily-analytics — dedicated daily + share block */
router.get('/daily-analytics', async (req, res, next) => {
  try {
    let daily = null;
    let share = null;
    try {
      daily = await dailyService.getFounderDailyStats();
    } catch (e) {
      daily = null;
    }
    try {
      share = await shareRoutes.getShareStats();
    } catch (e) {
      share = null;
    }
    res.json({
      success: true,
      data: {
        dailyRiddle: daily && daily.hasData ? daily : { message: 'No data available yet.' },
        socialSharing: share && share.hasData ? share : { message: 'No data available yet.' },
        generatedAt: new Date().toISOString()
      }
    });
  } catch (err) {
    next(err);
  }
});

router.get('/users', async (req, res, next) => {
  try {
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));
    const role = req.query.role ? String(req.query.role) : null;
    const filter = {};
    if (role && ['student', 'parent', 'teacher', 'founder'].includes(role)) filter.role = role;

    const users = await User.find(filter)
      .select('username email displayName role plan proVerified status createdAt lastLoginAt teacherStatus')
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    res.json({ success: true, count: users.length, data: users });
  } catch (err) {
    next(err);
  }
});

router.get('/riddles/summary', async (req, res, next) => {
  try {
    const total = await Riddle.countDocuments({});
    const active = await Riddle.countDocuments({ active: true });
    const byCategory = await Riddle.aggregate([
      { $match: { active: true } },
      { $group: { _id: '$category', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 20 }
    ]);
    res.json({
      success: true,
      data: { total, active, byCategory }
    });
  } catch (err) {
    next(err);
  }
});

/** GET /api/founder/multiplayer */
router.get('/multiplayer', async (req, res, next) => {
  try {
    const stats = await safeMpStats();
    res.json({
      success: true,
      data: stats.hasData ? stats : { message: 'No data available yet.', hasData: false }
    });
  } catch (err) {
    next(err);
  }
});

/** GET /api/founder/daily-riddle */
router.get('/daily-riddle', async (req, res, next) => {
  try {
    let daily = null;
    try {
      daily = await dailyService.getFounderDailyStats();
    } catch (e) {
      daily = null;
    }
    res.json({
      success: true,
      data: daily && daily.hasData ? daily : { message: 'No data available yet.' }
    });
  } catch (err) {
    next(err);
  }
});

/** GET /api/founder/ai */
router.get('/ai', async (req, res, next) => {
  try {
    const dateKey = todayKey();
    let aiToday = { devices: 0, requests: 0 };
    if (getConnectionState().isConnected) {
      try {
        const agg = await AiUsage.aggregate([
          { $match: { dateKey } },
          { $group: { _id: null, devices: { $sum: 1 }, requests: { $sum: '$count' } } }
        ]);
        if (agg[0]) aiToday = { devices: agg[0].devices, requests: agg[0].requests };
      } catch (e) {}
    }
    const hasData = aiToday.devices > 0 || aiToday.requests > 0;
    res.json({
      success: true,
      data: hasData
        ? {
            date: dateKey,
            requests: aiToday.requests,
            devices: aiToday.devices,
            freeDailyLimit: parseInt(process.env.AI_DAILY_FREE_LIMIT, 10) || 20,
            errors: null
          }
        : { message: 'No data available yet.' }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
