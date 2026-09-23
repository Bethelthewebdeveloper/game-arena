const express = require("express");
const crypto = require("crypto");
const User = require("../models/User");
const Session = require("../models/Session");
const { hashPassword, verifyPassword, createSessionToken } = require("../utils/password");
const { getConnectionState } = require("../config/database");
const { authenticateUser, hashToken } = require("../middleware/auth");
const PlayerProfile = require("../models/PlayerProfile");
const localAuth = require("../services/localAuthStore");

const router = express.Router();
const SESSION_DAYS = 14;
const PUBLIC_ROLES = ["player", "student", "parent", "teacher"];

function mongoOn() {
  return getConnectionState().isConnected;
}

function publicUser(u) {
  return {
    id: u._id != null ? String(u._id) : null,
    username: u.username,
    email: u.email,
    displayName: u.displayName,
    avatar: u.avatar,
    role: u.role || "student",
    plan: u.proVerified ? "pro" : u.plan || "free",
    proVerified: !!u.proVerified,
    teacherStatus: u.teacherStatus || "none",
    createdAt: u.createdAt,
    lastLoginAt: u.lastLoginAt
  };
}

router.post("/register", async (req, res, next) => {
  try {
    if (!mongoOn()) {
      const username = String(req.body.username || "").trim().toLowerCase();
      const email = String(req.body.email || "").trim().toLowerCase();
      const password = String(req.body.password || "");
      const displayName = (String(req.body.displayName || "").trim() || username).slice(0, 48);
      if (username.length < 3 || username.length > 32)
        return res.status(400).json({ success: false, error: "Username must be 3–32 characters" });
      if (!/^[a-z0-9_]+$/.test(username))
        return res.status(400).json({ success: false, error: "Username may only contain letters, numbers, and underscores" });
      if (!email || !email.includes("@"))
        return res.status(400).json({ success: false, error: "Valid email required" });
      if (password.length < 8)
        return res.status(400).json({ success: false, error: "Password must be at least 8 characters" });
      try {
        const { salt, hash } = await hashPassword(password);
        const user = localAuth.createUser({
          username, email, displayName, passwordHash: hash, passwordSalt: salt
        });
        const token = createSessionToken();
        const expiresAt = new Date(Date.now() + SESSION_DAYS * 864e5);
        localAuth.createSession(user.id, hashToken(token), expiresAt);
        return res.status(201).json({
          success: true,
          token,
          expiresAt,
          user: localAuth.publicUser(user),
          storage: "local-file",
          note: "Saved on this server (MongoDB is not connected). Set MONGODB_URI for cloud accounts."
        });
      } catch (e) {
        if (e.code === "DUPLICATE") {
          return res.status(409).json({ success: false, error: e.message });
        }
        throw e;
      }
    }
    // Always store username lowercase so login is case-insensitive
    const username = String(req.body.username || "").trim().toLowerCase();
    const email = String(req.body.email || "").trim().toLowerCase();
    const password = String(req.body.password || "");
    const rawDisplay = String(req.body.displayName || "").trim();
    const displayName = (rawDisplay || username).slice(0, 48);
    let role = String(req.body.role || "player").toLowerCase();

    // Never accept founder/admin from public registration
    if (!PUBLIC_ROLES.includes(role)) {
      role = "student";
    }

    if (username.length < 3 || username.length > 32)
      return res.status(400).json({ success: false, error: "Username must be 3–32 characters" });
    if (!/^[a-z0-9_]+$/.test(username))
      return res.status(400).json({
        success: false,
        error: "Username may only contain letters, numbers, and underscores"
      });
    if (!email || !email.includes("@"))
      return res.status(400).json({ success: false, error: "Valid email required" });
    if (password.length < 8)
      return res.status(400).json({ success: false, error: "Password must be at least 8 characters" });

    const exists = await User.findOne({ $or: [{ username }, { email }] });
    if (exists) return res.status(409).json({ success: false, error: "Username or email already in use" });

    const { salt, hash } = await hashPassword(password);
    const user = await User.create({
      username,
      email,
      passwordHash: hash,
      passwordSalt: salt,
      displayName,
      role,
      teacherStatus: role === "teacher" ? "pending" : "none"
    });

    const token = createSessionToken();
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 864e5);
    await Session.create({ tokenHash: hashToken(token), userId: user._id, expiresAt });
    try {
      await PlayerProfile.create({
        userId: user._id,
        xp: 0,
        level: 1,
        xpNeeded: 100,
        coins: 0,
        gamesPlayed: 0,
        bestScore: 0
      });
    } catch (e) { /* profile created on first result if this races */ }

    res.status(201).json({ success: true, token, expiresAt, user: publicUser(user) });
  } catch (err) {
    // Duplicate key (race) → friendly 409
    if (err && err.code === 11000) {
      return res.status(409).json({ success: false, error: "Username or email already in use" });
    }
    next(err);
  }
});

router.post("/login", async (req, res, next) => {
  try {
    if (!mongoOn()) {
      const login = String(req.body.login || req.body.email || req.body.username || "").trim().toLowerCase();
      const password = String(req.body.password || "");
      if (!login || !password)
        return res.status(400).json({ success: false, error: "Login and password required" });
      const user = localAuth.findUser(login);
      if (!user) return res.status(401).json({ success: false, error: "Invalid credentials" });
      const ok = await verifyPassword(password, user.passwordSalt, user.passwordHash);
      if (!ok) return res.status(401).json({ success: false, error: "Invalid credentials" });
      const token = createSessionToken();
      const expiresAt = new Date(Date.now() + SESSION_DAYS * 864e5);
      localAuth.createSession(user.id, hashToken(token), expiresAt);
      return res.json({
        success: true,
        token,
        expiresAt,
        user: localAuth.publicUser(user),
        storage: "local-file"
      });
    }
    // Normalize so email and username lookups are case-insensitive
    const login = String(req.body.login || req.body.email || req.body.username || "")
      .trim()
      .toLowerCase();
    const password = String(req.body.password || "");
    if (!login || !password)
      return res.status(400).json({ success: false, error: "Login and password required" });

    // username is stored lowercase; email is stored lowercase
    const user = await User.findOne({ $or: [{ email: login }, { username: login }] }).select(
      "+passwordHash +passwordSalt"
    );
    if (!user) return res.status(401).json({ success: false, error: "Invalid credentials" });
    if (user.status === "disabled")
      return res.status(403).json({ success: false, error: "Account disabled" });

    const ok = await verifyPassword(password, user.passwordSalt, user.passwordHash);
    if (!ok) return res.status(401).json({ success: false, error: "Invalid credentials" });

    user.lastLoginAt = new Date();
    await user.save();

    const token = createSessionToken();
    const expiresAt = new Date(Date.now() + SESSION_DAYS * 864e5);
    await Session.create({ tokenHash: hashToken(token), userId: user._id, expiresAt });

    res.json({ success: true, token, expiresAt, user: publicUser(user) });
  } catch (err) {
    next(err);
  }
});

router.post("/logout", async (req, res, next) => {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : req.body.token;
    if (token) await Session.deleteOne({ tokenHash: hashToken(token) });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.get("/me", authenticateUser, async (req, res) => {
  res.json({ success: true, user: publicUser(req.user) });
});

router.post("/password-reset/request", async (req, res) => {
  res.json({
    success: true,
    message: "If an account exists, reset instructions would be emailed when mail is configured."
  });
});

module.exports = router;
