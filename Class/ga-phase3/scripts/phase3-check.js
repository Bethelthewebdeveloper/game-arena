const http = require("http");
const fs = require("fs");
const path = require("path");

const dataDir = path.join("/tmp", "ga-phase3-data-" + Date.now());
fs.mkdirSync(dataDir, { recursive: true });
process.env.DATA_DIR = dataDir;
process.env.NODE_ENV = "development";
process.env.SESSION_SECRET = "phase3-test-secret";

const handle = require("../server");
const server = http.createServer(handle);

function jarFrom(res, jar) {
  const raw = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  raw.filter(Boolean).forEach((c) => {
    const part = String(c).split(";")[0];
    const i = part.indexOf("=");
    if (i > 0) jar[part.slice(0, i)] = part.slice(i + 1);
  });
  return jar;
}
function cookieHeader(jar) {
  return Object.entries(jar).map(([k, v]) => k + "=" + v).join("; ");
}
async function api(base, method, pathname, body, jar) {
  const res = await fetch(base + pathname, {
    method,
    headers: Object.assign({ "content-type": "application/json" }, jar ? { cookie: cookieHeader(jar) } : {}),
    body: body ? JSON.stringify(body) : undefined
  });
  jarFrom(res, jar || {});
  const text = await res.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch { data = { raw: text }; }
  return { status: res.status, data };
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}
function project(title, category) {
  return {
    title,
    description: "A real published game",
    template: "blank",
    category: category || "Arcade",
    projectData: {
      version: 1,
      title,
      template: "blank",
      category: category || "Arcade",
      bg: "#0b1220",
      levels: 3,
      objects: [{ id: "player", kind: "player", name: "Hero", x: 40, y: 40, w: 36, h: 36, color: "#22d3ee" }],
      scripts: { player: [{ op: "whenStart" }] },
      assets: []
    }
  };
}

