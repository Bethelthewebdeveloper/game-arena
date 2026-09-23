/**
 * Unpredictable public codes (not sequential).
 */
const crypto = require('crypto');

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function publicCode(length) {
  const len = length || 6;
  let out = '';
  for (let i = 0; i < len; i++) {
    out += CHARS[crypto.randomInt(0, CHARS.length)];
  }
  return out;
}

function guestId() {
  return 'guest_' + crypto.randomBytes(3).toString('hex').toUpperCase().slice(0, 5);
}

function eventId() {
  return 'ev_' + Date.now().toString(36) + crypto.randomBytes(4).toString('hex');
}

module.exports = { publicCode, guestId, eventId };
