/**
 * Future cloud player progress (Phase 21+ links to User).
 * No fake users created in Phase 20.
 */
const mongoose = require('mongoose');

const PlayerProgressSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    // Optional guest key until auth exists
    guestKey: { type: String, index: true, sparse: true },
    name: { type: String, default: 'Riddler' },
    xp: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
    coins: { type: Number, default: 0 },
    bestScore: { type: Number, default: 0 },
    totalCorrect: { type: Number, default: 0 },
    totalWrong: { type: Number, default: 0 },
    totalSolved: { type: Number, default: 0 },
    gamesPlayed: { type: Number, default: 0 },
    currentStreak: { type: Number, default: 0 },
    bestStreak: { type: Number, default: 0 },
    stats: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

module.exports = mongoose.model('PlayerProgress', PlayerProgressSchema);
