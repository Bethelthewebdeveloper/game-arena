/**
 * File-backed accounts when MongoDB is not connected.
 * Real users on disk — not a fake success message.
 */
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const FILE = path.join(__dirname, '..', '..', 'data', 'local-auth.json');

function load() {
  try {
    return JSON.parse(fs.readFileSync(FILE, 'utf8'));
  } catch (e) {
    return { users: [], sessions: [], profiles: [] };
  }
}

function save(db) {
  const dir = path.dirname(FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(db, null, 2));
}

function publicUser(u) {
  return {
    id: u.id,
    username: u.username,
    email: u.email,
    displayName: u.displayName,
    role: u.role || 'player',
    plan: 'free',
    proVerified: false,
    createdAt: u.createdAt
  };
}

function findUser(login) {
  const db = load();
  const key = String(login || '').trim().toLowerCase();
  return db.users.find((u) => u.username === key || u.email === key) || null;
}

function createUser(fields) {
  const db = load();
  if (db.users.some((u) => u.username === fields.username || u.email === fields.email)) {
    const err = new Error('Username or email already in use');
    err.code = 'DUPLICATE';
    throw err;
  }
  const user = {
    id: 'local_' + crypto.randomBytes(8).toString('hex'),
    username: fields.username,
    email: fields.email,
    displayName: fields.displayName,
    role: 'player',
    passwordHash: fields.passwordHash,
    passwordSalt: fields.passwordSalt,
    createdAt: new Date().toISOString()
  };
  db.users.push(user);
  db.profiles.push({
    userId: user.id,
    xp: 0,
    level: 1,
    xpNeeded: 100,
    coins: 0,
    gamesPlayed: 0,
    bestScore: 0
  });
  save(db);
  return user;
}

function createSession(userId, tokenHash, expiresAt) {
  const db = load();
  db.sessions.push({
    tokenHash,
    userId,
    expiresAt: expiresAt instanceof Date ? expiresAt.toISOString() : expiresAt
  });
  save(db);
}

function getSession(tokenHash) {
  const db = load();
  const now = Date.now();
  return (
    db.sessions.find((s) => s.tokenHash === tokenHash && new Date(s.expiresAt).getTime() > now) ||
    null
  );
}

function deleteSession(tokenHash) {
  const db = load();
  db.sessions = db.sessions.filter((s) => s.tokenHash !== tokenHash);
  save(db);
}

function getUserById(id) {
  const db = load();
  return db.users.find((u) => u.id === id) || null;
}

module.exports = {
  findUser,
  createUser,
  createSession,
  getSession,
  deleteSession,
  getUserById,
  publicUser
};
