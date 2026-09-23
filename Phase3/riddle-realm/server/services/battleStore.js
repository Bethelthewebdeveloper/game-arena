/**
 * Public Battle events — separate from Multiplayer rooms.
 * Memory store with optional Mongo later. Server scores answers.
 */
const { publicCode, guestId } = require('../utils/ids');
const events = require('./eventLog');

const STATES = ['SCHEDULED', 'LIVE', 'ENDING', 'COMPLETED', 'ARCHIVED'];
const TYPES = ['daily', 'weekly', 'special'];

const FALLBACK = [
  { id: 'b1', question: 'I speak without a mouth and hear without ears. What am I?', answer: 'echo', options: ['Echo', 'Shadow', 'Whistle', 'Cloud'] },
  { id: 'b2', question: 'The more you take, the more you leave behind. What am I?', answer: 'footsteps', options: ['Footsteps', 'Memories', 'Coins', 'Time'] },
  { id: 'b3', question: 'What has keys but no locks?', answer: 'piano', options: ['Piano', 'Map', 'Keyboard only', 'Diary'] },
  { id: 'b4', question: 'What has a head and a tail but no body?', answer: 'coin', options: ['Coin', 'Snake', 'Comet', 'Nail'] },
  { id: 'b5', question: 'What can travel around the world while staying in a corner?', answer: 'stamp', options: ['Stamp', 'Shadow', 'Airplane', 'Rumor'] },
  { id: 'b6', question: 'What gets wetter the more it dries?', answer: 'towel', options: ['Towel', 'Sponge', 'Rain', 'Soap'] },
  { id: 'b7', question: 'What has hands but cannot clap?', answer: 'clock', options: ['Clock', 'Glove', 'Statue', 'Map'] },
  { id: 'b8', question: 'What has many teeth but cannot bite?', answer: 'comb', options: ['Comb', 'Saw', 'Zipper', 'Gear'] }
];

const battles = new Map();

function now() {
  return Date.now();
}

function normalizeAnswer(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

function pickSet() {
  return FALLBACK.map((q) => ({
    id: q.id,
    question: q.question,
    answer: q.answer,
    options: q.options.slice()
  }));
}

function publicBattle(b, includeQuestions) {
  if (!b) return null;
  const remainingMs = Math.max(0, b.endsAt - now());
  return {
    battleId: b.battleId,
    type: b.type,
    name: b.name,
    description: b.description,
    status: b.status,
    startsAt: new Date(b.startsAt).toISOString(),
    endsAt: new Date(b.endsAt).toISOString(),
    remainingMs: b.status === 'LIVE' ? remainingMs : 0,
    durationMs: b.endsAt - b.startsAt,
    serverNow: now(),
    currentLeader: currentLeader(b),
    attemptLimit: b.attemptLimit,
    scoring: b.scoring,
    participantCount: Object.keys(b.participants).length,
    completionCount: Object.values(b.participants).filter((p) => p.official).length,
    link: '/battle/' + b.battleId,
    questionCount: (b.questions || []).length,
    questions: includeQuestions
      ? b.questions.map((q) => ({ id: q.id, question: q.question, options: q.options }))
      : undefined
  };
}

function refreshStatus(b) {
  const t = now();
  if (b.status === 'ARCHIVED' || b.status === 'COMPLETED') return;
  if (t < b.startsAt) b.status = 'SCHEDULED';
  else if (t >= b.endsAt) b.status = 'COMPLETED';
  else b.status = 'LIVE';
}

function createBattle(opts) {
  opts = opts || {};
  const type = TYPES.includes(opts.type) ? opts.type : 'special';
  const battleId = publicCode(6);
  const startsAt = opts.startsAt ? new Date(opts.startsAt).getTime() : now();
  const featureAccess = require('./featureAccess');
  const minutes = parseInt(opts.timerMinutes || (opts.durationMs ? opts.durationMs / 60000 : 10), 10);
  const tCheck = featureAccess.canUseTimer(minutes, 'battle');
  const useMin = tCheck.ok ? tCheck.minutes : tCheck.fallbackMinutes || 10;
  const durationMs = useMin * 60 * 1000;
  const b = {
    battleId,
    type,
    name: opts.name || (type === 'daily' ? 'Daily Battle' : type === 'weekly' ? 'Weekly Battle' : 'Special Battle'),
    description: opts.description || 'Compete for the leaderboard. One official attempt.',
    status: 'SCHEDULED',
    startsAt,
    endsAt: startsAt + durationMs,
    attemptLimit: Math.max(1, parseInt(opts.attemptLimit, 10) || 1),
    scoring: opts.scoring || 'best',
    questions: pickSet(),
    participants: {},
    createdAt: now()
  };
  refreshStatus(b);
  battles.set(battleId, b);
  events.record('battle_created', b.name + ' created (' + b.battleId + ')', { ref: battleId });
  return b;
}

function ensureRecurring() {
  return;
  const list = Array.from(battles.values());
  const hasLiveDaily = list.some((b) => {
    refreshStatus(b);
    return b.type === 'daily' && (b.status === 'LIVE' || b.status === 'SCHEDULED');
  });
  const hasLiveWeekly = list.some((b) => {
    refreshStatus(b);
    return b.type === 'weekly' && (b.status === 'LIVE' || b.status === 'SCHEDULED');
  });
  if (!hasLiveDaily) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    createBattle({
      type: 'daily',
      name: 'Daily Battle',
      description: 'Today’s public riddle battle. Best official score ranks.',
      startsAt: start.toISOString(),
      durationMs: 24 * 36e5,
      attemptLimit: 1
    });
  }
  if (!hasLiveWeekly) {
    const start = new Date();
    const day = start.getDay();
    const diff = (day + 6) % 7;
    start.setDate(start.getDate() - diff);
    start.setHours(0, 0, 0, 0);
    createBattle({
      type: 'weekly',
      name: 'Weekly Battle',
      description: 'This week’s public battle. One official attempt.',
      startsAt: start.toISOString(),
      durationMs: 7 * 864e5,
      attemptLimit: 1
    });
  }
}

