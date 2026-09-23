/**
 * Multiplayer rooms — anonymous guests only.
 * No emails, names, or personal data.
 */
const mongoose = require('mongoose');

const PlayerSchema = new mongoose.Schema(
  {
    playerId: { type: String, required: true },
    tokenHash: { type: String, required: true, select: false },
    ready: { type: Boolean, default: false },
    connected: { type: Boolean, default: true },
    lastSeenAt: { type: Date, default: Date.now },
    isHost: { type: Boolean, default: false },
    score: { type: Number, default: 0 },
    finished: { type: Boolean, default: false },
    qIndex: { type: Number, default: 0 }
  },
  { _id: false }
);

const MultiplayerRoomSchema = new mongoose.Schema(
  {
    roomId: { type: String, required: true, unique: true, index: true },
    roomCode: { type: String, required: true, unique: true, uppercase: true, index: true },
    status: {
      type: String,
      enum: ['WAITING', 'READY', 'STARTING', 'PLAYING', 'FINISHED', 'CANCELLED'],
      default: 'WAITING',
      index: true
    },
    hostPlayerId: { type: String, required: true },
    players: { type: [PlayerSchema], default: [] },
    maxPlayers: { type: Number, default: 2 },
    startedAt: { type: Date, default: null },
    finishedAt: { type: Date, default: null },
    questions: { type: Array, default: [] },
    expiresAt: { type: Date, required: true, index: true }
  },
  { timestamps: true }
);

MultiplayerRoomSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('MultiplayerRoom', MultiplayerRoomSchema);
