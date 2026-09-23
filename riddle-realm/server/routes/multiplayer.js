/**
 * Multiplayer rooms — guest host/guest, server-authoritative state.
 */
const express = require('express');
const rateLimit = require('express-rate-limit');
const store = require('../services/roomStore');
const mpRanks = require('../services/mpRanks');
const featureAccess = require('../services/featureAccess');
const { publicLink } = require('../utils/publicUrl');

const router = express.Router();

const mutateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many room requests', code: 'RATE_LIMIT' }
});

function playerFrom(req) {
  const body = req.body || {};
  const query = req.query || {};
  return {
    playerId: String(body.playerId || req.headers['x-player-id'] || query.playerId || '').trim(),
    token: String(body.playerToken || req.headers['x-player-token'] || query.playerToken || '').trim()
  };
}

function requirePlayer(req, res) {
  const { playerId, token } = playerFrom(req);
  if (!playerId || !token) {
    res.status(400).json({ success: false, error: 'playerId and playerToken required', code: 'MISSING_PLAYER' });
    return null;
  }
  return { playerId, token };
}

function sendRoom(res, room, playerId, extra) {
  const view = store.publicRoomFor ? store.publicRoomFor(room, playerId) : store.publicRoom(room);
  res.json(
    Object.assign(
      {
        success: true,
        data: {
          room: view,
          storage: store.storageMode()
        }
      },
      extra || {}
    )
  );
}

router.get('/status', (req, res) => {
  res.json({
    success: true,
    data: {
      maxPlayers: store.MAX_PLAYERS,
      storage: store.storageMode(),
      states: ['WAITING', 'READY', 'STARTING', 'PLAYING', 'FINISHED', 'CANCELLED'],
      capacities: [2, 4, 6, 8, 10],
      features: featureAccess.snapshot()
    }
  });
});

router.get('/leaderboard', (req, res) => {
  const you = String(req.query.playerId || req.headers['x-player-id'] || '').trim();
  res.json({ success: true, data: mpRanks.leaderboard(you) });
});

router.post('/rooms', mutateLimit, async (req, res, next) => {
  try {
    const cap = parseInt(req.body && req.body.maxPlayers, 10);
    const gate = featureAccess.canUseCapacity(cap);
    if (!gate.ok && cap > featureAccess.FREE_MP_CAP) {
      return res.status(403).json({
        success: false,
        error: gate.message || 'Pro feature',
        code: 'PRO_REQUIRED',
        feature: gate.feature,
        paymentIntegration: 'NOT_IMPLEMENTED'
      });
    }
    const { room, playerId, token } = await store.createRoom({
      maxPlayers: cap,
      durationMinutes: req.body && req.body.durationMinutes
    });
    const share = publicLink(req, '/multiplayer/' + room.roomCode);
    res.status(201).json({
      success: true,
      data: {
        room: store.publicRoomFor(room, playerId),
        playerId,
        playerToken: token,
        storage: store.storageMode(),
        share: share
      }
    });
  } catch (err) {
    next(err);
  }
});

router.post('/rooms/join', mutateLimit, async (req, res, next) => {
  try {
    const code = String(req.body.roomCode || req.body.code || '').trim();
    if (!code) {
      return res.status(400).json({ success: false, error: 'Room code required', code: 'MISSING_CODE' });
    }
    const { room, playerId, token, waiting } = await store.joinRoom(code);
    res.json({
      success: true,
      data: {
        room: store.publicRoomFor(room, playerId),
        playerId,
        playerToken: token,
        waiting: !!waiting,
        storage: store.storageMode(),
        share: publicLink(req, '/multiplayer/' + room.roomCode)
      }
    });
  } catch (err) {
    next(err);
  }
});

router.get('/rooms/:code', async (req, res, next) => {
  try {
    const creds = requirePlayer(req, res);
    if (!creds) return;
    const room = await store.getRoom(req.params.code, creds.playerId, creds.token);
    sendRoom(res, room, creds.playerId);
  } catch (err) {
    next(err);
  }
});

router.post('/rooms/:code/heartbeat', async (req, res, next) => {
  try {
    const creds = requirePlayer(req, res);
    if (!creds) return;
    const room = await store.heartbeat(req.params.code, creds.playerId, creds.token);
    sendRoom(res, room, creds.playerId);
  } catch (err) {
    next(err);
  }
});

router.post('/rooms/:code/ready', mutateLimit, async (req, res, next) => {
  try {
    const creds = requirePlayer(req, res);
    if (!creds) return;
    const ready = req.body.ready !== false;
    const room = await store.setReady(req.params.code, creds.playerId, creds.token, ready);
    sendRoom(res, room, creds.playerId);
  } catch (err) {
    next(err);
  }
});

router.post('/rooms/:code/start', mutateLimit, async (req, res, next) => {
  try {
    const creds = requirePlayer(req, res);
    if (!creds) return;
    const room = await store.startMatch(req.params.code, creds.playerId, creds.token);
    sendRoom(res, room, creds.playerId);
  } catch (err) {
    next(err);
  }
});

router.post('/rooms/:code/admit', mutateLimit, async (req, res, next) => {
  try {
    const creds = requirePlayer(req, res);
    if (!creds) return;
    const targetId = String((req.body && req.body.targetId) || '').trim();
    const room = await store.admitPlayer(req.params.code, creds.playerId, creds.token, targetId);
    sendRoom(res, room, creds.playerId);
  } catch (err) {
    next(err);
  }
});

router.post('/rooms/:code/decline', mutateLimit, async (req, res, next) => {
  try {
    const creds = requirePlayer(req, res);
    if (!creds) return;
    const targetId = String((req.body && req.body.targetId) || '').trim();
    const room = await store.declinePlayer(req.params.code, creds.playerId, creds.token, targetId);
    sendRoom(res, room, creds.playerId);
  } catch (err) {
    next(err);
  }
});

router.post('/rooms/:code/answer', mutateLimit, async (req, res, next) => {
  try {
    const creds = requirePlayer(req, res);
    if (!creds) return;
    const room = await store.answerQuestion(
      req.params.code,
      creds.playerId,
      creds.token,
      req.body && req.body.questionId,
      req.body && req.body.answer
    );
    sendRoom(res, room, creds.playerId);
  } catch (err) {
    next(err);
  }
});

router.post('/rooms/:code/leave', mutateLimit, async (req, res, next) => {
  try {
    const creds = requirePlayer(req, res);
    if (!creds) return;
    const room = await store.leaveRoom(req.params.code, creds.playerId, creds.token);
    sendRoom(res, room, creds.playerId);
  } catch (err) {
    next(err);
  }
});

setInterval(() => {
  store.cleanupAbandoned().catch((err) => {
    console.warn('[multiplayer] cleanup', err.message);
  });
}, 15000).unref();

module.exports = router;
