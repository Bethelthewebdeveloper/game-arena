const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { URL } = require("url");

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0";
const NODE_ENV = process.env.NODE_ENV || "development";
const PUBLIC = path.join(__dirname, "public");

function canWriteDir(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    const probe = path.join(dir, ".write-test");
    fs.writeFileSync(probe, "ok");
    fs.unlinkSync(probe);
    return true;
  } catch {
    return false;
  }
}

function resolveDataDir() {
  const candidates = [
    process.env.DATA_DIR,
    path.join(__dirname, "data"),
    path.join("/tmp", "game-arena-data")
  ].filter(Boolean);
  for (const dir of candidates) {
    if (canWriteDir(dir)) return dir;
  }
  return path.join("/tmp", "game-arena-data");
}

const DATA_DIR = resolveDataDir();
const USERS_FILE = path.join(DATA_DIR, "users.json");
const SCORES_FILE = path.join(DATA_DIR, "scores.json");
const COOKIE_SECURE = process.env.COOKIE_SECURE === "true" || NODE_ENV === "production";
const MAX_SCORES = 2000;
const MAX_BODY = 32 * 1024;

const GAMES = [
  { id: "riddle", name: "Riddle Game", path: "/games/riddle.html", difficulty: "Medium" },
  { id: "reflex", name: "Reflex Challenge", path: "/games/reflex.html", difficulty: "Hard" },
  { id: "memory", name: "Memory Challenge", path: "/games/memory.html", difficulty: "Medium" },
  { id: "penalty", name: "Penalty Shootout", path: "/games/penalty.html", difficulty: "Easy" },
  { id: "rps", name: "Rock Paper Scissors", path: "/games/rps.html", difficulty: "Easy" },
  { id: "wordclash", name: "Word Clash", path: "/games/wordclash.html", difficulty: "Medium" },
  { id: "trivia", name: "Trivia Rush", path: "/games/trivia.html", difficulty: "Hard" },
  { id: "minirace", name: "Mini Race", path: "/games/minirace.html", difficulty: "Medium" },
  { id: "targetstrike", name: "Target Strike", path: "/games/targetstrike.html", difficulty: "Hard" },
  { id: "patternmaster", name: "Pattern Master", path: "/games/patternmaster.html", difficulty: "Medium" },
  { id: "numberrush", name: "Number Rush", path: "/games/numberrush.html", difficulty: "Medium" },
  { id: "codebreaker", name: "Code Breaker", path: "/games/codebreaker.html", difficulty: "Hard" }
];

const SCORE_CAP = {
  riddle: 500, reflex: 300, memory: 200, penalty: 10, rps: 50, wordclash: 300, trivia: 300,
  minirace: 2000, targetstrike: 2500, patternmaster: 2500, numberrush: 2500, codebreaker: 2500
};

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".txt": "text/plain; charset=utf-8"
};

const sessions = new Map();
const SESSION_SECRET = process.env.SESSION_SECRET || "game-arena-session-v1";

let dataWritable = true;
const writeQueue = Promise.resolve();

function ensureData() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, "[]");
    if (!fs.existsSync(SCORES_FILE)) fs.writeFileSync(SCORES_FILE, "[]");
    fs.accessSync(DATA_DIR, fs.constants.W_OK);
    dataWritable = true;
  } catch (err) {
    dataWritable = false;
    console.error("data store is not writable", DATA_DIR, err.code || err.message);
  }
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); }
  catch (err) {
    console.error("failed to read", path.basename(file), err.code || err.message);
    return [];
  }
}

function writeJson(file, data) {
  if (!dataWritable) throw new Error("DATA_UNAVAILABLE");
  const tmp = file + ".tmp";
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, file);
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(password, salt, 32).toString("hex");
  return salt + ":" + hash;
}

function verifyPassword(password, stored) {
  const [salt, hash] = String(stored || "").split(":");
  if (!salt || !hash) return false;
  const check = crypto.scryptSync(password, salt, 32).toString("hex");
  try {
    return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(check, "hex"));
  } catch {
    return false;
  }
}

