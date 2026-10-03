const http = require("http");
const fs = require("fs");
const path = require("path");

const dataDir = path.join("/tmp", "ga-phase2-data-" + Date.now());
fs.mkdirSync(dataDir, { recursive: true });
process.env.DATA_DIR = dataDir;
process.env.NODE_ENV = "development";
process.env.SESSION_SECRET = "phase2-test-secret";

const handle = require("../server");
const server = http.createServer(handle);

function jarFrom(res, jar) {
  const raw = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
  const list = raw.length ? raw : (res.headers["set-cookie"] || []);
  const arr = Array.isArray(list) ? list : [list];
  arr.filter(Boolean).forEach((c) => {
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
    headers: Object.assign(
      { "content-type": "application/json" },
      jar ? { cookie: cookieHeader(jar) } : {}
    ),
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

server.listen(0, "127.0.0.1", async () => {
  const base = "http://127.0.0.1:" + server.address().port;
  const a = {};
  const b = {};
  try {
    let r = await api(base, "POST", "/api/register", { username: "phase2a", password: "secret1" }, a);
    assert(r.status === 200 && r.data.user, "register A failed " + JSON.stringify(r.data));
    r = await api(base, "POST", "/api/register", { username: "phase2b", password: "secret1" }, b);
    assert(r.status === 200 && r.data.user, "register B failed");

    r = await api(base, "POST", "/api/studio/projects", {
      title: "Space Adventure",
      description: "A small public test game",
      template: "blank",
      category: "Adventure",
      projectData: {
        version: 1,
        title: "Space Adventure",
        template: "blank",
        category: "Adventure",
        bg: "#0b1220",
        objects: [{ id: "player", kind: "player", name: "Hero", x: 40, y: 40, w: 36, h: 36, color: "#22d3ee" }],
        scripts: { player: [{ op: "whenStart", kids: [] }] }
      }
    }, a);
    assert(r.status === 200 && r.data.project && r.data.project.status === "DRAFT", "create draft failed " + JSON.stringify(r.data));
    const id = r.data.project.gameId;
    const slug = r.data.project.slug;
    assert(slug.includes("space-adventure"), "slug missing title");

    r = await api(base, "GET", "/api/studio/projects/" + id, null, b);
    assert(r.status === 404, "draft visible to other user");

    r = await api(base, "POST", "/api/studio/projects/" + id + "/publish", {}, b);
    assert(r.status === 403, "other user published");

    r = await api(base, "POST", "/api/studio/projects/" + id + "/publish", {}, a);
    assert(r.status === 200 && r.data.project.status === "PUBLISHED", "publish failed " + JSON.stringify(r.data));
    assert(r.data.project.url === "/g/" + slug, "public url mismatch");

    r = await api(base, "GET", "/api/studio/public/" + encodeURIComponent(slug), null, {});
    assert(r.status === 200 && r.data.project.projectData, "public payload missing");
    assert(r.data.project.preview && r.data.project.preview.dots.length === 1, "preview missing");

    r = await api(base, "GET", "/g/" + slug, null, {});
    assert(r.status === 200, "public page not served");

    r = await api(base, "GET", "/api/studio/community?sort=new", null, a);
    assert((r.data.games || []).some((g) => g.gameId === id), "community missing published game");

    r = await api(base, "POST", "/api/studio/projects/" + id + "/like", {}, b);
    assert(r.status === 200 && r.data.liked === true && r.data.likes === 1, "like failed " + JSON.stringify(r.data));
    r = await api(base, "POST", "/api/studio/projects/" + id + "/like", {}, b);
    assert(r.status === 200 && r.data.liked === false && r.data.likes === 0, "duplicate like not toggled");

    r = await api(base, "POST", "/api/studio/projects/" + id + "/play", {}, b);
    assert(r.status === 200 && r.data.plays === 1, "play count failed");
    r = await api(base, "POST", "/api/studio/projects/" + id + "/play", {}, b);
    assert(r.status === 200 && r.data.plays === 1, "refresh counted as new play");

    r = await api(base, "PUT", "/api/studio/projects/" + id, { title: "Space Adventure 2", description: "Updated" }, a);
    assert(r.status === 200 && r.data.project.title === "Space Adventure 2", "update failed");
    r = await api(base, "PUT", "/api/studio/projects/" + id, { title: "Hijack" }, b);
    assert(r.status === 403, "other user edited");

    r = await api(base, "GET", "/api/studio/creator/phase2a", null, {});
    assert(r.status === 200 && r.data.creator.published === 1, "creator profile failed " + JSON.stringify(r.data));
    assert(!r.data.creator.email && !r.data.creator.passwordHash, "private fields leaked");

    r = await api(base, "POST", "/api/studio/projects/" + id + "/unpublish", {}, a);
    assert(r.status === 200 && r.data.project.status === "UNPUBLISHED", "unpublish failed");
    r = await api(base, "GET", "/api/studio/community?sort=new", null, a);
    assert(!(r.data.games || []).some((g) => g.gameId === id), "unpublished still public");
    r = await api(base, "GET", "/api/studio/public/" + encodeURIComponent(slug), null, {});
    assert(r.status === 404, "unpublished public url still live");

    r = await api(base, "POST", "/api/studio/projects/" + id + "/publish", {}, a);
    assert(r.status === 200 && r.data.project.status === "PUBLISHED", "republish failed");

    r = await api(base, "DELETE", "/api/studio/projects/" + id, null, b);
    assert(r.status === 403, "other user deleted");
    r = await api(base, "DELETE", "/api/studio/projects/" + id, null, a);
    assert(r.status === 200 && r.data.ok, "delete failed");
    r = await api(base, "GET", "/api/studio/community?sort=new", null, a);
    assert(!(r.data.games || []).some((g) => g.gameId === id), "deleted still public");

    const empty = await api(base, "POST", "/api/studio/projects", { title: "Empty", projectData: { version: 1, objects: [], scripts: {} } }, a);
    assert(empty.status === 200, "empty create failed");
    const bad = await api(base, "POST", "/api/studio/projects/" + empty.data.project.gameId + "/publish", {}, a);
    assert(bad.status === 400, "empty project published");

    console.log("PHASE2_OK");
    server.close();
    process.exit(0);
  } catch (err) {
    console.error("PHASE2_FAIL", err && err.stack || err);
    server.close();
    process.exit(1);
  }
});
