/**
 * Score Challenge — one player’s verified target vs a friend’s attempt.
 * Separate from Battle and Multiplayer.
 */
const { publicCode } = require('../utils/ids');
const events = require('./eventLog');

const challenges = new Map();
const MAX_SCORE = 5000;

function createChallenge(opts) {
  opts = opts || {};
  const score = Math.max(0, Math.min(MAX_SCORE, parseInt(opts.score, 10) || 0));
  const level = Math.max(1, parseInt(opts.level, 10) || 1);
  const streak = Math.max(0, parseInt(opts.streak, 10) || 0);
  const challengeId = publicCode(6);
  const row = {
    challengeId,
    hostGuestKey: String(opts.guestKey || 'guest').slice(0, 32),
    hostName: String(opts.name || 'Riddler').slice(0, 24),
    targetScore: score,
    level,
    streak,
    mode: String(opts.mode || 'classic').slice(0, 24),
    opened: 0,
    attempts: [],
    createdAt: Date.now(),
    expiresAt: Date.now() + 14 * 864e5
  };
  challenges.set(challengeId, row);
  events.record('challenge_created', 'Score challenge ' + challengeId + ' for ' + score + ' pts', {
    guestKey: row.hostGuestKey,
    ref: challengeId
  });
  return row;
}

function publicChallenge(c) {
  if (!c) return null;
  return {
    challengeId: c.challengeId,
    hostName: c.hostName,
    targetScore: c.targetScore,
    level: c.level,
    streak: c.streak,
    mode: c.mode,
    link: '/challenge/' + c.challengeId,
    attemptCount: c.attempts.length,
    openCount: c.opened
  };
}

function getChallenge(id) {
  const c = challenges.get(String(id || '').trim().toUpperCase());
  if (!c) return null;
  if (c.expiresAt < Date.now()) return null;
  return c;
}

function openChallenge(id) {
  const c = getChallenge(id);
  if (!c) {
    const err = new Error('Challenge not found or expired');
    err.status = 404;
    err.code = 'CHALLENGE_NOT_FOUND';
    throw err;
  }
  c.opened += 1;
  events.record('challenge_open', 'Challenge link opened ' + c.challengeId, { ref: c.challengeId });
  return publicChallenge(c);
}

function submitChallenge(id, guestKey, rawScore) {
  const c = getChallenge(id);
  if (!c) {
    const err = new Error('Challenge not found or expired');
    err.status = 404;
    err.code = 'CHALLENGE_NOT_FOUND';
    throw err;
  }
  const score = Math.max(0, Math.min(MAX_SCORE, parseInt(rawScore, 10) || 0));
  const gk = String(guestKey || 'guest').slice(0, 32);
  const beaten = score > c.targetScore;
  c.attempts.push({ guestKey: gk, score, beaten, at: Date.now() });
  events.record(
    beaten ? 'challenge_beaten' : 'challenge_completed',
    (beaten ? 'Challenge beaten' : 'Challenge played') + ' ' + c.challengeId,
    { guestKey: gk, ref: c.challengeId }
  );
  return {
    yours: score,
    target: c.targetScore,
    beaten: beaten,
    hostName: c.hostName,
    challenge: publicChallenge(c)
  };
}

function stats() {
  const list = Array.from(challenges.values()).filter((c) => c.expiresAt >= Date.now());
  return {
    created: challenges.size,
    active: list.length,
    opened: list.reduce((n, c) => n + c.opened, 0),
    played: list.reduce((n, c) => n + c.attempts.length, 0),
    beaten: list.reduce((n, c) => n + c.attempts.filter((a) => a.beaten).length, 0)
  };
}

module.exports = {
  createChallenge,
  publicChallenge,
  getChallenge,
  openChallenge,
  submitChallenge,
  stats
};