server.listen(0, "127.0.0.1", async () => {
  const base = "http://127.0.0.1:" + server.address().port;
  const a = {};
  const b = {};
  try {
    let r = await api(base, "POST", "/api/register", { username: "phase3a", password: "secret1" }, a);
    assert(r.status === 200, "register A");
    const xp0 = r.data.user.xp || 0;
    r = await api(base, "POST", "/api/register", { username: "phase3b", password: "secret1" }, b);
    assert(r.status === 200, "register B");

    r = await api(base, "POST", "/api/studio/projects", project("Lane One", "Arcade"), a);
    assert(r.status === 200, "create 1 " + JSON.stringify(r.data));
    const firstId = r.data.project.gameId;
    let secondId;
    r = await api(base, "GET", "/api/me", null, a);
    assert((r.data.user.xp || 0) === xp0 + 15, "first create XP missing");
    assert((r.data.user.achievements || []).includes("studio-first-game"), "first game achievement");
    r = await api(base, "POST", "/api/studio/projects", project("Lane Two", "Arcade"), a);
    assert(r.status === 200, "create 2");
    secondId = r.data.project.gameId;
    r = await api(base, "GET", "/api/me", null, a);
    assert((r.data.user.xp || 0) === xp0 + 15, "create XP farmed");

    r = await api(base, "POST", "/api/studio/projects", { title: "Pro Track", template: "racing", projectData: project("Pro Track").projectData }, a);
    assert(r.status === 403 && r.data.code === "LIMIT_TEMPLATE", "advanced template not blocked");
    r = await api(base, "GET", "/api/me", null, a);
    assert(r.data.user.plan !== "pro", "template block activated pro");

    r = await api(base, "POST", "/api/studio/projects/" + firstId + "/publish", {}, a);
    assert(r.status === 200 && r.data.project.status === "PUBLISHED", "publish");
    r = await api(base, "GET", "/api/me", null, a);
    assert((r.data.user.achievements || []).includes("studio-first-publish"), "publish achievement");
    assert((r.data.user.xp || 0) === xp0 + 40, "publish XP");

    for (let i = 0; i < 3; i++) {
      const made = await api(base, "POST", "/api/studio/projects", project("Extra " + i, "Puzzle"), a);
      assert(made.status === 200, "extra create " + i);
      const pub = await api(base, "POST", "/api/studio/projects/" + made.data.project.gameId + "/publish", {}, a);
      assert(pub.status === 200, "extra publish " + i + " " + JSON.stringify(pub.data));
    }
    const pub2 = await api(base, "POST", "/api/studio/projects/" + secondId + "/publish", {}, a);
    assert(pub2.status === 200, "publish lane two");
    const sixth = await api(base, "POST", "/api/studio/projects", project("Sixth", "Quiz"), a);
    assert(sixth.status === 403 && sixth.data.code === "LIMIT_PROJECTS", "sixth project allowed");
    r = await api(base, "GET", "/api/studio/entitlements", null, a);
    assert(r.data.entitlements.plan === "free", "plan not free");
    assert(r.data.entitlements.subscriptionStatus === "none", "fake subscription");
    assert(r.data.entitlements.paymentProvider === null, "fake provider");
    assert(r.data.entitlements.features.published === 5, "published cap");

    r = await api(base, "POST", "/api/waitlist", { displayName: "phase3a", email: "phase3a@example.com", phone: "+2348012345678", source: "studio" }, a);
    assert(r.status === 200 && r.data.ok, "waitlist " + JSON.stringify(r.data));
    r = await api(base, "GET", "/api/studio/entitlements", null, a);
    assert(r.data.entitlements.plan === "free", "waitlist activated pro");
    assert(r.data.entitlements.waitlistStatus === "WAITING", "waitlist status missing");
    assert(r.data.entitlements.subscriptionStatus === "none", "waitlist created subscription");

    r = await api(base, "GET", "/api/studio/community?q=lane%20one", null, b);
    assert((r.data.games || []).some((g) => g.title === "Lane One"), "search title");
    r = await api(base, "GET", "/api/studio/community?q=phase3a", null, b);
    assert((r.data.games || []).length >= 1, "search creator");
    r = await api(base, "GET", "/api/studio/community?sort=trending", null, b);
    assert(Array.isArray(r.data.games), "trending");
    r = await api(base, "POST", "/api/studio/projects/" + firstId + "/play", {}, b);
    assert(r.status === 200 && r.data.plays === 1, "play");
    r = await api(base, "POST", "/api/studio/projects/" + firstId + "/like", {}, b);
    assert(r.status === 200 && r.data.likes === 1, "like");
    r = await api(base, "GET", "/api/studio/community?sort=recent", null, b);
    assert((r.data.games || []).some((g) => g.gameId === firstId), "recently played");
    r = await api(base, "GET", "/api/studio/community?sort=recommended", null, b);
    assert(Array.isArray(r.data.games), "recommended");
    r = await api(base, "GET", "/api/studio/analytics", null, a);
    assert(r.data.analytics.totals.published === 5, "analytics published " + JSON.stringify(r.data.analytics));
    assert(r.data.analytics.totals.plays === 1, "analytics plays");
    assert(!r.data.analytics.byGame, "free got pro analytics");
    assert(!JSON.stringify(r.data.analytics).includes("phase3b"), "player identity leaked");

    const users = JSON.parse(fs.readFileSync(path.join(dataDir, "users.json"), "utf8"));
    const pro = users.find((u) => u.username === "phase3b");
    pro.plan = "pro";
    pro.subscriptionStatus = "none";
    fs.writeFileSync(path.join(dataDir, "users.json"), JSON.stringify(users, null, 2));
    r = await api(base, "GET", "/api/studio/analytics", null, b);
    assert(r.data.analytics.analytics === "advanced" && Array.isArray(r.data.analytics.byGame), "pro analytics");
    assert(r.data.analytics.plan === "pro" && r.data.entitlements === undefined, "analytics shape");

    console.log("PHASE3_OK");
    server.close();
    process.exit(0);
  } catch (err) {
    console.error("PHASE3_FAIL", err && err.stack || err);
    server.close();
    process.exit(1);
  }
});
