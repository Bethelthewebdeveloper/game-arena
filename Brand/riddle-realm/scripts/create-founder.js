/**
 * Secure founder provisioning — DEVELOPMENT / ops use only.
 * Usage:
 *   FOUNDER_EMAIL=you@example.com FOUNDER_USERNAME=founder FOUNDER_PASSWORD='long-secret' node scripts/create-founder.js
 * Never commit real passwords. Not a public registration path.
 */
require('dotenv').config();
const { connectDatabase } = require('../server/config/database');
const User = require('../server/models/User');
const { hashPassword } = require('../server/utils/password');

async function main() {
  const email = process.env.FOUNDER_EMAIL;
  const username = process.env.FOUNDER_USERNAME || 'founder';
  const password = process.env.FOUNDER_PASSWORD;

  if (!email || !password || password.length < 12) {
    console.error('Set FOUNDER_EMAIL and FOUNDER_PASSWORD (min 12 chars). Optional FOUNDER_USERNAME.');
    process.exit(1);
  }

  await connectDatabase();
  const uname = String(username).trim().toLowerCase();
  const em = String(email).trim().toLowerCase();
  let user = await User.findOne({ $or: [{ email: em }, { username: uname }] });
  const { salt, hash } = await hashPassword(password);

  if (user) {
    user.role = 'founder';
    user.passwordHash = hash;
    user.passwordSalt = salt;
    user.email = em;
    user.username = uname;
    user.status = 'active';
    await user.save();
    console.log('Updated existing user to FOUNDER:', user.username);
  } else {
    user = await User.create({
      username: uname,
      email: em,
      passwordHash: hash,
      passwordSalt: salt,
      displayName: 'Founder',
      role: 'founder',
      status: 'active'
    });
    console.log('Created FOUNDER account:', user.username);
  }
  process.exit(0);
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
