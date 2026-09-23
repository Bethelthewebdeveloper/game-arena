/**
 * Social share initiations (Phase 26).
 * Records "initiated" events only — browsers cannot reliably confirm completion.
 */
const mongoose = require('mongoose');

const ShareEventSchema = new mongoose.Schema(
  {
    guestKey: { type: String, index: true, default: null },
    channel: {
      type: String,
      enum: ['share_button', 'whatsapp', 'native', 'copy', 'other'],
      required: true,
      index: true
    },
    source: {
      type: String,
      enum: ['daily_result', 'challenge', 'other'],
      default: 'daily_result',
      index: true
    },
    dateKey: { type: String, index: true, default: null },
    score: { type: Number, default: null },
    streak: { type: Number, default: null },
    // Always "initiated" — we do not claim completion
    status: { type: String, default: 'initiated', enum: ['initiated'] }
  },
  { timestamps: true }
);

ShareEventSchema.index({ createdAt: -1 });
ShareEventSchema.index({ channel: 1, createdAt: -1 });

module.exports = mongoose.model('ShareEvent', ShareEventSchema);
