/**
 * Safe MongoDB connection test — never prints passwords.
 * Usage: node scripts/test-db-connection.js
 */
require('dotenv').config();
const { connectDatabase, getConnectionState, maskUri } = require('../server/config/database');

async function main() {
  console.log('Testing MongoDB connection…');
  console.log('MONGODB_DB_NAME:', process.env.MONGODB_DB_NAME || 'Riddles-Game');
  console.log('MONGODB_URI set:', process.env.MONGODB_URI ? 'yes' : 'NO');
  if (process.env.MONGODB_URI) {
    console.log('URI (masked):', maskUri(process.env.MONGODB_URI));
  }

  try {
    await connectDatabase();
    const state = getConnectionState();
    console.log('Result: SUCCESS');
    console.log('State:', state);
    process.exit(0);
  } catch (err) {
    console.log('Result: FAILED');
    console.log('Error:', err.message);
    console.log('Category:', err.code || err.name || 'unknown');
    process.exit(1);
  }
}

main();
