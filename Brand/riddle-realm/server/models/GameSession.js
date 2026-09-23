const mongoose = require('mongoose');

const GameSessionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    guestKey: { type: String, index: true },
    gameId: { type: String, required: true, index: true },
    mode: { type: String, default: '' },
    difficulty: { type: String, default: '' },
    score: { type: Number, default: 0, min: 0 },
    xpAwarded: { type: Number, default: 0 },
    coinsAwarded: { type: Number, default: 0 },
    meta: { type: Object, default: {} },
    playedAt: { type: Date, default: Date.now, index: true }
  },
  { timestamps: true }
);

GameSessionSchema.index({ gameId: 1, score: -1 });

module.exports = mongoose.model('GameSession', GameSessionSchema);
