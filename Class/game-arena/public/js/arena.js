(function () {
  const GAMES = {
    riddle: { path: "/games/riddle.html", name: "Riddle Game" },
    reflex: { path: "/games/reflex.html", name: "Reflex Challenge" },
    memory: { path: "/games/memory.html", name: "Memory Challenge" },
    penalty: { path: "/games/penalty.html", name: "Penalty Shootout" },
    rps: { path: "/games/rps.html", name: "Rock Paper Scissors" },
    wordclash: { path: "/games/wordclash.html", name: "Word Clash" },
    trivia: { path: "/games/trivia.html", name: "Trivia Rush" },
    minirace: { path: "/games/minirace.html", name: "Mini Race" },
    targetstrike: { path: "/games/targetstrike.html", name: "Target Strike" },
    patternmaster: { path: "/games/patternmaster.html", name: "Pattern Master" },
    numberrush: { path: "/games/numberrush.html", name: "Number Rush" },
    codebreaker: { path: "/games/codebreaker.html", name: "Code Breaker" },
    minifootball: { path: "/games/minifootball.html", name: "Mini Football" },
  };

  async function getMe() {
    try {
      const res = await fetch("/api/me", { credentials: "same-origin" });
      const data = await res.json();
      return data.user || null;
    } catch {
      return null;
    }
  }

  function loginUrl(next) {
    const q = next ? "?next=" + encodeURIComponent(next) : "";
    return "/login" + q;
  }

  function goPlay(gameId) {
    const game = gameId ? GAMES[gameId] : null;
    const dest = game ? game.path : "/dashboard";
    getMe().then((user) => {
      if (user) window.location.href = dest;
      else window.location.href = loginUrl(dest);
    });
  }

  function goArena() {
    getMe().then((user) => {
      if (user) window.location.href = "/dashboard";
      else window.location.href = loginUrl("/dashboard");
    });
  }

  function nextFromQuery() {
    const params = new URLSearchParams(window.location.search);
    const next = params.get("next") || "";
    if (!next.startsWith("/") || next.startsWith("//")) return "/dashboard";
    return next;
  }

  async function applyNavAuth() {
    const user = await getMe();
    document.querySelectorAll("[data-auth-guest]").forEach((el) => {
      el.hidden = !!user;
    });
    document.querySelectorAll("[data-auth-user]").forEach((el) => {
      el.hidden = !user;
    });
    document.querySelectorAll("[data-username]").forEach((el) => {
      if (user) el.textContent = user.username;
    });
    document.querySelectorAll("[data-user-level]").forEach((el) => {
      if (user) el.textContent = "Lv " + user.level;
    });
    return user;
  }

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    });
  }

  async function waitlistStatus() {
    try {
      const res = await fetch("/api/waitlist", { credentials: "same-origin" });
      if (res.status === 401) return { error: "auth" };
      return await res.json();
    } catch {
      return { error: "network" };
    }
  }

  function openWaitlist(user, source) {
    if (!user) {
      window.location.href = loginUrl("/dashboard");
      return;
    }
    const old = document.getElementById("ga-waitlist");
    if (old) old.remove();
    const wrap = document.createElement("div");
    wrap.id = "ga-waitlist";
    wrap.className = "fixed inset-0 z-50 grid place-items-end sm:place-items-center bg-black/70 p-3";
    wrap.innerHTML = `
      <div class="w-full max-w-md rounded-2xl border border-white/15 bg-[#0b1220] p-5 shadow-xl">
        <p class="text-xs uppercase tracking-widest text-amber-300">Game Arena Pro</p>
        <h2 class="mt-1 text-xl font-semibold text-white">JOIN THE WAITLIST</h2>
        <p class="mt-2 text-sm text-slate-400">You're joining the early access list. This does not charge a card and does not unlock Pro yet.</p>
        <dl class="mt-4 space-y-1 text-sm">
          <div class="flex justify-between gap-3"><dt class="text-slate-500">Username</dt><dd class="text-white">${user.username}</dd></div>
          <div class="flex justify-between gap-3"><dt class="text-slate-500">User ID</dt><dd class="truncate text-white">${user.id || "—"}</dd></div>
          <div class="flex justify-between gap-3"><dt class="text-slate-500">Level</dt><dd class="text-white">${user.level || 1}</dd></div>
          <div class="flex justify-between gap-3"><dt class="text-slate-500">Plan</dt><dd class="uppercase text-white">${user.plan || "free"}</dd></div>
        </dl>
        <label class="mt-4 block text-sm text-slate-300">Contact email (optional)
          <input id="ga-wl-email" type="email" class="mt-1 w-full min-h-11 rounded-xl border border-white/10 bg-white/5 px-3" placeholder="you@example.com" />
        </label>
        <p id="ga-wl-msg" class="mt-3 min-h-5 text-sm text-slate-300"></p>
        <div class="mt-4 flex flex-wrap gap-2">
          <button id="ga-wl-go" class="min-h-11 rounded-xl bg-amber-400 px-4 font-semibold text-slate-950">Confirm joining waitlist</button>
          <button id="ga-wl-cancel" class="min-h-11 rounded-xl border border-white/15 px-4">Cancel</button>
        </div>
      </div>`;
    document.body.appendChild(wrap);
    wrap.querySelector("#ga-wl-cancel").onclick = () => wrap.remove();
    wrap.addEventListener("click", (e) => { if (e.target === wrap) wrap.remove(); });
    wrap.querySelector("#ga-wl-go").onclick = async () => {
      const msg = wrap.querySelector("#ga-wl-msg");
      const btn = wrap.querySelector("#ga-wl-go");
      btn.disabled = true;
      msg.textContent = "Saving…";
      try {
        const res = await fetch("/api/waitlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({
            email: wrap.querySelector("#ga-wl-email").value,
            source: source || "dashboard"
          })
        });
        const data = await res.json();
        if (res.status === 401) {
          msg.textContent = "Sign in to join the waitlist.";
          btn.disabled = false;
          return;
        }
        if (!res.ok || data.error) {
          msg.textContent = data.error || "Could not join the waitlist.";
          btn.disabled = false;
          return;
        }
        if (data.already) {
          wrap.querySelector("h2").textContent = "YOU'RE ALREADY ON THE WAITLIST";
          msg.textContent = "You're already registered for Game Arena Pro early access.";
        } else {
          wrap.querySelector("h2").textContent = "YOU'RE ON THE LIST!";
          msg.textContent = "You've joined the Game Arena Pro waitlist. We'll notify you when early access is available.";
        }
        btn.hidden = true;
        wrap.querySelector("#ga-wl-cancel").textContent = "Back to Game Arena";
      } catch {
        msg.textContent = "Network error. Try again.";
        btn.disabled = false;
      }
    };
  }

  window.Arena = {
    GAMES,
    getMe,
    goPlay,
    goArena,
    loginUrl,
    nextFromQuery,
    applyNavAuth,
    waitlistStatus,
    openWaitlist,
  };
})();
