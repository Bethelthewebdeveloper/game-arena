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

  async function submitRun(gameId, score, xp, coins, extra) {
    const payload = Object.assign({ gameId, score, xp, coins }, extra || {});
    try {
      const res = await fetch("/api/progress", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      return await res.json();
    } catch {
      return { error: "Could not save result. Check your connection and try again." };
    }
  }

  function mountChrome(title) {
    const header = document.createElement("header");
    header.className = "border-b border-white/10";
    header.innerHTML = `
      <div class="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
        <a href="/dashboard" class="text-sm text-cyan-300 hover:underline">← Arena</a>
        <p class="font-display text-xs tracking-wider text-white">${title}</p>
        <a href="/" class="text-sm text-slate-400 hover:text-white">Home</a>
      </div>`;
    document.body.prepend(header);
  }

  window.GameShell = { guard, submitRun, mountChrome };
})();
