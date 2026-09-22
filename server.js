const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { URL } = require("url");

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, "public");
const DATA_DIR = path.join(__dirname, "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");
const SCORES_FILE = path.join(DATA_DIR, "scores.json");

const GAMES = [
  { id: "riddle", name: "Riddle Game", path: "/games/riddle.html", difficulty: "Medium" },
  { id: "reflex", name: "Reflex Challenge", path: "/games/reflex.html", difficulty: "Hard" },
  { id: "memory", name: "Memory Challenge", path: "/games/memory.html", difficulty: "Medium" },
  { id: "penalty", name: "Penalty Shootout", path: "/games/penalty.html", difficulty: "Easy" },
  { id: "rps", name: "Rock Paper Scissors", path: "/games/rps.html", difficulty: "Easy" },
  { id: "wordclash", name: "Word Clash", path: "/games/wordclash.html", difficulty: "Medium" },
  { id: "trivia", name: "Trivia Rush", path: "/games/trivia.html", difficulty: "Hard" }
];

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

function ensureData() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(USERS_FILE)) fs.writeFileSync(USERS_FILE, "[]");
  if (!fs.existsSync(SCORES_FILE)) fs.writeFileSync(SCORES_FILE, "[]");
}

function readJson(file) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); }
  catch { return []; }
}

function writeJson(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
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

function parseCookies(header) {
  const out = {};
  String(header || "").split(";").forEach((part) => {
    const idx = part.indexOf("=");
    if (idx === -1) return;
    out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  });
  return out;
}

function createSession(userId) {
  const id = crypto.randomBytes(24).toString("hex");
  sessions.set(id, { userId, createdAt: Date.now() });
  return id;
}

function getSessionUserId(req) {
  const sid = parseCookies(req.headers.cookie)["ga.sid"];
  if (!sid) return null;
  const session = sessions.get(sid);
  return session ? session.userId : null;
}

function setSessionCookie(res, sid) {
  res.setHeader("Set-Cookie", "ga.sid=" + sid + "; HttpOnly; Path=/; SameSite=Lax; Max-Age=" + (60 * 60 * 24 * 14));
}

function clearSessionCookie(res) {
  res.setHeader("Set-Cookie", "ga.sid=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0");
}

function sendJson(res, status, data) {
  const body = JSON.stringify(data);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body)
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      if (!raw) return resolve({});
      try { resolve(JSON.parse(raw)); }
      catch { reject(new Error("Invalid JSON")); }
    });
    req.on("error", reject);
  });
}

function safeJoin(root, urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const clean = path.normalize(decoded).replace(/^(\.\.[/\\])+/, "");
  const full = path.join(root, clean);
  if (!full.startsWith(root)) return null;
  return full;
}

function serveStatic(req, res, urlPath) {
  let filePath = safeJoin(PUBLIC, urlPath === "/" ? "/index.html" : urlPath);
  if (!filePath) { res.writeHead(400); return res.end("Bad path"); }
  if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
    filePath = path.join(filePath, "index.html");
  }
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
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

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://" + (req.headers.host || "localhost"));
    const method = req.method || "GET";
    const pathname = url.pathname;

    if (method === "GET" && pathname === "/api/me") {
      const userId = getSessionUserId(req);
      if (!userId) return sendJson(res, 200, { user: null });
      const user = readJson(USERS_FILE).find((u) => u.id === userId);
      if (!user) return sendJson(res, 200, { user: null });
      return sendJson(res, 200, { user: withLevel(user) });
    }

    if (method === "GET" && pathname === "/api/games") {
      return sendJson(res, 200, { games: GAMES });
    }

    if (method === "POST" && pathname === "/api/register") {
      const body = await readBody(req);
      const username = String(body.username || "").trim();
      const password = String(body.password || "");
      if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
        return sendJson(res, 400, { error: "Username must be 3-20 characters and use only letters, numbers, or underscores." });
      }
      if (password.length < 6) {
        return sendJson(res, 400, { error: "Password must be at least 6 characters." });
      }
      const users = readJson(USERS_FILE);
      if (users.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
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
      users.push(user);
      writeJson(USERS_FILE, users);
      setSessionCookie(res, createSession(user.id));
      return sendJson(res, 200, { user: withLevel(user) });
    }

    if (method === "POST" && pathname === "/api/login") {
      const body = await readBody(req);
      const username = String(body.username || "").trim();
      const password = String(body.password || "");
      const user = readJson(USERS_FILE).find((u) => u.username.toLowerCase() === username.toLowerCase());
      if (!user || !verifyPassword(password, user.passwordHash)) {
        return sendJson(res, 401, { error: "Invalid username or password." });
      }
      setSessionCookie(res, createSession(user.id));
      return sendJson(res, 200, { user: withLevel(user) });
    }

    if (method === "POST" && pathname === "/api/logout") {
      const sid = parseCookies(req.headers.cookie)["ga.sid"];
      if (sid) sessions.delete(sid);
      clearSessionCookie(res);
      return sendJson(res, 200, { ok: true });
    }

    if (method === "POST" && pathname === "/api/progress") {
      const userId = getSessionUserId(req);
      if (!userId) return sendJson(res, 401, { error: "Authentication required" });
      const body = await readBody(req);
      const gameId = String(body.gameId || "");
      const score = Number(body.score);
      const xpGain = Math.max(0, Math.min(50, Number(body.xp) || 0));
      const coinGain = Math.max(0, Math.min(20, Number(body.coins) || 0));
      if (!GAMES.some((g) => g.id === gameId)) return sendJson(res, 400, { error: "Unknown game." });
      if (!Number.isFinite(score)) return sendJson(res, 400, { error: "Invalid score." });
      const users = readJson(USERS_FILE);
      const user = users.find((u) => u.id === userId);
      if (!user) return sendJson(res, 401, { error: "Authentication required" });
      user.xp = (user.xp || 0) + xpGain;
      user.coins = (user.coins || 0) + coinGain;
      user.stats = user.stats || {};
      user.stats[gameId] = user.stats[gameId] || { plays: 0, best: null };
      user.stats[gameId].plays += 1;
      if (user.stats[gameId].best === null || score > user.stats[gameId].best) {
        user.stats[gameId].best = score;
      }
      const scores = readJson(SCORES_FILE);
      scores.push({
        id: "s_" + Date.now().toString(36),
        userId: user.id,
        username: user.username,
        gameId,
        score,
        createdAt: new Date().toISOString()
      });
      writeJson(SCORES_FILE, scores);
      writeJson(USERS_FILE, users);
      return sendJson(res, 200, { user: withLevel(user) });
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
    sendJson(res, 500, { error: "Server error" });
  }
});

server.listen(PORT, () => {
  console.log("Game Arena running at http://localhost:" + PORT);
});
