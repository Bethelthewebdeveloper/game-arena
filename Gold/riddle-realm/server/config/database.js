/**
 * MongoDB connection (Mongoose)
 * Database name: Riddles-Game (from env)
 * Never log credentials or full URI with password.
 */
const mongoose = require('mongoose');

let isConnected = false;

function maskUri(uri) {
  if (!uri || typeof uri !== 'string') return '(missing)';
  return uri.replace(/\/\/([^:]+):([^@]+)@/, '//$1:***@');
}

async function connectDatabase() {
  const uri = process.env.MONGODB_URI;
  const dbName = process.env.MONGODB_DB_NAME || 'Riddles-Game';

  if (!uri || !String(uri).trim()) {
    const err = new Error('MONGODB_URI is missing. Copy .env.example to .env and set your Atlas URI.');
    err.code = 'MISSING_URI';
    throw err;
  }

  if (isConnected && mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  mongoose.set('strictQuery', true);

  await mongoose.connect(uri, {
    dbName,
    serverSelectionTimeoutMS: 10000
  });

  isConnected = true;
  console.log('MongoDB connected successfully');
  console.log('Database:', dbName);
  console.log('URI host:', maskUri(uri).replace(/^.*@/, '@') || '(masked)');

  mongoose.connection.on('error', (e) => {
    console.error('MongoDB connection error:', e.message);
  });

  mongoose.connection.on('disconnected', () => {
    isConnected = false;
    console.warn('MongoDB disconnected');
  });

  return mongoose.connection;
}

function getConnectionState() {
  const states = ['disconnected', 'connected', 'connecting', 'disconnecting'];
  return {
    readyState: mongoose.connection.readyState,
    state: states[mongoose.connection.readyState] || 'unknown',
    dbName: process.env.MONGODB_DB_NAME || 'Riddles-Game',
    isConnected: mongoose.connection.readyState === 1
  };
}

module.exports = {
  connectDatabase,
  getConnectionState,
  maskUri
};
