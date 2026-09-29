const crypto = require("crypto");
const path = require("path");
const fs = require("fs");

const FREE = {
  projects: 5,
  published: 3,
  levels: 5,
  customAssets: 10,
  ai: { generate: 3, modify: 10, debug: 5, assist: 20 }
};

const PRO = {
  projects: 50,
  published: 40,
  levels: 30,
  customAssets: 80,
  ai: { generate: 40, modify: 80, debug: 40, assist: 120 }
};

const ALLOWED_STATUS = new Set(["DRAFT", "PUBLISHED", "UNPUBLISHED"]);
const CATEGORIES = ["New", "Popular", "Puzzle", "Arcade", "Quiz", "Strategy", "Adventure", "Casual"];
const TEMPLATES = ["blank", "platformer", "maze", "quiz", "clicker", "runner", "puzzle", "dodge", "memory", "racing", "adventure"];

function slugify(title, gameId) {
  const base = String(title || "game")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40) || "game";
  const short = String(gameId || "").replace(/^g_/, "").slice(-6);
  return short + "-" + base;
}

function sanitizeProjectData(raw) {
  const data = raw && typeof raw === "object" ? raw : {};
  const objects = Array.isArray(data.objects) ? data.objects.slice(0, 60).map((o) => ({
    id: String(o.id || "").slice(0, 40),
    kind: String(o.kind || "deco").slice(0, 24),
    name: String(o.name || o.kind || "obj").slice(0, 32),
    x: Number(o.x) || 0,
    y: Number(o.y) || 0,
    w: Math.max(8, Math.min(200, Number(o.w) || 24)),
    h: Math.max(8, Math.min(200, Number(o.h) || 24)),
    color: /^#[0-9a-fA-F]{3,8}$/.test(String(o.color || "")) ? o.color : "#22d3ee"
  })) : [];
  const scripts = {};
  const src = data.scripts && typeof data.scripts === "object" ? data.scripts : {};
  Object.keys(src).slice(0, 60).forEach((key) => {
    scripts[String(key).slice(0, 40)] = sanitizeBlocks(src[key], 0);
  });
  return {
    version: 1,
    title: String(data.title || "").slice(0, 60),
    template: TEMPLATES.includes(data.template) ? data.template : "blank",
    category: CATEGORIES.includes(data.category) ? data.category : "Casual",
    bg: /^#[0-9a-fA-F]{3,8}$/.test(String(data.bg || "")) ? data.bg : "#0b1220",
    level: Math.max(1, Math.min(30, Number(data.level) || 1)),
    levels: Math.max(1, Math.min(30, Number(data.levels) || 1)),
    settings: {
      winScore: Math.max(1, Math.min(999, Number(data.settings && data.settings.winScore) || 5)),
      startLives: Math.max(1, Math.min(9, Number(data.settings && data.settings.startLives) || 3))
    },
    vars: {},
    objects,
    scripts
  };
}

function sanitizeBlocks(list, depth) {
  if (!Array.isArray(list) || depth > 8) return [];
  return list.slice(0, 40).map((b) => sanitizeBlock(b, depth)).filter(Boolean);
}

function sanitizeBlock(b, depth) {
  if (!b || typeof b !== "object") return null;
  const op = String(b.op || "").slice(0, 24);
  if (!op) return null;
  const out = { op };
  if (b.n != null) out.n = Number(b.n) || 0;
  if (b.x != null) out.x = Number(b.x) || 0;
  if (b.y != null) out.y = Number(b.y) || 0;
  if (b.key) out.key = String(b.key).slice(0, 20);
  if (b.name) out.name = String(b.name).slice(0, 24);
  if (b.kind) out.kind = String(b.kind).slice(0, 24);
  if (b.cond) out.cond = sanitizeCond(b.cond);
  if (Array.isArray(b.kids)) out.kids = sanitizeBlocks(b.kids, depth + 1);
  if (Array.isArray(b.elseKids)) out.elseKids = sanitizeBlocks(b.elseKids, depth + 1);
  return out;
}

function sanitizeCond(c) {
  if (!c || typeof c !== "object") return null;
  return {
    op: String(c.op || "").slice(0, 20),
    target: c.target ? String(c.target).slice(0, 20) : undefined,
    key: c.key ? String(c.key).slice(0, 20) : undefined,
    a: c.a != null ? String(c.a).slice(0, 20) : undefined,
    b: c.b != null ? Number(c.b) || 0 : undefined,
    cmp: c.cmp ? String(c.cmp).slice(0, 4) : undefined
  };
}

