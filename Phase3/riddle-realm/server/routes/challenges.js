const express = require('express');
const rateLimit = require('express-rate-limit');
const store = require('../services/challengeStore');

const router = express.Router();

const limit = rateLimit({
  windowMs: 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many challenge requests', code: 'RATE_LIMIT' }
});

function guestKey(req) {
  return String(
    (req.body && req.body.guestKey) || req.headers['x-guest-key'] || ''
  ).trim();
}

router.post('/', limit, (req, res) => {
  const body = req.body || {};
  const row = store.createChallenge({
    guestKey: guestKey(req),
    name: body.name,
    score: body.score,
    level: body.level,
    streak: body.streak,
    mode: body.mode
  });
  res.status(201).json({ success: true, data: store.publicChallenge(row) });
});

router.get('/:id', (req, res, next) => {
  try {
    const pub = store.openChallenge(req.params.id);
    res.json({ success: true, data: pub });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/submit', limit, (req, res, next) => {
  try {
    const out = store.submitChallenge(req.params.id, guestKey(req), req.body.score);
    res.json({ success: true, data: out });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
