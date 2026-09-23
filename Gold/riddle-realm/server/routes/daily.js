/**
 * Daily challenge API — Phase 26
 * Anonymous guests only (guestKey). Server validates rewards.
 */
const express = require('express');
const rateLimit = require('express-rate-limit');
const dailyService = require('../services/dailyService');
const { getConnectionState } = require('../config/database');

const router = express.Router();

const mutateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many daily requests', code: 'RATE_LIMIT' }
});

function requireDb(req, res) {
  if (!getConnectionState().isConnected) {
    res.status(503).json({
      success: false,
      error: 'Database unavailable — daily progress is device-local until MongoDB connects',
      code: 'DB_UNAVAILABLE'
    });
    return false;
  }
  return true;
}

function guestFrom(req) {
  const body = req.body || {};
  const q = req.query || {};
  return dailyService.normalizeGuestKey(
    body.guestKey || req.headers['x-guest-key'] || q.guestKey
  );
}

/** GET /api/daily/today — assignment + this guest's attempt */
router.get('/today', async (req, res, next) => {
  try {
    if (!requireDb(req, res)) return;
    const guestKey = guestFrom(req);
    if (!guestKey) {
      return res.status(400).json({
        success: false,
        error: 'guestKey required (header X-Guest-Key or query)',
        code: 'MISSING_GUEST'
      });
    }
    const data = await dailyService.getTodayForGuest(guestKey);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
});

/** POST /api/daily/start — mark started */
router.post('/start', mutateLimit, async (req, res, next) => {
  try {
    if (!requireDb(req, res)) return;
    const guestKey = guestFrom(req);
    if (!guestKey) {
      return res.status(400).json({
        success: false,
        error: 'guestKey required',
        code: 'MISSING_GUEST'
      });
    }
    const result = await dailyService.startAttempt(guestKey);
    if (!result.ok) {
      return res.status(409).json({
        success: false,
        error: 'Already completed today',
        code: result.code,
        data: { attempt: dailyService.publicAttempt(result.attempt) }
      });
    }
    res.json({
      success: true,
      data: {
        dateKey: result.dateKey,
        riddleIds: result.riddleIds,
        attempt: dailyService.publicAttempt(result.attempt)
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/daily/complete
 * Body: { guestKey, score, correct, wrong, sessionXp, sessionCoins }
 * Server grants bonus once; rejects double claim.
 */
router.post('/complete', mutateLimit, async (req, res, next) => {
  try {
    if (!requireDb(req, res)) return;
    const guestKey = guestFrom(req);
    if (!guestKey) {
      return res.status(400).json({
        success: false,
        error: 'guestKey required',
        code: 'MISSING_GUEST'
      });
    }
    const result = await dailyService.completeAttempt(guestKey, req.body || {});
    if (!result.ok && result.code === 'REWARD_ALREADY_CLAIMED') {
      return res.status(409).json({
        success: false,
        error: result.message,
        code: result.code,
        data: { attempt: result.attempt, rewardGranted: false }
      });
    }
    res.json({
      success: true,
      data: {
        rewardGranted: result.rewardGranted,
        alreadyClaimed: result.alreadyClaimed,
        bonusXp: result.bonusXp,
        bonusCoins: result.bonusCoins,
        xpAwarded: result.xpAwarded,
        coinsAwarded: result.coinsAwarded,
        streak: result.streak,
        attempt: result.attempt
      }
    });
  } catch (err) {
    next(err);
  }
});

/** GET /api/daily/status — public constants + today key */
router.get('/status', (req, res) => {
  res.json({
    success: true,
    data: {
      timezone: dailyService.APP_TIMEZONE,
      dateKey: dailyService.todayKey(),
      riddleCount: dailyService.RIDDLE_COUNT,
      bonusXp: dailyService.BONUS_XP,
      bonusCoins: dailyService.BONUS_COINS,
      dbConnected: getConnectionState().isConnected
    }
  });
});

module.exports = router;