function publicUser(user) {
  if (!user) return null;
  const { passwordHash, ...safe } = user;
  return safe;
}

function levelFromXp(xp) { return Math.max(1, Math.floor((xp || 0) / 100) + 1); }
function xpIntoLevel(xp) { return (xp || 0) % 100; }
function withLevel(user) {
  return { ...publicUser(user), level: levelFromXp(user.xp), xpIntoLevel: xpIntoLevel(user.xp) };
}

function daysBetween(a, b) {
  const da = Date.parse(a + "T00:00:00Z");
  const db = Date.parse(b + "T00:00:00Z");
  if (!Number.isFinite(da) || !Number.isFinite(db)) return 99;
  return Math.round((db - da) / 86400000);
}

function unlock(user, id) {
  if (!user.achievements.includes(id)) user.achievements.push(id);
}

function grantAchievements(user, gameId, st, completed) {
  if (gameId === "minirace") {
    if (st.plays >= 1) unlock(user, "race-first");
    if ((st.bestTime || 999) <= 20) unlock(user, "race-speed");
    if ((st.stage || 1) >= 10) unlock(user, "race-track");
    if ((st.racesPlayed || st.completions || 0) >= 10) unlock(user, "race-10");
  }
  if (gameId === "targetstrike") {
    if (st.plays >= 1) unlock(user, "strike-first");
    if ((st.accuracy || 0) >= 90) unlock(user, "strike-sharp");
    if ((st.accuracy || 0) >= 100 && completed) unlock(user, "strike-perfect");
    if ((st.targetsHit || 0) >= 100) unlock(user, "strike-100");
  }
  if (gameId === "patternmaster") {
    if (st.plays >= 1) unlock(user, "pattern-first");
    if ((st.stage || 1) >= 15) unlock(user, "pattern-memory");
    if ((st.accuracy || 0) >= 100 && completed) unlock(user, "pattern-perfect");
    if ((st.patternsSolved || 0) >= 25) unlock(user, "pattern-25");
  }
  if (gameId === "numberrush") {
    if (st.plays >= 1) unlock(user, "number-first");
    if ((st.stage || 1) >= 20) unlock(user, "number-ninja");
    if ((st.best || 0) >= 800) unlock(user, "number-speed");
    if ((st.correctAnswers || 0) >= 100) unlock(user, "number-100");
  }
  if (gameId === "codebreaker") {
    if (st.plays >= 1) unlock(user, "code-first");
    if ((st.codesSolved || 0) >= 5) unlock(user, "code-cracker");
    if ((st.stage || 1) >= 20) unlock(user, "code-master");
    if ((st.codesSolved || 0) >= 25) unlock(user, "code-25");
  }
}

function parseCookies(header) {
  const out = {};
  String(header || "").split(";").forEach((part) => {
    const idx = part.indexOf("=");
    if (idx === -1) return;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  });
  return out;
}

function signToken(obj) {
  const payload = Buffer.from(JSON.stringify(obj)).toString("base64url");
  const sig = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
  return payload + "." + sig;
}

function readToken(token) {
  const raw = String(token || "");
  const dot = raw.lastIndexOf(".");
  if (dot < 1) return null;
  const payload = raw.slice(0, dot);
  const sig = raw.slice(dot + 1);
  const expect = crypto.createHmac("sha256", SESSION_SECRET).update(payload).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expect);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (data.exp && Date.now() > data.exp) return null;
    return data;
  } catch {
    return null;
  }
}

function snapshotUser(user) {
  return {
    id: user.id,
    username: user.username,
    createdAt: user.createdAt,
    xp: user.xp || 0,
    coins: user.coins || 0,
    achievements: user.achievements || [],
    streaks: user.streaks || {},
    stats: user.stats || {},
    plan: user.plan || "free"
  };
}

function appendCookie(res, cookie) {
  const prev = res.getHeader("Set-Cookie");
  if (!prev) res.setHeader("Set-Cookie", cookie);
  else if (Array.isArray(prev)) res.setHeader("Set-Cookie", prev.concat(cookie));
  else res.setHeader("Set-Cookie", [prev, cookie]);
}

