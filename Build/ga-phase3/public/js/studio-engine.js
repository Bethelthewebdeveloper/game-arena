(function (root) {
  const KINDS = {
    player: { color: "#22d3ee", label: "Player", w: 36, h: 36 },
    enemy: { color: "#f43f5e", label: "Enemy", w: 32, h: 32 },
    npc: { color: "#a78bfa", label: "NPC", w: 32, h: 32 },
    coin: { color: "#fbbf24", label: "Coin", w: 20, h: 20 },
    key: { color: "#f59e0b", label: "Key", w: 22, h: 22 },
    door: { color: "#94a3b8", label: "Door", w: 28, h: 48 },
    wall: { color: "#334155", label: "Wall", w: 80, h: 16 },
    platform: { color: "#64748b", label: "Platform", w: 90, h: 14 },
    obstacle: { color: "#fb7185", label: "Hazard", w: 28, h: 28 },
    power: { color: "#34d399", label: "Boost", w: 22, h: 22 },
    checkpoint: { color: "#38bdf8", label: "Flag", w: 18, h: 36 },
    deco: { color: "#1e293b", label: "Decor", w: 24, h: 24 },
    button: { color: "#155e75", label: "Button", w: 72, h: 28 },
    hud: { color: "#0f172a", label: "HUD", w: 80, h: 22 },
    spark: { color: "#67e8f9", label: "Spark", w: 10, h: 10 },
    bg: { color: "#0b1220", label: "Backdrop", w: 420, h: 300 }
  };

  const BACKGROUNDS = [
    { id: "night", color: "#0b1220", label: "Night Arena" },
    { id: "dawn", color: "#122033", label: "Dawn Court" },
    { id: "forest", color: "#0c1f16", label: "Forest Floor" },
    { id: "lava", color: "#1c1010", label: "Ember Pit" },
    { id: "ice", color: "#102030", label: "Ice Grid" }
  ];

  const BLOCKS = [
    { cat: "Events", op: "whenStart", label: "When game starts" },
    { cat: "Events", op: "whenKey", label: "When key pressed", fields: ["key"] },
    { cat: "Events", op: "whenClick", label: "When player taps" },
    { cat: "Move", op: "move", label: "Move", fields: ["n"] },
    { cat: "Move", op: "turn", label: "Turn", fields: ["n"] },
    { cat: "Move", op: "setPos", label: "Set position", fields: ["x", "y"] },
    { cat: "Move", op: "changeX", label: "Change X", fields: ["n"] },
    { cat: "Move", op: "changeY", label: "Change Y", fields: ["n"] },
    { cat: "Move", op: "teleport", label: "Teleport", fields: ["x", "y"] },
    { cat: "Control", op: "wait", label: "Wait seconds", fields: ["n"] },
    { cat: "Control", op: "repeat", label: "Repeat", fields: ["n"], nest: true },
    { cat: "Control", op: "forever", label: "Forever", nest: true },
    { cat: "Control", op: "if", label: "If", nest: true, cond: true },
    { cat: "Control", op: "ifElse", label: "If / else", nest: true, cond: true },
    { cat: "Vars", op: "createVar", label: "Create variable", fields: ["name", "n"] },
    { cat: "Vars", op: "setVar", label: "Set variable", fields: ["name", "n"] },
    { cat: "Vars", op: "changeVar", label: "Change variable", fields: ["name", "n"] },
    { cat: "Vars", op: "readVar", label: "Read variable into score", fields: ["name"] },
    { cat: "Game", op: "addScore", label: "Add score", fields: ["n"] },
    { cat: "Game", op: "changeScore", label: "Change score", fields: ["n"] },
    { cat: "Game", op: "checkpoint", label: "Save checkpoint" },
    { cat: "Game", op: "loseLife", label: "Lose life" },
    { cat: "Game", op: "addLife", label: "Add life" },
    { cat: "Game", op: "setHealth", label: "Set health", fields: ["n"] },
    { cat: "Game", op: "changeHealth", label: "Change health", fields: ["n"] },
    { cat: "Game", op: "gameOver", label: "Game over" },
    { cat: "Game", op: "win", label: "Win game" },
    { cat: "Game", op: "nextLevel", label: "Next level" },
    { cat: "Game", op: "restartLevel", label: "Restart level" },
    { cat: "Game", op: "restart", label: "Restart game" },
    { cat: "Game", op: "spawn", label: "Spawn object", fields: ["kind"] },
    { cat: "Game", op: "destroy", label: "Destroy this" },
    { cat: "Sound", op: "playSound", label: "Play beep" },
    { cat: "Sound", op: "stopSound", label: "Stop sound" }
  ];

  const COND_PRESETS = [
    { op: "touching", target: "coin", label: "Touching coin" },
    { op: "touching", target: "enemy", label: "Touching enemy" },
    { op: "touching", target: "player", label: "Touching player" },
    { op: "touching", target: "wall", label: "Touching wall" },
    { op: "touching", target: "edge", label: "Touching edge" },
    { op: "keyPressed", key: "ArrowRight", label: "Right key down" },
    { op: "keyPressed", key: "ArrowLeft", label: "Left key down" },
    { op: "keyPressed", key: "ArrowUp", label: "Up key down" },
    { op: "compare", a: "score", cmp: ">=", b: 10, label: "Score >= 10" },
    { op: "compare", a: "lives", cmp: "<=", b: 1, label: "Lives <= 1" }
  ];

  function uid(prefix) {
    return (prefix || "o") + "_" + Math.random().toString(36).slice(2, 8);
  }

  function blankProject(title) {
    return {
      version: 1,
      title: title || "Untitled Game",
      template: "blank",
      category: "Casual",
      bg: "#0b1220",
      level: 1,
      levels: 1,
      settings: { winScore: 5, startLives: 3 },
      vars: {},
      objects: [
        { id: "player", kind: "player", name: "Hero", x: 80, y: 220, w: 36, h: 36, color: "#22d3ee" }
      ],
      scripts: {
        player: [
          { op: "whenStart", kids: [{ op: "setPos", x: 80, y: 220 }] },
          { op: "whenKey", key: "ArrowRight", kids: [{ op: "changeX", n: 8 }] },
          { op: "whenKey", key: "ArrowLeft", kids: [{ op: "changeX", n: -8 }] },
          { op: "whenKey", key: "ArrowUp", kids: [{ op: "changeY", n: -8 }] },
          { op: "whenKey", key: "ArrowDown", kids: [{ op: "changeY", n: 8 }] }
        ]
      }
    };
  }

  function addObj(p, kind, x, y, extra) {
    const spec = KINDS[kind] || KINDS.deco;
    const obj = Object.assign({
      id: uid(kind),
      kind,
      name: spec.label,
      x: x,
      y: y,
      w: spec.w,
      h: spec.h,
      color: spec.color
    }, extra || {});
    p.objects.push(obj);
    return obj;
  }

  const TEMPLATES = {
    blank: { name: "Blank Arena", category: "Casual", build: (t) => blankProject(t) },
    platformer: {
      name: "Sky Steps", category: "Adventure",
      build(t) {
        const p = blankProject(t || "Sky Steps");
        p.template = "platformer"; p.category = "Adventure"; p.bg = "#08111f";
        p.objects[0].y = 250;
        addObj(p, "platform", 40, 290);
        addObj(p, "platform", 160, 240);
        addObj(p, "platform", 280, 190);
        addObj(p, "coin", 180, 210);
        addObj(p, "coin", 300, 160);
        addObj(p, "enemy", 300, 158);
        p.scripts.player.push({
          op: "whenStart",
          kids: [{ op: "forever", kids: [
            { op: "if", cond: { op: "touching", target: "coin" }, kids: [{ op: "addScore", n: 1 }] },
            { op: "if", cond: { op: "touching", target: "enemy" }, kids: [{ op: "loseLife" }] }
          ] }]
        });
        return p;
      }
    },
    maze: {
      name: "Grid Maze", category: "Puzzle",
      build(t) {
        const p = blankProject(t || "Grid Maze");
        p.template = "maze"; p.category = "Puzzle";
        [[20,20,360,12],[20,20,12,260],[20,268,360,12],[368,20,12,260],[120,20,12,140],[220,120,12,160]].forEach(([x,y,w,h]) => {
          addObj(p, "wall", x, y, { w, h });
        });
        addObj(p, "key", 300, 50);
        addObj(p, "door", 40, 220);
        return p;
      }
    },
    quiz: {
      name: "Quick Quiz", category: "Quiz",
      build(t) {
        const p = blankProject(t || "Quick Quiz");
        p.template = "quiz"; p.category = "Quiz";
        p.settings.prompt = "2 + 3 = ?";
        addObj(p, "coin", 80, 160, { name: "5", label: "5" });
        addObj(p, "obstacle", 200, 160, { name: "8", label: "8" });
        p.scripts.player = [
          { op: "whenClick", kids: [] },
          { op: "whenStart", kids: [{ op: "forever", kids: [
            { op: "if", cond: { op: "touching", target: "coin" }, kids: [{ op: "addScore", n: 1 }, { op: "win" }] },
            { op: "if", cond: { op: "touching", target: "obstacle" }, kids: [{ op: "loseLife" }] }
          ] }] }
        ];
        return p;
      }
    },
    clicker: {
      name: "Tap Vault", category: "Casual",
      build(t) {
        const p = blankProject(t || "Tap Vault");
        p.template = "clicker"; p.category = "Casual";
        p.objects = [p.objects[0]];
        p.scripts.player = [
          { op: "whenClick", kids: [{ op: "addScore", n: 1 }] },
          { op: "whenStart", kids: [{ op: "forever", kids: [
            { op: "if", cond: { op: "compare", a: "score", cmp: ">=", b: 20 }, kids: [{ op: "win" }] }
          ] }] }
        ];
        return p;
      }
    },
    runner: {
      name: "Lane Rush", category: "Arcade",
      build(t) {
        const p = blankProject(t || "Lane Rush");
        p.template = "runner"; p.category = "Arcade";
        addObj(p, "obstacle", 260, 220);
        addObj(p, "coin", 200, 180);
        p.scripts.player.push({
          op: "whenStart",
          kids: [{ op: "forever", kids: [
            { op: "changeX", n: 2 },
            { op: "if", cond: { op: "touching", target: "edge" }, kids: [{ op: "setPos", x: 40, y: 220 }] },
            { op: "if", cond: { op: "touching", target: "coin" }, kids: [{ op: "addScore", n: 1 }] },
            { op: "if", cond: { op: "touching", target: "obstacle" }, kids: [{ op: "loseLife" }] }
          ] }]
        });
        return p;
      }
    },
    puzzle: {
      name: "Switch Puzzle", category: "Puzzle",
      build(t) {
        const p = blankProject(t || "Switch Puzzle");
        p.template = "puzzle"; p.category = "Puzzle";
        addObj(p, "key", 200, 80);
        addObj(p, "door", 320, 200);
        return p;
      }
    },
    dodge: {
      name: "Star Dodge", category: "Arcade",
      build(t) {
        const p = blankProject(t || "Star Dodge");
        p.template = "dodge"; p.category = "Arcade";
        addObj(p, "enemy", 200, 40);
        addObj(p, "enemy", 280, 90);
        p.scripts.player.push({
          op: "whenStart",
          kids: [{ op: "forever", kids: [
            { op: "if", cond: { op: "touching", target: "enemy" }, kids: [{ op: "loseLife" }] }
          ] }]
        });
        return p;
      }
    },
    memory: {
      name: "Recall Pads", category: "Puzzle",
      build(t) {
        const p = blankProject(t || "Recall Pads");
        p.template = "memory"; p.category = "Puzzle";
        addObj(p, "coin", 80, 80, { name: "Pad A" });
        addObj(p, "coin", 160, 80, { name: "Pad B" });
        addObj(p, "coin", 240, 80, { name: "Pad C" });
        return p;
      }
    },
    racing: {
      name: "Circuit Dash", category: "Arcade",
      build(t) {
        const p = blankProject(t || "Circuit Dash");
        p.template = "racing"; p.category = "Arcade";
        addObj(p, "checkpoint", 300, 80);
        addObj(p, "checkpoint", 80, 80);
        p.scripts.player.push({
          op: "whenStart",
          kids: [{ op: "forever", kids: [
            { op: "if", cond: { op: "touching", target: "checkpoint" }, kids: [{ op: "addScore", n: 1 }] }
          ] }]
        });
        return p;
      }
    },
    adventure: {
      name: "Key Quest", category: "Adventure",
      build(t) {
        const p = blankProject(t || "Key Quest");
        p.template = "adventure"; p.category = "Adventure";
        addObj(p, "key", 260, 60);
        addObj(p, "door", 320, 200);
        addObj(p, "enemy", 180, 140);
        p.scripts.player.push({
          op: "whenStart",
          kids: [{ op: "forever", kids: [
            { op: "if", cond: { op: "touching", target: "key" }, kids: [{ op: "addScore", n: 1 }] },
            { op: "if", cond: { op: "touching", target: "enemy" }, kids: [{ op: "loseLife" }] },
            { op: "if", cond: { op: "compare", a: "score", cmp: ">=", b: 1 }, kids: [] }
          ] }]
        });
        return p;
      }
    }
  };

  function fromTemplate(id, title) {
    const t = TEMPLATES[id] || TEMPLATES.blank;
    return t.build(title);
  }

  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

  function hit(a, b) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }

  function playBeep(ctx, on) {
    if (!on || !root.AudioContext && !root.webkitAudioContext) return;
    try {
      const AC = root.AudioContext || root.webkitAudioContext;
      if (!playBeep._ac) playBeep._ac = new AC();
      const o = playBeep._ac.createOscillator();
      const g = playBeep._ac.createGain();
      o.frequency.value = 620;
      g.gain.value = 0.04;
      o.connect(g); g.connect(playBeep._ac.destination);
      o.start(); o.stop(playBeep._ac.currentTime + 0.08);
    } catch {}
  }

  function createRuntime(project, canvas, opts) {
    const options = opts || {};
    const ctx = canvas.getContext("2d");
    const W = canvas.width = 420;
    const H = canvas.height = 300;
    let running = false;
    let raf = 0;
    const keys = {};
    let pointer = null;
    const state = {
      score: 0,
      lives: project.settings && project.settings.startLives != null ? project.settings.startLives : 3,
      health: 3,
      level: project.level || 1,
      ended: null,
      vars: Object.assign({}, project.vars || {}),
      objects: (project.objects || []).map((o) => Object.assign({}, o)),
      wait: new Map(),
      sound: true,
      started: false,
      loops: [],
      checkpoint: null,
      sparks: []
    };

    function player() { return state.objects.find((o) => o.kind === "player" && !o.dead); }

    function evalCond(cond, actor) {
      if (!cond) return false;
      if (cond.op === "and") return evalCond(cond.left, actor) && evalCond(cond.right, actor);
      if (cond.op === "or") return evalCond(cond.left, actor) || evalCond(cond.right, actor);
      if (cond.op === "not") return !evalCond(cond.inner, actor);
      if (cond.op === "keyPressed") return !!keys[cond.key || "ArrowRight"];
      if (cond.op === "compare") {
        const map = { score: state.score, lives: state.lives, health: state.health, level: state.level };
        const av = Number(map[cond.a] != null ? map[cond.a] : state.vars[cond.a] || 0);
        const bv = Number(cond.b || 0);
        if (cond.cmp === ">") return av > bv;
        if (cond.cmp === "<") return av < bv;
        if (cond.cmp === ">=") return av >= bv;
        if (cond.cmp === "<=") return av <= bv;
        if (cond.cmp === "!=") return av !== bv;
        return av === bv;
      }
      if (cond.op === "touching") {
        const target = cond.target;
        if (target === "edge") {
          return actor.x <= 0 || actor.y <= 0 || actor.x + actor.w >= W || actor.y + actor.h >= H;
        }
        return state.objects.some((o) => {
          if (o === actor || o.dead) return false;
          if (target === "object" && cond.name && o.name !== cond.name && o.id !== cond.name) return false;
          if (target !== "object" && o.kind !== target && !(target === "wall" && o.kind === "platform")) return false;
          return hit(actor, o);
        });
      }
      return false;
    }

    function collectTouched(actor, kind) {
      return state.objects.filter((o) => o !== actor && !o.dead && o.kind === kind && hit(actor, o));
    }

    function runList(actor, list) {
      if (!list) return;
      for (const block of list) runBlock(actor, block);
    }

    function runBlock(actor, block) {
      if (!block || state.ended || actor.dead) return;
      if (actor.frozenUntil && Date.now() < actor.frozenUntil && block.op !== "wait") return;
      const n = Number(block.n);
      switch (block.op) {
        case "whenStart":
        case "whenKey":
        case "whenClick":
          runList(actor, block.kids); break;
        case "move": {
          const ang = (actor.rot || 0) * Math.PI / 180;
          const step = Number.isFinite(n) ? n : 6;
          actor.x += Math.cos(ang) * step;
          actor.y += Math.sin(ang) * step;
          break;
        }
        case "turn": actor.rot = (actor.rot || 0) + (Number.isFinite(n) ? n : 15); break;
        case "setPos": actor.x = Number(block.x) || 0; actor.y = Number(block.y) || 0; break;
        case "changeX": actor.x += Number.isFinite(n) ? n : 4; break;
        case "changeY": actor.y += Number.isFinite(n) ? n : 4; break;
        case "teleport": actor.x = Number(block.x) || 0; actor.y = Number(block.y) || 0; break;
        case "wait":
          actor.frozenUntil = Date.now() + Math.max(0, (Number.isFinite(n) ? n : 0.3) * 1000);
          break;
        case "repeat": {
          const times = Math.max(1, Math.min(40, Number.isFinite(n) ? n : 3));
          for (let i = 0; i < times; i++) runList(actor, block.kids);
          break;
        }
        case "forever":
          state.loops.push({ actorId: actor.id, kids: block.kids || [] });
          break;
        case "if": if (evalCond(block.cond, actor)) runList(actor, block.kids); break;
        case "ifElse":
          if (evalCond(block.cond, actor)) runList(actor, block.kids);
          else runList(actor, block.elseKids);
          break;
        case "createVar":
        case "setVar": state.vars[String(block.name || "v")] = Number.isFinite(n) ? n : 0; break;
        case "readVar":
          state.score = Number(state.vars[String(block.name || "v")]) || 0;
          break;
        case "changeVar": {
          const name = String(block.name || "v");
          state.vars[name] = (Number(state.vars[name]) || 0) + (Number.isFinite(n) ? n : 1);
          break;
        }
        case "changeScore":
        case "addScore": {
          state.score += Number.isFinite(n) ? n : 1;
          collectTouched(actor, "coin").forEach((c) => {
            c.dead = true;
            state.sparks.push({ x: c.x + c.w / 2, y: c.y + c.h / 2, life: 14 });
          });
          playBeep(root, state.sound);
          if (project.settings && state.score >= (project.settings.winScore || 99)) state.ended = "win";
          break;
        }
        case "checkpoint":
          state.checkpoint = { x: actor.x, y: actor.y, score: state.score, lives: state.lives };
          break;
        case "loseLife":
          state.lives -= 1;
          if (state.checkpoint && state.lives > 0) {
            actor.x = state.checkpoint.x;
            actor.y = state.checkpoint.y;
          }
          if (state.lives <= 0) state.ended = "lose";
          break;
        case "addLife": state.lives += 1; break;
        case "setHealth": state.health = Number.isFinite(n) ? n : 3; break;
        case "changeHealth":
          state.health += Number.isFinite(n) ? n : -1;
          if (state.health <= 0) { state.lives -= 1; state.health = 3; if (state.lives <= 0) state.ended = "lose"; }
          break;
        case "gameOver": state.ended = "lose"; break;
        case "win": state.ended = "win"; break;
        case "nextLevel": state.level += 1; break;
        case "setLevel": state.level = Number.isFinite(n) ? n : 1; break;
        case "restartLevel":
        case "restart": stop(); start(); return;
        case "spawn": {
          if (state.objects.length > 40) break;
          const kind = String(block.kind || "coin");
          const spec = KINDS[kind] || KINDS.coin;
          state.objects.push({ id: uid(kind), kind, name: spec.label, x: actor.x + 20, y: actor.y, w: spec.w, h: spec.h, color: spec.color });
          break;
        }
        case "destroy": actor.dead = true; break;
        case "playSound": playBeep(root, state.sound); break;
        case "stopSound": state.sound = false; break;
        default: break;
      }
      actor.x = clamp(actor.x, 0, W - actor.w);
      actor.y = clamp(actor.y, 0, H - actor.h);
    }

    function fireEvent(type, extra) {
      state.objects.forEach((obj) => {
        if (obj.dead) return;
        const list = (project.scripts && project.scripts[obj.id]) || [];
        list.forEach((block) => {
          if (block.op === type) {
            if (type === "whenKey" && extra && block.key && block.key !== extra) return;
            runBlock(obj, block);
          }
        });
      });
    }

    function tick() {
      if (!running) return;
      if (!state.ended) {
        if (!state.started) {
          fireEvent("whenStart");
          state.started = true;
        }
        state.loops.forEach((loop) => {
          const actor = state.objects.find((o) => o.id === loop.actorId && !o.dead);
          if (actor) runList(actor, loop.kids);
        });
        Object.keys(keys).forEach((k) => { if (keys[k]) fireEvent("whenKey", k); });
        state.objects.forEach((o) => {
          if (o.kind === "enemy" && !o.dead) {
            o.x += (o.dir || 1) * 1.4;
            if (o.x < 10 || o.x > W - o.w - 10) o.dir = -(o.dir || 1);
          }
        });
        state.sparks.forEach((s) => { s.life -= 1; s.y -= 0.6; });
        state.sparks = state.sparks.filter((s) => s.life > 0);
      }
      draw();
      raf = requestAnimationFrame(tick);
    }

    function draw() {
      ctx.fillStyle = project.bg || "#0b1220";
      ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      for (let x = 0; x < W; x += 30) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
      state.objects.forEach((o) => {
        if (o.dead) return;
        ctx.fillStyle = o.color || "#22d3ee";
        if (o.kind === "bg") {
          ctx.fillRect(0, 0, W, H);
        } else if (o.kind === "coin" || o.kind === "spark") {
          ctx.beginPath(); ctx.arc(o.x + o.w / 2, o.y + o.h / 2, o.w / 2, 0, Math.PI * 2); ctx.fill();
        } else if (o.kind === "button") {
          ctx.roundRect ? ctx.roundRect(o.x, o.y, o.w, o.h, 6) : ctx.fillRect(o.x, o.y, o.w, o.h);
          ctx.fill();
        } else {
          ctx.fillRect(o.x, o.y, o.w, o.h);
        }
        ctx.fillStyle = "rgba(255,255,255,0.75)";
        ctx.font = "10px Outfit, sans-serif";
        ctx.fillText(o.name || o.kind, o.x, Math.max(10, o.y - 4));
      });
      state.sparks.forEach((s) => {
        ctx.fillStyle = "rgba(103,232,249," + (s.life / 14) + ")";
        ctx.beginPath(); ctx.arc(s.x, s.y, 4, 0, Math.PI * 2); ctx.fill();
      });
      ctx.fillStyle = "#e2e8f0";
      ctx.font = "12px Outfit, sans-serif";
      ctx.fillText("Score " + state.score + "   Lives " + state.lives + "   HP " + state.health + "   Lv " + state.level, 10, 18);
      if (state.ended) {
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = state.ended === "win" ? "#34d399" : "#fb7185";
        ctx.font = "bold 22px Orbitron, sans-serif";
        ctx.fillText(state.ended === "win" ? "YOU WIN" : "GAME OVER", 130, 150);
      }
    }

    function onKey(e, down) {
      keys[e.key] = down;
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " "].includes(e.key)) e.preventDefault();
    }
    function canvasPos(e) {
      const r = canvas.getBoundingClientRect();
      const src = e.touches ? e.touches[0] : e;
      return { x: (src.clientX - r.left) * (W / r.width), y: (src.clientY - r.top) * (H / r.height) };
    }

    function start() {
      stop();
      running = true;
      state.ended = null;
      state.score = 0;
      state.lives = project.settings && project.settings.startLives != null ? project.settings.startLives : 3;
      state.objects = (project.objects || []).map((o) => Object.assign({}, o));
      state.started = false;
      state.loops = [];
      state.sparks = [];
      state.checkpoint = null;
      state.health = 3;
      window.addEventListener("keydown", keyDown);
      window.addEventListener("keyup", keyUp);
      canvas.addEventListener("pointerdown", tap);
      tick();
    }
    function keyDown(e) { onKey(e, true); }
    function keyUp(e) { onKey(e, false); }
    function tap(e) {
      pointer = canvasPos(e);
      const hero = player();
      if (hero && pointer.x >= hero.x && pointer.x <= hero.x + hero.w && pointer.y >= hero.y && pointer.y <= hero.y + hero.h) {
        fireEvent("whenClick");
      } else if (hero) {
        hero.x = clamp(pointer.x - hero.w / 2, 0, W - hero.w);
        hero.y = clamp(pointer.y - hero.h / 2, 0, H - hero.h);
        fireEvent("whenClick");
      }
    }
    function stop() {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
      canvas.removeEventListener("pointerdown", tap);
    }

    return { start, stop, state, draw };
  }

  root.StudioEngine = { KINDS, BLOCKS, COND_PRESETS, TEMPLATES, BACKGROUNDS, blankProject, fromTemplate, createRuntime, uid };
})(typeof window !== "undefined" ? window : globalThis);
