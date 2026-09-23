const crypto = require('crypto');
const { promisify } = require('util');
const scrypt = promisify(crypto.scrypt);
const KEYLEN = 64;
async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = await scrypt(String(password), salt, KEYLEN);
  return { salt, hash: derived.toString('hex') };
}
async function verifyPassword(password, salt, hash) {
  const derived = await scrypt(String(password), salt, KEYLEN);
  const a = Buffer.from(hash, 'hex');
  const b = derived;
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}
function createSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}
module.exports = { hashPassword, verifyPassword, createSessionToken };
