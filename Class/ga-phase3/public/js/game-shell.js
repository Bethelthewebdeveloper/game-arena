(function () {
  async function guard() {
    const user = await Arena.getMe();
    if (!user) {
      const next = location.pathname + location.search;
      location.replace(Arena.loginUrl(next));
      return null;
    }
    return user;
  }

  let submitting = false;
  async function submitRun(gameId, score, xp, coins, extra) {
    if (submitting) return { ok: true, duplicate: true };
    submitting = true;
    const payload = Object.assign({ gameId, score, xp, coins }, extra || {});
    try {
      const res = await fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      submitting = false;
      return data;
    } catch {
      submitting = false;
      return { error: "Could not save result. Check your connection and try again." };
    }
  }

  function resetSubmit() {
    submitting = false;
  }

  function mountChrome(title) {
    const header = document.createElement("header");
    header.className = "border-b border-white/10";
    header.innerHTML = `
      <div class="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <a href="/dashboard" class="min-h-11 inline-flex items-center text-sm text-cyan-300 hover:underline">← Arena</a>
        <img src="/brand/logo-mark.png" alt="" class="h-7 w-auto" /><p class="font-display text-xs tracking-wider text-white">${title}</p>
        <a href="/leaderboard" class="min-h-11 inline-flex items-center text-sm text-slate-400 hover:text-white">Ranks</a>
      </div>`;
    document.body.prepend(header);
  }

  window.addEventListener("pagehide", () => {
    if (typeof window.__gaCleanup === "function") {
      try { window.__gaCleanup(); } catch (err) {}
    }
  });

  async function guardPro(gameName) {
    const user = await guard();
    if (!user) return null;
    if ((user.plan || "free") === "pro") return user;
    const main = document.querySelector("main") || document.body;
    const box = document.createElement("section");
    box.className = "mx-auto mt-6 max-w-xl rounded-2xl border border-amber-400/25 bg-amber-400/10 p-5";
    box.innerHTML = `<p class="text-xs uppercase tracking-widest text-amber-300">Pro feature</p>
      <h2 class="mt-1 text-xl font-semibold text-white">${gameName || "This game"} is planned for Game Arena Pro</h2>
      <p class="mt-2 text-sm text-slate-300">Free accounts keep every current core game. Pro games stay locked until Pro launches.</p>
      <div class="mt-4 flex flex-wrap gap-2">
        <button id="pro-wl" class="min-h-11 rounded-xl bg-amber-400 px-4 font-semibold text-slate-950">Join the waitlist</button>
        <a href="/dashboard" class="min-h-11 inline-flex items-center rounded-xl border border-white/15 px-4">Not now</a>
      </div>`;
    main.prepend(box);
    document.getElementById("pro-wl").onclick = () => Arena.openWaitlist(user, "pro-game");
    return null;
  }

  window.GameShell = { guard, guardPro, submitRun, resetSubmit, mountChrome };
})();
