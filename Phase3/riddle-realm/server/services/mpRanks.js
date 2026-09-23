/**
 * Global Multiplayer rankings — separate from Battle and local personal bests.
 * Ranking: wins desc, then points desc, then games played asc.
 * Memory process store (Mongo later if a rank collection is added).
 */
const ranks = new Map();

function keyOf(id) {
  return String(id || '').slice(0, 40);
}

function row(id) {
  const k = keyOf(id);
  if (!ranks.has(k)) {
    ranks.set(k, { player: k, wins: 0, games: 0, points: 0 });
  }
  return ranks.get(k);
}

function recordFinishedRoom(room) {
  const players = room && room.players ? room.players : [];
  if (players.length < 2) return;
  const scored = players.map(function (p) {
    return { playerId: p.playerId, score: p.score || 0 };
  });
  let best = -1;
  scored.forEach(function (p) {
    if (p.score > best) best = p.score;
  });
  const topCount = scored.filter(function (p) {
    return p.score === best;
  }).length;
  scored.forEach(function (p) {
    const r = row(p.playerId);
    r.games += 1;
    r.points += p.score;
    if (topCount === 1 && p.score === best) r.wins += 1;
  });
}

function leaderboard(youId) {
  const list = Array.from(ranks.values()).sort(function (a, b) {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.points !== a.points) return b.points - a.points;
    return a.games - b.games;
  });
  const board = list.map(function (r, i) {
    const games = r.games || 0;
    return {
      rank: i + 1,
      player: r.player,
      wins: r.wins,
      games: games,
      points: r.points,
      winRate: games ? Math.round((r.wins / games) * 100) : 0,
      you: youId && r.player === youId
    };
  });
  const you = board.find(function (r) {
    return r.you;
  }) || null;
  return {
    formula: 'wins desc, then points desc, then games asc. Win = sole highest match score.',
    top: board.slice(0, 50),
    you: you,
    total: board.length,
    hasData: board.length > 0
  };
}

function stats() {
  return { playersTracked: ranks.size, hasData: ranks.size > 0 };
}

module.exports = { recordFinishedRoom, leaderboard, stats };
