/**
 * Server-authoritative daily riddle set per calendar day (Phase 26).
 * Same dateKey always maps to the same riddleIds.
 */
const mongoose = require('mongoose');

const DailyAssignmentSchema = new mongoose.Schema(
  {
    dateKey: { type: String, required: true, unique: true, index: true },
    timezone: { type: String, default: 'UTC' },
    riddleIds: [{ type: String }],
    riddleCount: { type: Number, default: 5 },
    difficulties: [{ type: String }]
  },
  { timestamps: true }
);

module.exports = mongoose.model('DailyAssignment', DailyAssignmentSchema);
