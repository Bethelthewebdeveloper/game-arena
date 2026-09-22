(function () {
  const GAMES = {
    riddle: { path: "/games/riddle.html", name: "Riddle Game" },
    reflex: { path: "/games/reflex.html", name: "Reflex Challenge" },
    memory: { path: "/games/memory.html", name: "Memory Challenge" },
    penalty: { path: "/games/penalty.html", name: "Penalty Shootout" },
    rps: { path: "/games/rps.html", name: "Rock Paper Scissors" },
    wordclash: { path: "/games/wordclash.html", name: "Word Clash" },
    trivia: { path: "/games/trivia.html", name: "Trivia Rush" },
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

  window.Arena = {
    GAMES,
    getMe,
    goPlay,
    goArena,
    loginUrl,
    nextFromQuery,
    applyNavAuth,
  };
})();
