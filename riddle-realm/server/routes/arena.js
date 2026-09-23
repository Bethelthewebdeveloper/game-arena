/**
 * Authenticated Arena results — server validates XP/coins.
 */
const express = require('express');
const rateLimit = require('express-rate-limit');
const GameSession = require('../models/GameSession');
const PlayerProfile = require('../models/PlayerProfile');
const { getConnectionState } = require('../config/database');
const { authenticateUser } = require('../middleware/auth');

const router = express.Router();
const GAMES = ['riddle', 'reflex', 'memory', 'penalty', 'rps', 'wordclash', 'trivia'];

const limit = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many results', code: 'RATE_LIMIT' }
});

function xpForLevel(level) {
  let needed = 100;
  for (let i = 1; i < level; i++) needed = Math.floor(needed * 1.2);
  return needed;
}

function clampScore(n) {
  const x = Math.floor(Number(n) || 0);
  return Math.max(0, Math.min(5000, x));
}

async function loadProfile(userId) {
  let p = await PlayerProfile.findOne({ userId });
  if (!p) p = await PlayerProfile.create({ userId });
  return p;
}

function applyXp(profile, amount) {
  let xp = (profile.xp || 0) + amount;
  let level = profile.level || 1;
  let needed = profile.xpNeeded || xpForLevel(level);
  while (xp >= needed) {
    xp -= needed;
    level += 1;
    needed = xpForLevel(level);
  }
  profile.xp = xp;
  profile.level = level;
  profile.xpNeeded = needed;
}

router.get('/status', (req, res) => {
  res.json({
    success: true,
    data: {
      db: getConnectionState().isConnected,
      games: GAMES,
      payments: 'NOT_CONFIGURED',
      note: getConnectionState().isConnected
        ? 'Results persist when you are logged in.'
        : 'Database unavailable — play locally until MongoDB is configured.'
    }
  });
});

router.get('/leaderboard/:gameId', async (req, res, next) => {
  try {
    if (!getConnectionState().isConnected) {
      return res.json({ success: true, data: { rows: [], message: 'No scores yet. Be the first player to set a record!' } });
    }
    const gameId = String(req.params.gameId || '');
    if (GAMES.indexOf(gameId) === -1) {
      return res.status(400).json({ success: false, error: 'Unknown game' });
    }
    const rows = await GameSession.find({ gameId }).sort({ score: -1, playedAt: 1 }).limit(20).lean();
    res.json({
      success: true,
      data: {
        rows: rows.map(function (r) {
          return { score: r.score, mode: r.mode, difficulty: r.difficulty, date: r.playedAt };
        }),
        message: rows.length ? null : 'No scores yet. Be the first player to set a record!'
      }
    });
  } catch (err) {
    next(err);
  }
});

router.get('/profile', authenticateUser, async (req, res, next) => {
  try {
    if (!getConnectionState().isConnected) {
      return res.status(503).json({ success: false, error: 'Database unavailable', code: 'DB_UNAVAILABLE' });
    }
    const p = await loadProfile(req.user._id);
    res.json({
      success: true,
      data: {
        username: req.user.username,
        displayName: req.user.displayName,
        plan: req.user.proVerified ? 'pro' : req.user.plan || 'free',
        level: p.level,
        xp: p.xp,
        xpNeeded: p.xpNeeded,
        coins: p.coins,
        gamesPlayed: p.gamesPlayed,
        bestScore: p.bestScore,
        gameStats: p.gameStats || {}
      }
    });
  } catch (err) {
    next(err);
  }
});

router.post('/result', authenticateUser, limit, async (req, res, next) => {
  try {
    if (!getConnectionState().isConnected) {
      return res.status(503).json({ success: false, error: 'Database unavailable', code: 'DB_UNAVAILABLE' });
    }
    const body = req.body || {};
    const gameId = String(body.gameId || '');
    if (GAMES.indexOf(gameId) === -1) {
      return res.status(400).json({ success: false, error: 'Unknown game', code: 'BAD_GAME' });
    }
    const score = clampScore(body.score);
    const xp = Math.min(40, 8 + Math.floor(score / 50));
    const coins = Math.min(12, 2 + Math.floor(score / 120));
    const profile = await loadProfile(req.user._id);
    applyXp(profile, xp);
    profile.coins = (profile.coins || 0) + coins;
    profile.gamesPlayed = (profile.gamesPlayed || 0) + 1;
    if (score > (profile.bestScore || 0)) profile.bestScore = score;
    const stats = profile.gameStats || {};
    stats[gameId] = Object.assign({}, stats[gameId] || {}, { lastScore: score, plays: ((stats[gameId] || {}).plays || 0) + 1 });
    if (score > (stats[gameId].bestScore || 0)) stats[gameId].bestScore = score;
    profile.gameStats = stats;
    profile.markModified('gameStats');
    await profile.save();

    const session = await GameSession.create({
      userId: req.user._id,
      gameId,
      mode: String(body.mode || '').slice(0, 32),
      difficulty: String(body.difficulty || '').slice(0, 16),
      score,
      xpAwarded: xp,
      coinsAwarded: coins,
      meta: typeof body.meta === 'object' && body.meta ? body.meta : {}
    });

    res.status(201).json({
      success: true,
      data: {
        sessionId: String(session._id),
        score,
        xpAwarded: xp,
        coinsAwarded: coins,
        level: profile.level,
        xp: profile.xp,
        xpNeeded: profile.xpNeeded,
        coins: profile.coins,
        note: 'Rewards calculated on the server. Client-submitted XP/coins were ignored.'
      }
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
