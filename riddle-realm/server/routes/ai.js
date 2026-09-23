/**
 * Phase 22 — Anonymous AI usage gate (no player accounts).
 * Does NOT expose AI_API_KEY. Real provider calls only when key is set.
 * Usage is tracked by X-Device-Id + calendar day (server local date).
 */
const express = require('express');
const rateLimit = require('express-rate-limit');
const { getConnectionState } = require('../config/database');
const AiUsage = require('../models/AiUsage');

const router = express.Router();

const FREE_DAILY = parseInt(process.env.AI_DAILY_FREE_LIMIT, 10) || 20;
// Pro server-side entitlement is future work; anonymous clients are Free.
const PRO_DAILY = parseInt(process.env.AI_DAILY_PRO_LIMIT, 10) || 200;

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many AI requests', code: 'RATE_LIMIT' }
});

router.use(aiLimiter);

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

function deviceIdFrom(req) {
  const h = String(req.headers['x-device-id'] || '').trim().slice(0, 80);
  if (h && /^[a-zA-Z0-9_-]+$/.test(h)) return h;
  return null;
}

function requireDb(res) {
  if (!getConnectionState().isConnected) {
    res.status(503).json({ success: false, error: 'Database unavailable', code: 'DB_UNAVAILABLE' });
    return false;
  }
  return true;
}

router.get('/status', async (req, res, next) => {
  try {
    const deviceId = deviceIdFrom(req);
    if (!deviceId) {
      return res.status(400).json({ success: false, error: 'X-Device-Id required', code: 'NO_DEVICE' });
    }
    const limit = FREE_DAILY;
    let used = 0;
    if (getConnectionState().isConnected) {
      const row = await AiUsage.findOne({ deviceId, dateKey: todayKey() }).lean();
      used = (row && row.count) || 0;
    }
    res.json({
      success: true,
      data: {
        date: todayKey(),
        used,
        limit,
        remaining: Math.max(0, limit - used),
        plan: 'free',
        providerConfigured: !!(process.env.AI_API_KEY && String(process.env.AI_API_KEY).trim()),
        note: 'Anonymous Free limit. Resets on server calendar day change.'
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Consume one Free AI slot. Call before serving AI content.
 * Body: { type?: string }
 */
router.post('/consume', async (req, res, next) => {
  try {
    if (!requireDb(res)) return;
    const deviceId = deviceIdFrom(req);
    if (!deviceId) {
      return res.status(400).json({ success: false, error: 'X-Device-Id required', code: 'NO_DEVICE' });
    }
    const type = String((req.body && req.body.type) || 'unknown').slice(0, 40);
    const dateKey = todayKey();
    const limit = FREE_DAILY;

    let row = await AiUsage.findOne({ deviceId, dateKey });
    if (!row) {
      row = await AiUsage.create({ deviceId, dateKey, count: 0, byType: {} });
    }
    if (row.count >= limit) {
      return res.status(429).json({
        success: false,
        error: 'Free AI limit reached for today',
        code: 'AI_LIMIT',
        data: { used: row.count, limit, remaining: 0, date: dateKey }
      });
    }

    row.count += 1;
    const prev = row.byType.get(type) || 0;
    row.byType.set(type, prev + 1);
    await row.save();

    res.json({
      success: true,
      data: {
        used: row.count,
        limit,
        remaining: Math.max(0, limit - row.count),
        date: dateKey,
        type
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * Optional: generate via provider when AI_API_KEY is set.
 * Without key, returns 501 so client uses local helpers after /consume.
 */
router.post('/generate', async (req, res, next) => {
  try {
    const key = process.env.AI_API_KEY && String(process.env.AI_API_KEY).trim();
    if (!key) {
      return res.status(501).json({
        success: false,
        error: 'AI provider not configured',
        code: 'AI_NOT_CONFIGURED'
      });
    }
    // Placeholder — real provider integration later; never log the key
    res.status(501).json({
      success: false,
      error: 'AI provider adapter not implemented yet',
      code: 'AI_ADAPTER_PENDING'
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
