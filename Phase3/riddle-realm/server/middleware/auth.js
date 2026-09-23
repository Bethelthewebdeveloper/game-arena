const crypto = require('crypto');
const User = require('../models/User');
const Session = require('../models/Session');
const { getConnectionState } = require('../config/database');
const founderAccess = require('../services/founderAccess');

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function getBearer(req) {
  const header = req.headers.authorization || '';
  if (header.startsWith('Bearer ')) return header.slice(7);
  return null;
}

async function authenticateUser(req, res, next) {
  try {
    if (!getConnectionState().isConnected) {
      return res.status(503).json({ success: false, error: 'Database unavailable', code: 'DB_UNAVAILABLE' });
    }
    const token = getBearer(req);
    if (!token) {
      return res.status(401).json({ success: false, error: 'Not authenticated', code: 'UNAUTHENTICATED' });
    }
    const session = await Session.findOne({
      tokenHash: hashToken(token),
      expiresAt: { $gt: new Date() }
    });
    if (!session) {
      return res.status(401).json({ success: false, error: 'Session expired', code: 'SESSION_EXPIRED' });
    }
    const user = await User.findById(session.userId);
    if (!user || user.status === 'disabled') {
      return res.status(401).json({ success: false, error: 'User not found', code: 'USER_INVALID' });
    }
    req.user = user;
    req.session = session;
    next();
  } catch (err) {
    next(err);
  }
}

function requireRoles(...roles) {
  const allowed = roles.map((r) => String(r).toLowerCase());
  return function checkRole(req, res, next) {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Not authenticated', code: 'UNAUTHENTICATED' });
    }
    const role = String(req.user.role || '').toLowerCase();
    if (!allowed.includes(role)) {
      return res.status(403).json({
        success: false,
        error: 'Forbidden',
        code: 'FORBIDDEN_ROLE'
      });
    }
    next();
  };
}

const requireFounder = requireRoles('founder');

/**
 * Accept either FOUNDER_ACCESS_KEY session token OR Mongo founder user session.
 * Always responds with generic "Access denied" on failure.
 */
async function authenticateFounderAny(req, res, next) {
  try {
    const token = getBearer(req);
    if (!token) {
      return res.status(401).json({ success: false, error: 'Access denied', code: 'UNAUTHENTICATED' });
    }

    if (founderAccess.verifySessionToken(token)) {
      req.founderAuth = { type: 'access_key' };
      req.user = { role: 'founder', username: 'founder' };
      return next();
    }

    if (!getConnectionState().isConnected) {
      return res.status(401).json({ success: false, error: 'Access denied', code: 'UNAUTHENTICATED' });
    }

    const session = await Session.findOne({
      tokenHash: hashToken(token),
      expiresAt: { $gt: new Date() }
    });
    if (!session) {
      return res.status(401).json({ success: false, error: 'Access denied', code: 'UNAUTHENTICATED' });
    }
    const user = await User.findById(session.userId);
    if (!user || user.status === 'disabled' || String(user.role).toLowerCase() !== 'founder') {
      return res.status(403).json({ success: false, error: 'Access denied', code: 'FORBIDDEN' });
    }
    req.user = user;
    req.session = session;
    req.founderAuth = { type: 'user_session' };
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  authenticateUser,
  requireRoles,
  requireFounder,
  authenticateFounderAny,
  hashToken,
  getBearer
};
