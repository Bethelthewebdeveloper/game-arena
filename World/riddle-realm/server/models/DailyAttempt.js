/**
 * Anonymous daily challenge attempts (Phase 26).
 * One attempt document per guestKey + dateKey.
 * Server validates rewards — client cannot re-claim.
 */
const mongoose = require('mongoose');

const DailyAttemptSchema = new mongoose.Schema(
  {
    guestKey: { type: String, required: true, index: true },
    dateKey: { type: String, required: true, index: true },
    riddleIds: [{ type: String }],
    started: { type: Boolean, default: false },
    completed: { type: Boolean, default: false },
    score: { type: Number, default: 0 },
    correct: { type: Number, default: 0 },
    wrong: { type: Number, default: 0 },
    streak: { type: Number, default: 0 },
    xpAwarded: { type: Number, default: 0 },
    coinsAwarded: { type: Number, default: 0 },
    bonusXp: { type: Number, default: 0 },
    bonusCoins: { type: Number, default: 0 },
    rewardClaimed: { type: Boolean, default: false },
    difficultyBreakdown: {
      type: Map,
      of: { answered: Number, correct: Number },
      default: {}
    },
    completedAt: { type: Date, default: null },
    startedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

DailyAttemptSchema.index({ guestKey: 1, dateKey: 1 }, { unique: true });
DailyAttemptSchema.index({ dateKey: 1, completed: 1 });

module.exports = mongoose.model('DailyAttempt', DailyAttemptSchema);