function cookieFlags(secure) {
  const flags = ["HttpOnly", "Path=/", "SameSite=Lax", "Max-Age=" + (60 * 60 * 24 * 14)];
  if (secure) flags.push("Secure");
  return flags.join("; ");
}

function setSessionCookie(res, user, secure) {
  const token = signToken({
    user: snapshotUser(user),
    exp: Date.now() + 14 * 24 * 60 * 60 * 1000
  });
  appendCookie(res, "ga.sid=" + token + "; " + cookieFlags(secure));
}

function setVaultCookie(res, req, user, secure) {
  const current = readToken(parseCookies(req.headers.cookie)["ga.vault"]) || { users: [] };
  const users = Array.isArray(current.users) ? current.users : [];
  const next = users.filter((u) => u.username.toLowerCase() !== user.username.toLowerCase());
  next.push({ id: user.id, username: user.username, passwordHash: user.passwordHash });
  const token = signToken({ users: next.slice(-20), exp: Date.now() + 14 * 24 * 60 * 60 * 1000 });
  appendCookie(res, "ga.vault=" + token + "; " + cookieFlags(secure));
}

function clearSessionCookie(res, secure) {
  const flags = ["HttpOnly", "Path=/", "SameSite=Lax", "Max-Age=0"];
  if (secure) flags.push("Secure");
  appendCookie(res, "ga.sid=; " + flags.join("; "));
}

function getSessionUser(req) {
  const data = readToken(parseCookies(req.headers.cookie)["ga.sid"]);
  if (!data || !data.user || !data.user.id) return null;
  const fromFile = readJson(USERS_FILE).find((u) => u.id === data.user.id);
  return fromFile || data.user;
}

function getSessionUserId(req) {
  const user = getSessionUser(req);
  return user ? user.id : null;
}

function findUserByUsername(req, username) {
  const name = String(username || "").trim().toLowerCase();
  if (!name) return null;
  const fromFile = readJson(USERS_FILE).find((u) => u.username.toLowerCase() === name);
  if (fromFile) return fromFile;
  const vault = readToken(parseCookies(req.headers.cookie)["ga.vault"]);
  const listed = vault && Array.isArray(vault.users) ? vault.users.find((u) => String(u.username).toLowerCase() === name) : null;
  if (listed) return listed;
  const session = getSessionUser(req);
  if (session && session.username.toLowerCase() === name) return session;
  return null;
}

function issueAuth(res, req, user) {
  const secure = isSecureReq(req);
  setSessionCookie(res, user, secure);
  setVaultCookie(res, req, user, secure);
}

function isSecureReq(req) {
  if (COOKIE_SECURE) return true;
  const proto = String(req.headers["x-forwarded-proto"] || "").split(",")[0].trim();
  return proto === "https";
}

const rateBuckets = new Map();
function rateLimit(req, key, limit, windowMs) {
  const ip = String((req.headers["x-forwarded-for"] || "").split(",")[0] || req.socket.remoteAddress || "unknown");
  const id = key + ":" + ip;
  const now = Date.now();
  const bucket = rateBuckets.get(id) || [];
  const fresh = bucket.filter((t) => now - t < windowMs);
  if (fresh.length >= limit) return false;
  fresh.push(now);
  rateBuckets.set(id, fresh);
  return true;
}

const recentResults = new Map();
function isDuplicateResult(userId, gameId, score) {
  const key = userId + ":" + gameId + ":" + score;
  const now = Date.now();
  const prev = recentResults.get(key);
  if (prev && now - prev < 4000) return true;
  recentResults.set(key, now);
  return false;
}

setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.createdAt > 14 * 24 * 60 * 60 * 1000) sessions.delete(id);
  }
  for (const [id, times] of rateBuckets) {
    const fresh = times.filter((t) => now - t < 15 * 60 * 1000);
    if (!fresh.length) rateBuckets.delete(id);
    else rateBuckets.set(id, fresh);
  }
}, 60 * 1000).unref();

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  };
  const cookies = res.getHeader("Set-Cookie");
  if (cookies) headers["Set-Cookie"] = cookies;
  res.writeHead(status, headers);
  res.end(body);
}

