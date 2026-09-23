const mongoose = require('mongoose');

const PlayerProfileSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', unique: true, index: true },
    xp: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
    xpNeeded: { type: Number, default: 100 },
    coins: { type: Number, default: 0 },
    gamesPlayed: { type: Number, default: 0 },
    bestScore: { type: Number, default: 0 },
    gameStats: { type: Object, default: {} }
  },
  { timestamps: true }
);

module.exports = mongoose.model('PlayerProfile', PlayerProfileSchema);
