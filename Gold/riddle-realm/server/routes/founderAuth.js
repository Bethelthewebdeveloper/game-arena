/**
 * Founder access — Phase 26B
 * Primary: FOUNDER_ACCESS_KEY (server env only).
 * Optional legacy: username + password + PIN when MongoDB founders exist.
 */
const express = require('express');
const rateLimit = require('express-rate-limit');
const User = require('../models/User');
const Session = require('../models/Session');
const { hashPassword, verifyPassword, createSessionToken } = require('../utils/password');
const { getConnectionState } = require('../config/database');
const { hashToken, authenticateUser, requireFounder, getBearer } = require('../middleware/auth');
const founderAccess = require('../services/founderAccess');

const router = express.Router();
const SESSION_DAYS = 1;

const founderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many attempts', code: 'RATE_LIMIT' }
});

const verifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Access denied', code: 'RATE_LIMIT' }
});

function requireDb(res) {
  if (!getConnectionState().isConnected) {
    res.status(503).json({ success: false, error: 'Database unavailable', code: 'DB_UNAVAILABLE' });
    return false;
  }
  return true;
}

/** Public: is access-key mode configured? (never returns the secret) */
router.get('/access-status', (req, res) => {
  res.json({
    success: true,
    data: {
      accessKeyConfigured: founderAccess.isConfigured(),
      message: founderAccess.isConfigured()
        ? 'Enter your Founder Access Key to continue.'
        : 'Set FOUNDER_ACCESS_KEY on the server environment to enable Founder access.'
    }
  });
});

/**
 * POST /api/founder/verify
 * Body: { accessKey: "..." }
 * Compares to FOUNDER_ACCESS_KEY. Never returns the secret.
 */
router.post('/verify', verifyLimiter, (req, res) => {
  if (founderAccess.isLocked(req)) {
    const sec = Math.ceil(founderAccess.lockRemainingMs(req) / 1000);
    return res.status(429).json({
      success: false,
      error: 'Access denied. Try again later.',
      code: 'TEMP_LOCKOUT',
      retryAfterSeconds: sec
    });
  }

  if (!founderAccess.isConfigured()) {
    return res.status(503).json({
      success: false,
      error: 'Founder access is not configured on this server.',
      code: 'NOT_CONFIGURED'
    });
  }

  const submitted = req.body && (req.body.accessKey || req.body.key || req.body.password);
  const result = founderAccess.verifyAccessKey(submitted);

  if (!result.ok) {
    founderAccess.recordFailure(req);
    return res.status(401).json({
      success: false,
      error: 'Access denied',
      code: 'DENIED'
    });
  }

  founderAccess.recordSuccess(req);
  const session = founderAccess.createSessionToken();
  if (!session) {
    return res.status(503).json({
      success: false,
      error: 'Founder access is not configured on this server.',
      code: 'NOT_CONFIGURED'
    });
  }

  res.json({
    success: true,
    token: session.token,
    expiresAt: session.expiresAt,
    message: 'Founder session started'
  });
});

/** Check current founder session (access-key or user) */
router.get('/session', (req, res) => {
  const token = getBearer(req);
  if (token && founderAccess.verifySessionToken(token)) {
    return res.json({ success: true, data: { authenticated: true, method: 'access_key' } });
  }
  res.status(401).json({ success: false, error: 'Access denied', code: 'UNAUTHENTICATED' });
});

/** Logout access-key session */
router.post('/logout-key', (req, res) => {
  const token = getBearer(req);
  founderAccess.revokeSessionToken(token);
  res.json({ success: true });
});

/** Public: whether Mongo founder user setup is still available */
router.get('/setup-status', async (req, res, next) => {
  try {
    if (!getConnectionState().isConnected) {
      return res.json({
        success: true,
        data: {
          setupRequired: false,
          foundersExist: false,
          accessKeyConfigured: founderAccess.isConfigured(),
          dbAvailable: false
        }
      });
    }
    const count = await User.countDocuments({ role: 'founder' });
    res.json({
      success: true,
      data: {
        setupRequired: count === 0 && !founderAccess.isConfigured(),
        foundersExist: count > 0,
        accessKeyConfigured: founderAccess.isConfigured(),
        dbAvailable: true
      }
    });
  } catch (err) {
    next(err);
  }
});

/**
 * One-time founder user create (legacy, Mongo only).
 * Prefer FOUNDER_ACCESS_KEY for ops access.
 */