function parseJsonBody(raw) {
  if (!raw) return {};
  if (typeof raw === "object" && !Buffer.isBuffer(raw)) return raw;
  try { return JSON.parse(String(raw)); }
  catch { throw new Error("Invalid JSON"); }
}

function readBody(req) {
  if (req.body !== undefined && req.body !== null && req.body !== "") {
    return Promise.resolve(parseJsonBody(req.body));
  }
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    let settled = false;
    const finish = (err, value) => {
      if (settled) return;
      settled = true;
      if (err) reject(err);
      else resolve(value);
    };
    req.on("data", (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        finish(new Error("BODY_TOO_LARGE"));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on("end", () => {
      try { finish(null, parseJsonBody(Buffer.concat(chunks).toString("utf8"))); }
      catch (err) { finish(err); }
    });
    req.on("error", (err) => finish(err));
    setTimeout(() => {
      if (!settled && chunks.length === 0 && req.body) {
        try { finish(null, parseJsonBody(req.body)); }
        catch (err) { finish(err); }
      }
    }, 10);
  });
}

function safeJoin(root, urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const clean = path.normalize(decoded).replace(/^(\.\.[/\\])+/, "");
  const full = path.join(root, clean);
  const rootResolved = path.resolve(root) + path.sep;
  if (!(full + path.sep).startsWith(rootResolved) && full !== path.resolve(root)) return null;
  return full;
}

function serveStatic(req, res, urlPath) {
  let filePath = safeJoin(PUBLIC, urlPath === "/" ? "/index.html" : urlPath);
  if (!filePath) { res.writeHead(400); return res.end("Bad path"); }
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, "index.html");
  }
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    const fallback = path.join(PUBLIC, "404.html");
    if (fs.existsSync(fallback)) {
      res.writeHead(404, { "Content-Type": "text/html; charset=utf-8" });
      return fs.createReadStream(fallback).pipe(res);
    }
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    return res.end("Not found");
  }
  const ext = path.extname(filePath);
  res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
  fs.createReadStream(filePath).pipe(res);
}

ensureData();

const PAGE_ROUTES = {
  "/login": "/login.html",
  "/signup": "/signup.html",
  "/dashboard": "/dashboard.html"
};

