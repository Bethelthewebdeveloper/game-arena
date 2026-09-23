/**
 * Anonymous AI usage by device id + calendar day (UTC date string).
 * Not a player account — Phase 22 zero-auth design.
 */
const mongoose = require('mongoose');

const AiUsageSchema = new mongoose.Schema(
  {
    deviceId: { type: String, required: true, index: true, maxlength: 80 },
    dateKey: { type: String, required: true, index: true }, // YYYY-MM-DD
    count: { type: Number, default: 0, min: 0 },
    byType: { type: Map, of: Number, default: {} }
  },
  { timestamps: true }
);

AiUsageSchema.index({ deviceId: 1, dateKey: 1 }, { unique: true });

module.exports = mongoose.model('AiUsage', AiUsageSchema);