function listPublic() {
  return Array.from(battles.values())
    .map((b) => {
      refreshStatus(b);
      return publicBattle(b, false);
    })
    .filter((b) => b.status !== 'ARCHIVED')
    .sort((a, b) => (a.status === 'LIVE' ? -1 : 1));
}

function getBattle(id) {
  const b = battles.get(String(id || '').trim().toUpperCase());
  if (!b) return null;
  refreshStatus(b);
  return b;
}

function currentLeader(b) {
  const board = leaderboard(b, null);
  const top = board.top && board.top[0];
  return top ? { player: top.player, score: top.score } : null;
}

function joinBattle(id, guestKey) {
  const b = getBattle(id);
  if (!b) {
    const err = new Error('Battle not found');
    err.status = 404;
    err.code = 'BATTLE_NOT_FOUND';
    throw err;
  }
  if (b.status !== 'LIVE') {
    const err = new Error('Battle is not live');
    err.status = 409;
    err.code = 'BATTLE_NOT_LIVE';
    throw err;
  }
  const gk = String(guestKey || guestId()).slice(0, 32);
  if (!b.participants[gk]) {
    b.participants[gk] = {
      guestKey: gk,
      attempts: 0,
      official: null,
      joinedAt: now()
    };
    events.record('battle_join', 'Player joined ' + b.name, { guestKey: gk, ref: b.battleId });
  }
  return { battle: publicBattle(b, true), guestKey: gk };
}

function submitBattle(id, guestKey, answers) {
  const b = getBattle(id);
  if (!b) {
    const err = new Error('Battle not found');
    err.status = 404;
    err.code = 'BATTLE_NOT_FOUND';
    throw err;
  }
  if (b.status !== 'LIVE') {
    const err = new Error('Battle is closed for submissions');
    err.status = 409;
    err.code = 'BATTLE_CLOSED';
    throw err;
  }
  const gk = String(guestKey || '').slice(0, 32);
  if (!gk || !b.participants[gk]) {
    const err = new Error('Join the battle before submitting');
    err.status = 400;
    err.code = 'NOT_JOINED';
    throw err;
  }
  const p = b.participants[gk];
  if (p.attempts >= b.attemptLimit && p.official) {
    const err = new Error('Official attempt already used');
    err.status = 409;
    err.code = 'ATTEMPT_USED';
    throw err;
  }

  const map = {};
  (answers || []).forEach((a) => {
    if (a && a.id) map[a.id] = a.answer;
  });

  let correct = 0;
  b.questions.forEach((q) => {
    if (normalizeAnswer(map[q.id]) === normalizeAnswer(q.answer)) correct += 1;
  });
  const score = correct * 100;
  p.attempts += 1;
  const row = {
    score,
    correct,
    total: b.questions.length,
    submittedAt: now()
  };
  if (!p.official || (b.scoring === 'best' && score > p.official.score)) {
    p.official = row;
  }
  events.record('battle_score', 'Verified battle score ' + score + ' on ' + b.battleId, {
    guestKey: gk,
    ref: b.battleId
  });
  return { result: p.official, battle: publicBattle(b, false), leaderboard: leaderboard(b, gk) };
}

function leaderboard(b, youKey) {
  const rows = Object.values(b.participants)
    .filter((p) => p.official)
    .map((p) => ({
      guestKey: p.guestKey,
      score: p.official.score,
      correct: p.official.correct,
      submittedAt: p.official.submittedAt
    }))
    .sort((a, c) => {
      if (c.score !== a.score) return c.score - a.score;
      if (a.submittedAt !== c.submittedAt) return a.submittedAt - c.submittedAt;
      return String(a.guestKey).localeCompare(String(c.guestKey));
    });
  const board = rows.map((r, i) => ({
    rank: i + 1,
    player: r.guestKey,
    score: r.score,
    you: youKey && r.guestKey === youKey
  }));
  const you = board.find((r) => r.you) || null;
  return { top: board.slice(0, 25), you, total: board.length };
}

function stats() {
  const list = Array.from(battles.values());
  list.forEach(refreshStatus);
  return {
    scheduled: list.filter((b) => b.status === 'SCHEDULED').length,
    live: list.filter((b) => b.status === 'LIVE').length,
    completed: list.filter((b) => b.status === 'COMPLETED').length,
    participants: list.reduce((n, b) => n + Object.keys(b.participants).length, 0),
    battles: list.map((b) => publicBattle(b, false))
  };
}

module.exports = {
  createBattle,
  listPublic,
  getBattle,
  joinBattle,
  submitBattle,
  leaderboard,
  publicBattle,
  stats,
  ensureRecurring
};