function publicProject(row, extra) {
  if (!row) return null;
  return Object.assign({
    gameId: row.gameId,
    slug: row.slug,
    creatorId: row.creatorId,
    creatorName: row.creatorName,
    title: row.title,
    description: row.description || "",
    category: row.category || "Casual",
    status: row.status,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    publishedAt: row.publishedAt || null,
    plays: row.plays || 0,
    likes: (row.likeUsers && row.likeUsers.length) || row.likes || 0,
    url: "/g/" + row.slug
  }, extra || {});
}

function periodKey() {
  const d = new Date();
  return d.getUTCFullYear() + "-" + String(d.getUTCMonth() + 1).padStart(2, "0");
}

module.exports = function attachStudio(ctx) {
  const {
    sendJson, readJson, writeJson, getSessionUser, getSessionUserId,
    rateLimit, withLevel, unlock, USERS_FILE, DATA_DIR, serveStatic
  } = ctx;

  const STUDIO_FILE = path.join(DATA_DIR, "studio.json");
  if (!fs.existsSync(STUDIO_FILE)) {
    try { writeJson(STUDIO_FILE, []); } catch {}
  }

  function readStudio() {
    const data = readJson(STUDIO_FILE);
    return Array.isArray(data) ? data : [];
  }
  function writeStudio(list) { writeJson(STUDIO_FILE, list); }

  function limitsFor(user) {
    return (user && user.plan === "pro") ? PRO : FREE;
  }

  function usageOf(user) {
    const period = periodKey();
    user.studioUsage = user.studioUsage || {};
    if (user.studioUsage.period !== period) {
      user.studioUsage = { period, generate: 0, modify: 0, debug: 0, assist: 0 };
    }
    return user.studioUsage;
  }

  function grantStudio(user, list) {
    user.achievements = Array.isArray(user.achievements) ? user.achievements : [];
    const mine = list.filter((p) => p.creatorId === user.id);
    const published = mine.filter((p) => p.status === "PUBLISHED");
    const plays = published.reduce((n, p) => n + (p.plays || 0), 0);
    const likes = published.reduce((n, p) => n + ((p.likeUsers && p.likeUsers.length) || p.likes || 0), 0);
    if (mine.length >= 1) unlock(user, "studio-first-game");
    if (published.length >= 1) unlock(user, "studio-first-publish");
    if (published.length >= 5) unlock(user, "studio-publish-5");
    if (published.length >= 10) unlock(user, "studio-publish-10");
    if (plays >= 100) unlock(user, "studio-plays-100");
    if (plays >= 1000) unlock(user, "studio-plays-1000");
    if (likes >= 1) unlock(user, "studio-first-like");
  }

  function loadUser(id) {
    const users = readJson(USERS_FILE);
    const user = users.find((u) => u.id === id);
    return { users, user };
  }

  async function handle(req, res, url, method, pathname) {
    if (method === "GET" && pathname === "/studio") {
      serveStatic(req, res, "/studio.html");
      return true;
    }
    if (method === "GET" && pathname === "/studio/editor") {
      serveStatic(req, res, "/studio-editor.html");
      return true;
    }
    if (method === "GET" && pathname === "/studio/community") {
      serveStatic(req, res, "/studio-community.html");
      return true;
    }
    if (method === "GET" && pathname.startsWith("/g/")) {
      serveStatic(req, res, "/studio-play.html");
      return true;
    }
    if (method === "GET" && pathname.startsWith("/u/")) {
      serveStatic(req, res, "/studio-creator.html");
      return true;
    }

    if (method === "GET" && pathname === "/api/studio/templates") {
      sendJson(res, 200, {
        templates: TEMPLATES.map((id) => ({ id, name: id })),
        categories: CATEGORIES,
        limits: { free: FREE, pro: PRO }
      });
      return true;
    }

    if (method === "GET" && pathname === "/api/studio/projects") {
      const user = getSessionUser(req);
      if (!user) { sendJson(res, 401, { error: "Sign in to open Studio." }); return true; }
      const list = readStudio().filter((p) => p.creatorId === user.id && !p.deleted);
      sendJson(res, 200, {
        projects: list.map((p) => publicProject(p)),
        limits: limitsFor(user),
        usage: usageOf(user)
      });
      return true;
    }

    if (method === "POST" && pathname === "/api/studio/projects") {
      const user = getSessionUser(req);
      if (!user) { sendJson(res, 401, { error: "Sign in to create a project." }); return true; }
      if (!rateLimit(req, "studio-create", 20, 60 * 60 * 1000)) {
        sendJson(res, 429, { error: "Too many projects created. Try later." }); return true;
      }
      const body = await ctx.readBody(req, 200 * 1024);
      const list = readStudio();
      const active = list.filter((p) => p.creatorId === user.id && !p.deleted);
      const cap = limitsFor(user);
      if (active.length >= cap.projects) {
        sendJson(res, 403, { error: "You've reached your Free Studio project limit.", code: "LIMIT_PROJECTS", upgrade: user.plan !== "pro" });
        return true;
      }
      const title = String(body.title || "Untitled Game").trim().slice(0, 60) || "Untitled Game";
      const description = String(body.description || "").trim().slice(0, 280);
      const template = TEMPLATES.includes(body.template) ? body.template : "blank";
      const gameId = "g_" + Date.now().toString(36) + crypto.randomBytes(3).toString("hex");
      const row = {
        gameId,
        slug: slugify(title, gameId),
        creatorId: user.id,
        creatorName: user.username,
        title,
        description,
        category: CATEGORIES.includes(body.category) ? body.category : "Casual",
        projectData: sanitizeProjectData(body.projectData || { title, template }),
        status: "DRAFT",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        plays: 0,
        likeUsers: [],
        playKeys: []
      };
      if (!body.projectData) row.projectData.template = template;
      list.push(row);
      writeStudio(list);
      const loaded = loadUser(user.id);
      if (loaded.user) {
        grantStudio(loaded.user, list);
        if (!loaded.user.stats) loaded.user.stats = {};
        if (!loaded.user.stats.studio) loaded.user.stats.studio = { plays: 0, created: 0, published: 0 };
        loaded.user.stats.studio.created = (loaded.user.stats.studio.created || 0) + 1;
        if (loaded.user.stats.studio.created === 1) {
          loaded.user.xp = (loaded.user.xp || 0) + 15;
          loaded.user.coins = (loaded.user.coins || 0) + 5;
        }
        writeJson(USERS_FILE, loaded.users);
      }
      sendJson(res, 200, { project: publicProject(row, { projectData: row.projectData }) });
      return true;
    }

    const one = pathname.match(/^\/api\/studio\/projects\/([^/]+)(?:\/([a-z]+))?$/);
    if (one) {
      const gameId = decodeURIComponent(one[1]);
      const action = one[2] || "";
      const list = readStudio();
      const row = list.find((p) => p.gameId === gameId && !p.deleted);
      if (!row) { sendJson(res, 404, { error: "Project not found." }); return true; }

      if (method === "GET" && !action) {
        const viewer = getSessionUser(req);
        const owner = viewer && viewer.id === row.creatorId;
        if (row.status !== "PUBLISHED" && !owner) {
          sendJson(res, 404, { error: "Project not found." }); return true;
        }
        sendJson(res, 200, { project: publicProject(row, owner || row.status === "PUBLISHED" ? { projectData: row.projectData } : {}) });
        return true;
      }

      if (method === "PUT" && !action) {
        const user = getSessionUser(req);
        if (!user || user.id !== row.creatorId) { sendJson(res, 403, { error: "Only the creator can edit this game." }); return true; }
        const body = await ctx.readBody(req, 200 * 1024);
        if (body.title) row.title = String(body.title).trim().slice(0, 60) || row.title;
        if (body.description != null) row.description = String(body.description).trim().slice(0, 280);
        if (CATEGORIES.includes(body.category)) row.category = body.category;
        if (body.projectData) {
          const next = sanitizeProjectData(body.projectData);
          const cap = limitsFor(user);
          if (next.levels > cap.levels) {
            sendJson(res, 403, { error: "You've reached the level limit for your plan.", code: "LIMIT_LEVELS", upgrade: user.plan !== "pro" });
            return true;
          }
          row.projectData = next;
        }
        row.updatedAt = new Date().toISOString();
        writeStudio(list);
        sendJson(res, 200, { project: publicProject(row, { projectData: row.projectData }) });
        return true;
      }

      if (method === "DELETE" && !action) {
        const user = getSessionUser(req);
        if (!user || user.id !== row.creatorId) { sendJson(res, 403, { error: "Only the creator can delete this game." }); return true; }
        row.deleted = true;
        row.status = "UNPUBLISHED";
        row.updatedAt = new Date().toISOString();
        writeStudio(list);
        sendJson(res, 200, { ok: true });
        return true;
      }

      if (method === "POST" && action === "publish") {
        const user = getSessionUser(req);
        if (!user || user.id !== row.creatorId) { sendJson(res, 403, { error: "Only the creator can publish this game." }); return true; }
        if (!row.title || row.title.length < 2) { sendJson(res, 400, { error: "Add a game title before publishing." }); return true; }
        if (!row.projectData || !Array.isArray(row.projectData.objects) || !row.projectData.objects.length) {
          sendJson(res, 400, { error: "This project has no playable objects yet." }); return true;
        }
        const cap = limitsFor(user);
        const publishedCount = list.filter((p) => p.creatorId === user.id && p.status === "PUBLISHED" && p.gameId !== row.gameId && !p.deleted).length;
        if (publishedCount >= cap.published) {
          sendJson(res, 403, { error: "You've reached your published game limit.", code: "LIMIT_PUBLISHED", upgrade: user.plan !== "pro" });
          return true;
        }
        row.status = "PUBLISHED";
        row.publishedAt = new Date().toISOString();
        row.updatedAt = row.publishedAt;
        writeStudio(list);
        const loaded = loadUser(user.id);
        if (loaded.user) {
          grantStudio(loaded.user, list);
          loaded.user.stats = loaded.user.stats || {};
          loaded.user.stats.studio = loaded.user.stats.studio || { plays: 0, created: 0, published: 0 };
          const wasFirst = (loaded.user.stats.studio.published || 0) === 0;
          loaded.user.stats.studio.published = list.filter((p) => p.creatorId === user.id && p.status === "PUBLISHED" && !p.deleted).length;
          if (wasFirst) {
            loaded.user.xp = (loaded.user.xp || 0) + 25;
            loaded.user.coins = (loaded.user.coins || 0) + 8;
          }
          writeJson(USERS_FILE, loaded.users);
        }
        sendJson(res, 200, { project: publicProject(row, { projectData: row.projectData }), message: "Your game is published." });
        return true;
      }

      if (method === "POST" && action === "unpublish") {
        const user = getSessionUser(req);
        if (!user || user.id !== row.creatorId) { sendJson(res, 403, { error: "Only the creator can unpublish this game." }); return true; }
        row.status = "UNPUBLISHED";
        row.updatedAt = new Date().toISOString();
        writeStudio(list);
        sendJson(res, 200, { project: publicProject(row) });
        return true;
      }

      if (method === "POST" && action === "like") {
        const user = getSessionUser(req);
        if (!user) { sendJson(res, 401, { error: "Sign in to like games." }); return true; }
        if (row.status !== "PUBLISHED") { sendJson(res, 400, { error: "Only published games can be liked." }); return true; }
        if (!rateLimit(req, "studio-like", 30, 60 * 60 * 1000)) {
          sendJson(res, 429, { error: "Too many likes. Try later." }); return true;
        }
        row.likeUsers = Array.isArray(row.likeUsers) ? row.likeUsers : [];
        const liked = row.likeUsers.includes(user.id);
        if (liked) row.likeUsers = row.likeUsers.filter((id) => id !== user.id);
        else row.likeUsers.push(user.id);
        writeStudio(list);
        if (!liked) {
          const loaded = loadUser(row.creatorId);
          if (loaded.user) { grantStudio(loaded.user, list); writeJson(USERS_FILE, loaded.users); }
        }
        sendJson(res, 200, { likes: row.likeUsers.length, liked: !liked });
        return true;
      }

      if (method === "POST" && action === "play") {
        if (row.status !== "PUBLISHED") { sendJson(res, 400, { error: "This game is not public." }); return true; }
        const viewer = getSessionUserId(req) || (req.headers["x-forwarded-for"] || req.socket.remoteAddress || "anon");
        const hour = new Date().toISOString().slice(0, 13);
        const key = String(viewer) + ":" + hour;
        row.playKeys = Array.isArray(row.playKeys) ? row.playKeys.slice(-400) : [];
        if (!row.playKeys.includes(key)) {
          row.playKeys.push(key);
          row.plays = (row.plays || 0) + 1;
          writeStudio(list);
          const loaded = loadUser(row.creatorId);
          if (loaded.user) {
            loaded.user.stats = loaded.user.stats || {};
            loaded.user.stats.studio = loaded.user.stats.studio || { plays: 0 };
            loaded.user.stats.studio.plays = (loaded.user.stats.studio.plays || 0) + 1;
            if (row.plays === 100 || row.plays === 1000) grantStudio(loaded.user, list);
            writeJson(USERS_FILE, loaded.users);
          }
        }
        sendJson(res, 200, { plays: row.plays || 0 });
        return true;
      }

      sendJson(res, 405, { error: "Method not allowed" });
      return true;
    }

    if (method === "GET" && pathname === "/api/studio/community") {
      const sort = String(url.searchParams.get("sort") || "new");
      const category = String(url.searchParams.get("category") || "");
      let list = readStudio().filter((p) => p.status === "PUBLISHED" && !p.deleted);
      if (CATEGORIES.includes(category) && category !== "New" && category !== "Popular") {
        list = list.filter((p) => p.category === category);
      }
      if (sort === "popular" || category === "Popular") {
        list.sort((a, b) => (b.plays || 0) - (a.plays || 0) || ((b.likeUsers && b.likeUsers.length) || 0) - ((a.likeUsers && a.likeUsers.length) || 0));
      } else {
        list.sort((a, b) => String(b.publishedAt || b.updatedAt).localeCompare(String(a.publishedAt || a.updatedAt)));
      }
      sendJson(res, 200, { games: list.slice(0, 60).map((p) => publicProject(p)) });
      return true;
    }

    if (method === "GET" && pathname.startsWith("/api/studio/public/")) {
      const slug = decodeURIComponent(pathname.slice("/api/studio/public/".length));
      const row = readStudio().find((p) => p.slug === slug && p.status === "PUBLISHED" && !p.deleted);
      if (!row) { sendJson(res, 404, { error: "That public game was not found." }); return true; }
      sendJson(res, 200, { project: publicProject(row, { projectData: row.projectData }) });
      return true;
    }

    if (method === "GET" && pathname.startsWith("/api/studio/creator/")) {
      const name = decodeURIComponent(pathname.slice("/api/studio/creator/".length)).toLowerCase();
      const users = readJson(USERS_FILE);
      const creator = users.find((u) => String(u.username || "").toLowerCase() === name);
      if (!creator) { sendJson(res, 404, { error: "Creator not found." }); return true; }
      const games = readStudio().filter((p) => p.creatorId === creator.id && p.status === "PUBLISHED" && !p.deleted);
      const plays = games.reduce((n, p) => n + (p.plays || 0), 0);
      const likes = games.reduce((n, p) => n + ((p.likeUsers && p.likeUsers.length) || 0), 0);
      sendJson(res, 200, {
        creator: {
          username: creator.username,
          level: ctx.levelFromXp ? ctx.levelFromXp(creator.xp) : 1,
          bio: creator.bio || "",
          achievements: (creator.achievements || []).filter((id) => String(id).startsWith("studio-")),
          published: games.length,
          plays,
          likes
        },
        games: games.map((p) => publicProject(p))
      });
      return true;
    }

    if (method === "POST" && pathname === "/api/studio/ai") {
      const user = getSessionUser(req);
      if (!user) { sendJson(res, 401, { error: "Sign in to use Studio AI." }); return true; }
      const body = await ctx.readBody(req);
      const kind = String(body.kind || "assist");
      const cap = limitsFor(user);
      const loaded = loadUser(user.id);
      if (!loaded.user) { sendJson(res, 401, { error: "Sign in to use Studio AI." }); return true; }
      const usage = usageOf(loaded.user);
      const key = ["generate", "modify", "debug", "assist"].includes(kind) ? kind : "assist";
      if ((usage[key] || 0) >= cap.ai[key]) {
        sendJson(res, 403, {
          error: "You've reached your Free AI " + key + " limit for this month.",
          code: "LIMIT_AI",
          upgrade: loaded.user.plan !== "pro"
        });
        return true;
      }
      if (!process.env.STUDIO_AI_KEY && !process.env.OPENAI_API_KEY) {
        sendJson(res, 503, {
          error: "Studio AI is not configured on this server yet.",
          code: "AI_UNAVAILABLE",
          usage
        });
        return true;
      }
      usage[key] = (usage[key] || 0) + 1;
      writeJson(USERS_FILE, loaded.users);
      sendJson(res, 503, { error: "Studio AI is not configured on this server yet.", usage });
      return true;
    }

    return false;
  }

  return { handle, STUDIO_FILE };
};
