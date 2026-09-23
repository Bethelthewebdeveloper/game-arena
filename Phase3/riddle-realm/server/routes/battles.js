const express = require('express');
const rateLimit = require('express-rate-limit');
const store = require('../services/battleStore');
const { publicLink } = require('../utils/publicUrl');

const router = express.Router();

const limit = rateLimit({
  windowMs: 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many battle requests', code: 'RATE_LIMIT' }
});

function guestKey(req) {
  return String(
    (req.body && req.body.guestKey) ||
      req.headers['x-guest-key'] ||
      (req.query && req.query.guestKey) ||
      ''
  ).trim();
}

router.get('/', (req, res) => {
  res.json({ success: true, data: { battles: store.listPublic() } });
});

router.post('/', limit, (req, res, next) => {
  try {
    const body = req.body || {};
    const minutes = parseInt(body.timerMinutes, 10);
    const durationMs = body.durationMs || (minutes > 0 ? minutes * 60 * 1000 : undefined);
    const b = store.createBattle({
      type: body.type,
      name: body.name,
      description: body.description,
      startsAt: body.startsAt,
      durationMs: durationMs,
      attemptLimit: body.attemptLimit,
      scoring: body.scoring
    });
    const share = publicLink(req, '/battle/' + b.battleId);
    res.status(201).json({
      success: true,
      data: {
        battle: store.publicBattle(b, false),
        share: share
      }
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', (req, res) => {
  const b = store.getBattle(req.params.id);
  if (!b) return res.status(404).json({ success: false, error: 'Battle not found', code: 'BATTLE_NOT_FOUND' });
  res.json({
    success: true,
    data: {
      battle: store.publicBattle(b, false),
      leaderboard: store.leaderboard(b, guestKey(req))
    }
  });
});

router.post('/:id/join', limit, (req, res, next) => {
  try {
    const out = store.joinBattle(req.params.id, guestKey(req));
    res.json({ success: true, data: out });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/submit', limit, (req, res, next) => {
  try {
    const out = store.submitBattle(req.params.id, guestKey(req), req.body.answers || []);
    res.json({ success: true, data: out });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