async function handleRequest(req, res) {
  try {
    const url = new URL(req.url, "http://" + (req.headers.host || "localhost"));
    const method = req.method || "GET";
    const pathname = url.pathname;

    if (method === "GET" && pathname === "/api/me") {
      const user = getSessionUser(req);
      if (!user) return sendJson(res, 200, { user: null });
      return sendJson(res, 200, { user: withLevel(user) });
    }

    if (method === "GET" && pathname === "/api/games") {
      return sendJson(res, 200, { games: GAMES });
    }

    if (method === "GET" && pathname === "/healthz") {
      return sendJson(res, dataWritable ? 200 : 503, {
        ok: dataWritable,
        env: NODE_ENV,
        store: dataWritable ? "ready" : "unavailable"
      });
    }

    if (method === "POST" && pathname === "/api/register") {
      if (!rateLimit(req, "register", 8, 15 * 60 * 1000)) {
        return sendJson(res, 429, { error: "Too many accounts created from this network." });
      }
      const body = await readBody(req);
      const username = String(body.username || "").trim();
      const password = String(body.password || "");
      if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
        return sendJson(res, 400, { error: "Username must be 3-20 characters and use only letters, numbers, or underscores." });
      }
      if (password.length < 6) {
        return sendJson(res, 400, { error: "Password must be at least 6 characters." });
      }
      if (findUserByUsername(req, username)) {
        return sendJson(res, 409, { error: "That username is already taken." });
      }
      const user = {
        id: "u_" + Date.now().toString(36) + crypto.randomBytes(3).toString("hex"),
        username,
        passwordHash: hashPassword(password),
        createdAt: new Date().toISOString(),
        xp: 0,
        coins: 0,
        achievements: [],
        streaks: {},
        stats: {},
        plan: "free"
      };
      try {
        const users = readJson(USERS_FILE);
        users.push(user);
        writeJson(USERS_FILE, users);
      } catch (err) {
        console.error("register file persist failed", err.code || err.message);
      }
      issueAuth(res, req, user);
      return sendJson(res, 200, { user: withLevel(user) });
    }

    if (method === "POST" && pathname === "/api/login") {
      if (!rateLimit(req, "login", 20, 15 * 60 * 1000)) {
        return sendJson(res, 429, { error: "Too many login attempts. Wait a few minutes." });
      }
      const body = await readBody(req);
      const username = String(body.username || "").trim();
      const password = String(body.password || "");
      const user = findUserByUsername(req, username);
      if (!user || !verifyPassword(password, user.passwordHash)) {
        return sendJson(res, 401, { error: "Invalid username or password." });
      }
      issueAuth(res, req, user);
      return sendJson(res, 200, { user: withLevel(user) });
    }

    if (method === "POST" && pathname === "/api/logout") {
      clearSessionCookie(res, isSecureReq(req));
      return sendJson(res, 200, { ok: true });
    }

    if (method === "POST" && pathname === "/api/progress") {
      const userId = getSessionUserId(req);
      if (!userId) return sendJson(res, 401, { error: "Authentication required" });
      if (!dataWritable) return sendJson(res, 503, { error: "Player data store is unavailable." });
      if (!rateLimit(req, "progress", 40, 60 * 1000)) {
        return sendJson(res, 429, { error: "Too many results submitted. Slow down." });
      }
      const body = await readBody(req);
      const gameId = String(body.gameId || body.game || "");
      if (!GAMES.some((g) => g.id === gameId)) return sendJson(res, 400, { error: "Unknown game." });
      let score = Number(body.score);
      if (!Number.isFinite(score) || score < 0) return sendJson(res, 400, { error: "Invalid score." });
      const cap = SCORE_CAP[gameId] || 1000;
      score = Math.min(Math.floor(score), cap);
      if (isDuplicateResult(userId, gameId, score)) {
        return sendJson(res, 200, { ok: true, duplicate: true });
      }
      const completed = body.completed === true || body.completed === "true";
      const stage = Math.max(0, Math.min(50, Math.floor(Number(body.stage) || 0)));
      const mode = String(body.mode || "").slice(0, 32);
      const time = Number.isFinite(Number(body.time)) ? Math.max(0, Number(body.time)) : null;
      const accuracy = Number.isFinite(Number(body.accuracy)) ? Math.max(0, Math.min(100, Number(body.accuracy))) : null;
      const xpGain = Math.max(0, Math.min(50, Math.floor(score / 40) + (completed ? 8 : 2)));
      const coinGain = Math.max(0, Math.min(20, Math.floor(score / 120) + (completed ? 2 : 0)));
      const authed = getSessionUser(req);
      if (!authed) return sendJson(res, 401, { error: "Authentication required" });
      const users = readJson(USERS_FILE);
      let user = users.find((u) => u.id === userId);
      if (!user) {
        user = authed;
        users.push(user);
      }
      user.xp = (user.xp || 0) + xpGain;
      user.coins = (user.coins || 0) + coinGain;
      user.stats = user.stats || {};
      const st = user.stats[gameId] || { plays: 0, best: null, completions: 0, stage: 1 };
      st.plays += 1;
      if (st.best === null || score > st.best) st.best = score;
      if (completed) {
        st.completions = (st.completions || 0) + 1;
        st.stage = Math.max(st.stage || 1, Math.min(50, stage + 1) || 1);
      }
      if (mode) st.lastMode = mode;
      if (time !== null) st.bestTime = st.bestTime == null ? time : Math.min(st.bestTime, time);
      if (accuracy !== null) st.accuracy = Math.max(st.accuracy || 0, accuracy);
      if (Number.isFinite(Number(body.targetsHit))) st.targetsHit = (st.targetsHit || 0) + Math.max(0, Math.floor(Number(body.targetsHit)));
      if (Number.isFinite(Number(body.correctAnswers))) st.correctAnswers = (st.correctAnswers || 0) + Math.max(0, Math.floor(Number(body.correctAnswers)));
      if (completed && gameId === "patternmaster") st.patternsSolved = (st.patternsSolved || 0) + 1;
      if (completed && gameId === "codebreaker") st.codesSolved = (st.codesSolved || 0) + 1;
      if (completed && gameId === "minirace") st.racesPlayed = (st.racesPlayed || 0) + 1;
      user.stats[gameId] = st;
      user.streaks = user.streaks || {};
      const today = new Date().toISOString().slice(0, 10);
      const prev = user.streaks.global || { count: 0, last: null };
      if (completed) {
        if (prev.last === today) {
          /* same day, keep count */
        } else if (prev.last && daysBetween(prev.last, today) === 1) {
          prev.count += 1;
        } else if (prev.last !== today) {
          prev.count = 1;
        }
        prev.last = today;
      }
      user.streaks.global = prev;
      user.achievements = Array.isArray(user.achievements) ? user.achievements : [];
      grantAchievements(user, gameId, st, completed);
      const scores = readJson(SCORES_FILE);
      scores.push({
        id: "s_" + Date.now().toString(36),
        userId: user.id,
        username: user.username,
        gameId,
        score,
        stage: stage || null,
        mode: mode || null,
        time,
        completed,
        createdAt: new Date().toISOString()
      });
      if (scores.length > MAX_SCORES) scores.splice(0, scores.length - MAX_SCORES);
      try {
        writeJson(SCORES_FILE, scores);
        writeJson(USERS_FILE, users);
      } catch (err) {
        console.error("progress file persist failed", err.code || err.message);
      }
      issueAuth(res, req, user);
      return sendJson(res, 200, { user: withLevel(user), awarded: { xp: xpGain, coins: coinGain } });
    }

    if (method === "GET" && pathname === "/api/leaderboard") {
      const gameId = String(url.searchParams.get("game") || "");
      const scores = readJson(SCORES_FILE);
      const filtered = gameId ? scores.filter((s) => s.gameId === gameId) : scores;
      const bestByPlayer = new Map();
      for (const row of filtered) {
        const key = row.userId + ":" + row.gameId;
        const prev = bestByPlayer.get(key);
        if (!prev || row.score > prev.score) bestByPlayer.set(key, row);
      }
      const entries = Array.from(bestByPlayer.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, 10)
        .map((row, i) => ({
          rank: i + 1,
          username: row.username,
          gameId: row.gameId,
          score: row.score
        }));
      return sendJson(res, 200, { entries });
    }

    if (method === "GET" && PAGE_ROUTES[pathname]) {
      return serveStatic(req, res, PAGE_ROUTES[pathname]);
    }
    if (method === "GET") return serveStatic(req, res, pathname);
    sendJson(res, 405, { error: "Method not allowed" });
  } catch (err) {
    if (err && err.message === "Invalid JSON") return sendJson(res, 400, { error: "Invalid JSON." });
    if (err && err.message === "BODY_TOO_LARGE") return sendJson(res, 413, { error: "Request too large." });
    if (err && err.message === "DATA_UNAVAILABLE") return sendJson(res, 503, { error: "Player data store is unavailable." });
    console.error("request failed", req.method, req.url, err.message || err);
    console.error("request failed", req.method, req.url, err && err.stack ? err.stack : err);
    sendJson(res, 500, { error: "Server error" });
  }
}

const server = http.createServer((req, res) => {
  handleRequest(req, res);
});

if (require.main === module) {
  server.listen(PORT, HOST, () => {
    console.log("Game Arena listening on " + HOST + ":" + PORT + " (" + NODE_ENV + ")");
    console.log("data directory", DATA_DIR, dataWritable ? "writable" : "read-only");
  });
}

module.exports = handleRequest;
module.exports.handleRequest = handleRequest;
module.exports.server = server;
