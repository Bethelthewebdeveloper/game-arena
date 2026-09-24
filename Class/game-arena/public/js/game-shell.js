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

  window.GameShell = { guard, submitRun, resetSubmit, mountChrome };
})();