router.post('/setup', founderLimiter, async (req, res, next) => {
  try {
    if (!requireDb(res)) return;
    const existing = await User.countDocuments({ role: 'founder' });
    if (existing > 0) {
      return res.status(403).json({
        success: false,
        error: 'Founder already configured',
        code: 'SETUP_CLOSED'
      });
    }

    const username = String(req.body.username || '')
      .trim()
      .toLowerCase();
    const password = String(req.body.password || '');
    const password2 = String(req.body.passwordConfirm || req.body.confirmPassword || password);
    const pin = String(req.body.pin || '').trim();
    const pin2 = String(req.body.pinConfirm || req.body.confirmPin || pin);

    if (username.length < 3 || username.length > 32) {
      return res.status(400).json({ success: false, error: 'Username must be 3–32 characters' });
    }
    if (!/^[a-z0-9_]+$/.test(username)) {
      return res.status(400).json({ success: false, error: 'Username: letters, numbers, underscore only' });
    }
    if (password.length < 12) {
      return res.status(400).json({ success: false, error: 'Password must be at least 12 characters' });
    }
    if (password !== password2) {
      return res.status(400).json({ success: false, error: 'Passwords do not match' });
    }
    if (!/^\d{4,12}$/.test(pin)) {
      return res.status(400).json({ success: false, error: 'PIN must be 4–12 digits' });
    }
    if (pin !== pin2) {
      return res.status(400).json({ success: false, error: 'PINs do not match' });
    }

    const taken = await User.findOne({ username });
    if (taken) {
      return res.status(409).json({ success: false, error: 'Username already in use' });
    }

    const pw = await hashPassword(password);
    const pn = await hashPassword(pin);
    const email = `founder+${username}@local.invalid`;

    const user = await User.create({
      username,
      email,
      passwordHash: pw.hash,
      passwordSalt: pw.salt,
      pinHash: pn.hash,
      pinSalt: pn.salt,
      displayName: 'Founder',
      role: 'founder',
      status: 'active'
    });

    const token = createSessionToken();
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 864e5);
    await Session.create({ tokenHash: hashToken(token), userId: user._id, expiresAt });

    res.status(201).json({
      success: true,
      token,
      expiresAt,
      user: { id: String(user._id), username: user.username, role: 'founder' },
      message: 'Founder user created. Prefer FOUNDER_ACCESS_KEY for server ops access.'
    });
  } catch (err) {
    if (err && err.code === 11000) {
      return res.status(409).json({ success: false, error: 'Username already in use' });
    }
    next(err);
  }
});

/** Founder login: username + password + PIN (Mongo path) */
router.post('/login', founderLimiter, async (req, res, next) => {
  try {
    if (!requireDb(res)) return;
    const username = String(req.body.username || '')
      .trim()
      .toLowerCase();
    const password = String(req.body.password || '');
    const pin = String(req.body.pin || '').trim();

    if (!username || !password || !pin) {
      return res.status(400).json({ success: false, error: 'Username, password, and PIN required' });
    }

    const user = await User.findOne({ username, role: 'founder' }).select(
      '+passwordHash +passwordSalt +pinHash +pinSalt'
    );
    if (!user || user.status === 'disabled') {
      return res.status(401).json({ success: false, error: 'Access denied' });
    }
    if (!user.pinHash || !user.pinSalt) {
      return res.status(401).json({ success: false, error: 'Access denied' });
    }

    const pwOk = await verifyPassword(password, user.passwordSalt, user.passwordHash);
    const pinOk = await verifyPassword(pin, user.pinSalt, user.pinHash);
    if (!pwOk || !pinOk) {
      return res.status(401).json({ success: false, error: 'Access denied' });
    }

    user.lastLoginAt = new Date();
    await user.save();

    const token = createSessionToken();
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 864e5);
    await Session.create({ tokenHash: hashToken(token), userId: user._id, expiresAt });

    res.json({
      success: true,
      token,
      expiresAt,
      user: { id: String(user._id), username: user.username, role: 'founder' }
    });
  } catch (err) {
    next(err);
  }
});

router.post('/logout', async (req, res, next) => {
  try {
    const token = getBearer(req);
    founderAccess.revokeSessionToken(token);
    if (getConnectionState().isConnected && token) {
      try {
        await Session.deleteOne({ tokenHash: hashToken(token) });
      } catch (e) {
        /* ignore */
      }
    }
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
