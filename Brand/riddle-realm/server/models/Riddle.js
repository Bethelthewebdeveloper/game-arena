/**
 * Riddle document schema — aligned with frontend riddle shape.
 */
const mongoose = require('mongoose');

const RiddleSchema = new mongoose.Schema(
  {
    externalId: { type: String, index: true },
    question: { type: String, required: true, trim: true },
    answer: { type: String, required: true, trim: true },
    options: [{ type: String }],
    category: { type: String, index: true },
    difficulty: {
      type: String,
      enum: ['easy', 'medium', 'hard', 'expert', 'normal'],
      default: 'medium',
      index: true
    },
    hint: { type: String, default: '' },
    explanation: { type: String, default: '' },
    tags: [{ type: String }],
    xpReward: { type: Number, default: 10 },
    coinReward: { type: Number, default: 5 },
    active: { type: Boolean, default: true, index: true },
    source: { type: String, default: 'seed' } // seed | curated | ai_pending
  },
  { timestamps: true }
);

RiddleSchema.index({ category: 1, difficulty: 1 });

module.exports = mongoose.model('Riddle', RiddleSchema);
