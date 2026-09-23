/**
 * Founder Access Key auth (Phase 26B)
 * Secret lives only in FOUNDER_ACCESS_KEY env — never returned to clients.
 * Sessions are HMAC-signed tokens (no MongoDB required for this path).
 */
const crypto = require('crypto');

const SESSION_MS = 12 * 60 * 60 * 1000; // 12 hours
const FAIL_WINDOW_MS = 15 * 60 * 1000;
const FAIL_LOCK_MS = 5 * 60 * 1000;
const FAIL_MAX = 8;

/** ip -> { fails: number, firstAt: number, lockedUntil: number } */
const attemptMap = new Map();
/** jti -> expiresAt (for logout / revocation) */
const revoked = new Set();
const activeSessions = new Map();

function getConfiguredKey() {
  const key = process.env.FOUNDER_ACCESS_KEY;
  if (!key || !String(key).trim()) return null;
  return String(key);
}

function isConfigured() {
  return !!getConfiguredKey();
}

function clientId(req) {
  const xf = req.headers['x-forwarded-for'];
  if (xf) return String(xf).split(',')[0].trim();
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function getAttemptState(id) {
  const now = Date.now();
  let st = attemptMap.get(id);
  if (!st) {
    st = { fails: 0, firstAt: now, lockedUntil: 0 };
    attemptMap.set(id, st);
  }
  if (st.firstAt + FAIL_WINDOW_MS < now) {
    st.fails = 0;
    st.firstAt = now;
  }
  return st;
}

function isLocked(req) {
  const st = getAttemptState(clientId(req));
  return st.lockedUntil > Date.now();
}

function lockRemainingMs(req) {
  const st = getAttemptState(clientId(req));
  return Math.max(0, st.lockedUntil - Date.now());
}

function recordFailure(req) {
  const st = getAttemptState(clientId(req));
  st.fails += 1;
  console.warn('[founder] access denied attempt from', clientId(req), 'fails=', st.fails);
  if (st.fails >= FAIL_MAX) {
    st.lockedUntil = Date.now() + FAIL_LOCK_MS;
    st.fails = 0;
    st.firstAt = Date.now();
    console.warn('[founder] temporary lockout for', clientId(req));
  }
}

function recordSuccess(req) {
  attemptMap.delete(clientId(req));
}

function timingSafeEqualStr(a, b) {
  const ba = Buffer.from(String(a), 'utf8');
  const bb = Buffer.from(String(b), 'utf8');
  if (ba.length !== bb.length) {
    // still do a compare to reduce timing leak on length
    crypto.timingSafeEqual(ba.length ? ba : Buffer.from('x'), ba.length ? ba : Buffer.from('x'));
    return false;
  }
  return crypto.timingSafeEqual(ba, bb);
}

function verifyAccessKey(submitted) {
  const expected = getConfiguredKey();
  if (!expected) return { ok: false, code: 'NOT_CONFIGURED' };
  if (!submitted || typeof submitted !== 'string') return { ok: false, code: 'DENIED' };
  if (!timingSafeEqualStr(submitted.trim(), expected)) return { ok: false, code: 'DENIED' };
  return { ok: true };
}

function sign(body) {
  const key = getConfiguredKey();
  if (!key) return null;
  return crypto.createHmac('sha256', key).update(body).digest('base64url');
}

function createSessionToken() {
  const key = getConfiguredKey();
  if (!key) return null;
  const exp = Date.now() + SESSION_MS;
  const jti = crypto.randomBytes(16).toString('hex');
  const payload = { role: 'founder', exp, jti, v: 1 };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = sign(body);
  const token = body + '.' + sig;
  activeSessions.set(jti, exp);
  return { token, expiresAt: new Date(exp).toISOString(), jti };
}

function verifySessionToken(token) {
  if (!token || typeof token !== 'string' || !getConfiguredKey()) return false;
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [body, sig] = parts;
  const expected = sign(body);
  if (!expected || !timingSafeEqualStr(sig, expected)) return false;
  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch (e) {
    return false;
  }
  if (!payload || payload.role !== 'founder' || payload.v !== 1) return false;
  if (!payload.exp || Date.now() > payload.exp) return false;
  if (revoked.has(payload.jti)) return false;
  // If we track active sessions, require presence (survives restart by re-login)
  if (activeSessions.has(payload.jti)) {
    return activeSessions.get(payload.jti) > Date.now();
  }
  // Accept valid HMAC even after restart (signature proves possession of key)
  return true;
}

function revokeSessionToken(token) {
  if (!token) return;
  try {
    const body = token.split('.')[0];
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (payload && payload.jti) {
      revoked.add(payload.jti);
      activeSessions.delete(payload.jti);
    }
  } catch (e) {
    /* ignore */
  }
}

module.exports = {
  isConfigured,
  isLocked,
  lockRemainingMs,
  recordFailure,
  recordSuccess,
  verifyAccessKey,
  createSessionToken,
  verifySessionToken,
  revokeSessionToken,
  clientId
};
