const mongoose = require('mongoose');

const PUBLIC_ROLES = ['student', 'parent', 'teacher'];
const ALL_ROLES = ['student', 'parent', 'teacher', 'founder'];

const UserSchema = new mongoose.Schema(
  {
    username: { type: String, required: true, unique: true, trim: true, minlength: 3, maxlength: 32, index: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true, index: true },
    passwordHash: { type: String, required: true, select: false },
    passwordSalt: { type: String, required: true, select: false },
    displayName: { type: String, default: 'Riddler', trim: true, maxlength: 48 },
    avatar: { type: String, default: '🧙' },
    role: {
      type: String,
      enum: ALL_ROLES,
      default: 'student',
      index: true
    },
    plan: { type: String, enum: ['free', 'pro'], default: 'free' },
    proVerified: { type: Boolean, default: false },
    // Parent/teacher linking architecture (no automatic access)
    linkedStudentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    teacherStatus: { type: String, enum: ['pending', 'approved', 'none'], default: 'none' },
    status: { type: String, enum: ['active', 'disabled'], default: 'active' },
    lastLoginAt: { type: Date },
    sessionVersion: { type: Number, default: 0 },
    // Founder-only PIN (never returned to clients)
    pinHash: { type: String, select: false },
    pinSalt: { type: String, select: false }
  },
  { timestamps: true }
);

UserSchema.statics.PUBLIC_ROLES = PUBLIC_ROLES;
UserSchema.statics.ALL_ROLES = ALL_ROLES;

module.exports = mongoose.model('User', UserSchema);
