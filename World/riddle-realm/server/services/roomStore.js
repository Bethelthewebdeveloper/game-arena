/**
 * Room store — MongoDB when connected, in-memory otherwise.
 * All room mutations go through this module (never trust the client).
 */
const crypto = require('crypto');
const { getConnectionState } = require('../config/database');

const mpRanks = require('./mpRanks');

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MAX_PLAYERS = 4;
const events = require('./eventLog');
const featureAccess = require('./featureAccess');
const ROOM_TTL_MS = 60 * 60 * 1000;
const PRESENCE_MS = 25 * 1000;
const EMPTY_GRACE_MS = 45 * 1000;

const MATCH_QUESTIONS = [
  { id: 'mq1', question: 'I speak without a mouth and hear without ears. What am I?', answer: 'echo', options: ['Echo', 'Shadow', 'Whistle', 'Cloud'] },
  { id: 'mq2', question: 'The more you take, the more you leave behind. What am I?', answer: 'footsteps', options: ['Footsteps', 'Memories', 'Coins', 'Time'] },
  { id: 'mq3', question: 'What has keys but no locks?', answer: 'piano', options: ['Piano', 'Map', 'Diary', 'Castle'] },
  { id: 'mq4', question: 'What has a head and a tail but no body?', answer: 'coin', options: ['Coin', 'Snake', 'Comet', 'Nail'] },
  { id: 'mq5', question: 'What gets wetter the more it dries?', answer: 'towel', options: ['Towel', 'Sponge', 'Rain', 'Soap'] }
];

function normalizeAnswer(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

const TRANSITIONS = {
  WAITING: ['READY', 'CANCELLED'],
  READY: ['WAITING', 'STARTING', 'CANCELLED'],
  STARTING: ['PLAYING', 'CANCELLED'],
  PLAYING: ['FINISHED', 'CANCELLED'],
  FINISHED: [],
  CANCELLED: []
};

const memory = new Map();

function useMongo() {
  return getConnectionState().isConnected;
}

function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}

function newId(prefix, bytes) {
  return prefix + crypto.randomBytes(bytes).toString('hex').toUpperCase().slice(0, bytes * 2);
}

function makeGuestId() {
  return 'guest_' + crypto.randomBytes(3).toString('hex').toUpperCase().slice(0, 5);
}

function makeRoomCode() {
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += CODE_CHARS[crypto.randomInt(0, CODE_CHARS.length)];
  }
  return code;
}

function makeToken() {
  return crypto.randomBytes(24).toString('hex');
}

function now() {
  return new Date();
}

function canTransition(from, to) {
  return (TRANSITIONS[from] || []).includes(to);
}

function publicPlayer(p) {
  return {
    playerId: p.playerId,
    ready: !!p.ready,
    connected: !!p.connected,
    isHost: !!p.isHost,
    score: p.score || 0,
    finished: !!p.finished,
    qIndex: p.qIndex || 0
  };
}

function publicQuestion(q) {
  if (!q) return null;
  return { id: q.id, question: q.question, options: q.options };
}

function publicRoom(room) {
  if (!room) return null;
  const playing = room.status === 'PLAYING' || room.status === 'STARTING';
  return {
    roomId: room.roomId,
    roomCode: room.roomCode,
    status: room.status,
    hostPlayerId: room.hostPlayerId,
    maxPlayers: room.maxPlayers || MAX_PLAYERS,
    playerCount: (room.players || []).length,
    pendingCount: (room.pending || []).length,
    declinedCount: room.declinedCount || 0,
    link: '/multiplayer/' + room.roomCode,
    players: (room.players || []).map(publicPlayer),
    pending: (room.pending || []).map(function (p) {
      return { playerId: p.playerId, requestedAt: p.requestedAt };
    }),
    liveRanks: (room.players || [])
      .map(function (p) {
        return { playerId: p.playerId, score: p.score || 0, finished: !!p.finished, isHost: !!p.isHost };
      })
      .sort(function (a, b) {
        return b.score - a.score;
      }),
    createdAt: room.createdAt,
    updatedAt: room.updatedAt,
    expiresAt: room.expiresAt,
    startedAt: room.startedAt || null,
    finishedAt: room.finishedAt || null,
    durationMs: room.durationMs || 10 * 60 * 1000,
    gameStartsAt: room.gameStartsAt || null,
    gameEndsAt: room.gameEndsAt || null,
    serverNow: Date.now(),
    remainingMs: remainingMs(room),
    questionCount: (room.questions || []).length,
    currentQuestion: playing ? publicQuestion((room.questions || [])[0]) : null,
    results: room.status === 'FINISHED' ? rankedResults(room) : null
  };
}

function remainingMs(room) {
  if (!room || !room.gameEndsAt) return null;
  if (room.status !== 'PLAYING' && room.status !== 'STARTING') return room.status === 'FINISHED' ? 0 : null;
  return Math.max(0, new Date(room.gameEndsAt).getTime() - Date.now());
}

function applyTimer(room) {
  if (!room || room.status !== 'PLAYING' || !room.gameEndsAt) return;
  if (Date.now() < new Date(room.gameEndsAt).getTime()) return;
  (room.players || []).forEach(function (p) {
    if (!p.finished) {
      p.finished = true;
      p.timedOut = true;
    }
  });
  maybeFinishRoom(room);
}

function publicRoomFor(room, playerId) {
  const view = publicRoom(room);
  if (!view) return null;
  const player = findPlayer(room, playerId);
  const playing = room.status === 'PLAYING' || room.status === 'STARTING';
  if (playing && player && !player.finished) {
    view.currentQuestion = publicQuestion((room.questions || [])[player.qIndex || 0]);
    view.yourIndex = player.qIndex || 0;
    view.yourScore = player.score || 0;
  } else {
    view.currentQuestion = null;
    view.yourIndex = player ? player.qIndex : 0;
    view.yourScore = player ? player.score || 0 : 0;
  }
  return view;
}

function rankedResults(room) {
  return (room.players || [])
    .map(function (p) {
      return { playerId: p.playerId, isHost: !!p.isHost, score: p.score || 0 };
    })
    .sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      return String(a.playerId).localeCompare(String(b.playerId));
    })
    .map(function (row, i) {
      row.rank = i + 1;
      return row;
    });
}

function cloneRoom(room) {
  return JSON.parse(JSON.stringify(room));
}

async function saveMemory(room) {
  memory.set(room.roomCode, room);
  return room;
}

async function findByCode(code) {
  const roomCode = String(code || '').trim().toUpperCase();
  if (!roomCode) return null;
  if (useMongo()) {
    const MultiplayerRoom = require('../models/MultiplayerRoom');
    return MultiplayerRoom.findOne({ roomCode }).select('+players.tokenHash');
  }
  return memory.get(roomCode) || null;
}

async function persist(room) {
  room.updatedAt = now();
  if (useMongo() && room.save) {
    await room.save();
    return room;
  }
  return saveMemory(room);
}

function findPlayer(room, playerId) {
  return (room.players || []).find((p) => p.playerId === playerId) || null;
}

function verifyPlayer(room, playerId, token) {
  const p = findPlayer(room, playerId);
  if (!p) return null;
  if (p.tokenHash !== hashToken(token)) return null;
  return p;
}

function refreshPresence(player) {
  player.lastSeenAt = now();
  player.connected = true;
}

function applyPresence(room) {
  const cutoff = Date.now() - PRESENCE_MS;
  (room.players || []).forEach((p) => {
    const seen = p.lastSeenAt ? new Date(p.lastSeenAt).getTime() : 0;
    p.connected = seen >= cutoff;
  });
}

function connectedCount(room) {
  return (room.players || []).filter((p) => p.connected).length;
}

function roomCap(room) {
  const n = parseInt(room && room.maxPlayers, 10);
  return [2, 4, 6, 8, 10].includes(n) ? n : MAX_PLAYERS;
}

function pickDuration(minutes) {
  const check = featureAccess.canUseTimer(minutes, 'multiplayer');
  const m = check.ok ? check.minutes : check.fallbackMinutes || 10;
  return m * 60 * 1000;
}

function lobbyReady(room) {
  const list = (room.players || []).filter((p) => p.connected);
  if (list.length < 2) return false;
  return list.every((p) => p.ready);
}

function bothReady(room) {
  return lobbyReady(room);
}

function setStatus(room, next) {
  if (room.status === next) return true;
  if (!canTransition(room.status, next)) return false;
  room.status = next;
  return true;
}

function syncLobbyStatus(room) {
  if (room.status === 'PLAYING' || room.status === 'FINISHED' || room.status === 'CANCELLED') {
    return;
  }
  if (room.status === 'STARTING') return;
  if (bothReady(room)) {
    if (room.status === 'WAITING') setStatus(room, 'READY');
  } else if (room.status === 'READY') {
    setStatus(room, 'WAITING');
  }
}

async function createRoom(opts) {
  opts = opts || {};
  let cap = parseInt(opts.maxPlayers, 10);
  const capCheck = featureAccess.canUseCapacity(cap);
  if (!capCheck.ok) cap = MAX_PLAYERS;
  if (![2, 4, 6, 8, 10].includes(cap)) cap = MAX_PLAYERS;
  const playerId = makeGuestId();
  const token = makeToken();
  const createdAt = now();
  const room = {
    roomId: newId('rm_', 8),
    roomCode: makeRoomCode(),
    status: 'WAITING',
    hostPlayerId: playerId,
    maxPlayers: cap,
    players: [
      {
        playerId,
        tokenHash: hashToken(token),
        ready: false,
        connected: true,
        lastSeenAt: createdAt,
        isHost: true,
        score: 0,
        finished: false,
        qIndex: 0
      }
    ],
    pending: [],
    declinedCount: 0,
    durationMs: pickDuration(opts.durationMinutes),
    gameStartsAt: null,
    gameEndsAt: null,
    startedAt: null,
    finishedAt: null,
    createdAt,
    updatedAt: createdAt,
    expiresAt: new Date(Date.now() + ROOM_TTL_MS)
  };
  events.record('mp_created', 'Room ' + room.roomCode + ' created', { ref: room.roomCode });

  if (useMongo()) {
    const MultiplayerRoom = require('../models/MultiplayerRoom');
    let attempts = 0;
    while (attempts < 8) {
      try {
        const doc = await MultiplayerRoom.create(room);
        return { room: doc, playerId, token };
      } catch (err) {
        if (err && err.code === 11000) {
          room.roomCode = makeRoomCode();
          room.roomId = newId('rm_', 8);
          attempts += 1;
          continue;
        }
        throw err;
      }
    }
    throw Object.assign(new Error('Could not allocate a room code'), { status: 503 });
  }

  let attempts = 0;
  while (memory.has(room.roomCode) && attempts < 8) {
    room.roomCode = makeRoomCode();
    attempts += 1;
  }
  await saveMemory(room);
  return { room, playerId, token };
}

async function joinRoom(roomCode) {
  const room = await findByCode(roomCode);
  if (!room) {
    const err = new Error('Room not found');
    err.status = 404;
    err.code = 'ROOM_NOT_FOUND';
    throw err;
  }
  applyPresence(room);
  if (room.status === 'CANCELLED' || room.status === 'FINISHED') {
    const err = new Error('This room is closed');
    err.status = 409;
    err.code = 'ROOM_CLOSED';
    throw err;
  }
  if (room.status === 'PLAYING' || room.status === 'STARTING') {
    const err = new Error('Match already started');
    err.status = 409;
    err.code = 'ROOM_IN_PROGRESS';
    throw err;
  }
  if ((room.players || []).length >= roomCap(room)) {
    const err = new Error('Room is full');
    err.status = 409;
    err.code = 'ROOM_FULL';
    throw err;
  }

  const playerId = makeGuestId();
  const token = makeToken();
  room.pending = room.pending || [];
  room.pending.push({
    playerId,
    tokenHash: hashToken(token),
    requestedAt: now()
  });
  events.record('mp_join_request', 'Join request ' + playerId + ' for ' + room.roomCode, { ref: room.roomCode });
  await persist(room);
  return { room, playerId, token, waiting: true };
}

function findPending(room, playerId) {
  return (room.pending || []).find((p) => p.playerId === playerId) || null;
}

function verifyPending(room, playerId, token) {
  const p = findPending(room, playerId);
  if (!p) return null;
  if (p.tokenHash !== hashToken(token)) return null;
  return p;
}

async function admitPlayer(roomCode, hostId, hostToken, targetId) {
  const room = await findByCode(roomCode);
  if (!room) {
    const err = new Error('Room not found');
    err.status = 404;
    err.code = 'ROOM_NOT_FOUND';
    throw err;
  }
  const host = verifyPlayer(room, hostId, hostToken);
  if (!host || room.hostPlayerId !== hostId) {
    const err = new Error('Only the host can admit players');
    err.status = 403;
    err.code = 'NOT_HOST';
    throw err;
  }
  if ((room.players || []).length >= roomCap(room)) {
    const err = new Error('Room is full');
    err.status = 409;
    err.code = 'ROOM_FULL';
    throw err;
  }
  const pend = findPending(room, targetId);
  if (!pend) {
    const err = new Error('No matching join request');
    err.status = 404;
    err.code = 'NOT_PENDING';
    throw err;
  }
  room.pending = (room.pending || []).filter((p) => p.playerId !== targetId);
  room.players.push({
    playerId: pend.playerId,
    tokenHash: pend.tokenHash,
    ready: false,
    connected: true,
    lastSeenAt: now(),
    isHost: false,
    score: 0,
    finished: false,
    qIndex: 0
  });
  events.record('mp_admitted', 'Admitted ' + targetId + ' to ' + room.roomCode, { ref: room.roomCode });
  syncLobbyStatus(room);
  await persist(room);
  return room;
}

async function declinePlayer(roomCode, hostId, hostToken, targetId) {
  const room = await findByCode(roomCode);
  if (!room) {
    const err = new Error('Room not found');
    err.status = 404;
    err.code = 'ROOM_NOT_FOUND';
    throw err;
  }
  const host = verifyPlayer(room, hostId, hostToken);
  if (!host || room.hostPlayerId !== hostId) {
    const err = new Error('Only the host can decline players');
    err.status = 403;
    err.code = 'NOT_HOST';
    throw err;
  }
  const pend = findPending(room, targetId);
  if (!pend) {
    const err = new Error('No matching join request');
    err.status = 404;
    err.code = 'NOT_PENDING';
    throw err;
  }
  room.pending = (room.pending || []).filter((p) => p.playerId !== targetId);
  room.declinedCount = (room.declinedCount || 0) + 1;
  events.record('mp_declined', 'Declined ' + targetId + ' from ' + room.roomCode, { ref: room.roomCode });
  await persist(room);
  return room;
}

async function heartbeat(roomCode, playerId, token) {
  const room = await findByCode(roomCode);
  if (!room) {
    const err = new Error('Room not found');
    err.status = 404;
    err.code = 'ROOM_NOT_FOUND';
    throw err;
  }
  const player = verifyPlayer(room, playerId, token);
  const pending = player ? null : verifyPending(room, playerId, token);
  if (!player && !pending) {
    const err = new Error('Not a player in this room');
    err.status = 403;
    err.code = 'FORBIDDEN';
    throw err;
  }
  if (player) refreshPresence(player);
  applyPresence(room);
  applyTimer(room);
  if (room.status === 'STARTING' && room.startedAt && Date.now() - new Date(room.startedAt).getTime() > 1200) {
    setStatus(room, 'PLAYING');
  }
  await persist(room);
  return room;
}

async function getRoom(roomCode, playerId, token) {
  return heartbeat(roomCode, playerId, token);
}

async function setReady(roomCode, playerId, token, ready) {
  const room = await findByCode(roomCode);
  if (!room) {
    const err = new Error('Room not found');
    err.status = 404;
    err.code = 'ROOM_NOT_FOUND';
    throw err;
  }
  const player = verifyPlayer(room, playerId, token);
  if (!player) {
    const err = new Error('Not a player in this room');
    err.status = 403;
    err.code = 'FORBIDDEN';
    throw err;
  }
  if (room.status !== 'WAITING' && room.status !== 'READY') {
    const err = new Error('Cannot change ready state now');
    err.status = 409;
    err.code = 'INVALID_STATE';
    throw err;
  }
  refreshPresence(player);
  player.ready = !!ready;
  applyPresence(room);
  syncLobbyStatus(room);
  await persist(room);
  return room;
}

async function startMatch(roomCode, playerId, token) {
  const room = await findByCode(roomCode);
  if (!room) {
    const err = new Error('Room not found');
    err.status = 404;
    err.code = 'ROOM_NOT_FOUND';
    throw err;
  }
  const player = verifyPlayer(room, playerId, token);
  if (!player) {
    const err = new Error('Not a player in this room');
    err.status = 403;
    err.code = 'FORBIDDEN';
    throw err;
  }
  if (room.hostPlayerId !== playerId) {
    const err = new Error('Only the host can start the match');
    err.status = 403;
    err.code = 'NOT_HOST';
    throw err;
  }
  applyPresence(room);
  if (!lobbyReady(room) || (room.status !== 'READY' && room.status !== 'WAITING')) {
    const err = new Error('Need at least 2 connected ready players');
    err.status = 409;
    err.code = 'NOT_READY';
    throw err;
  }
  if (room.status === 'WAITING') setStatus(room, 'READY');
  if (!setStatus(room, 'STARTING')) {
    const err = new Error('Invalid room state');
    err.status = 409;
    err.code = 'INVALID_STATE';
    throw err;
  }
  room.questions = MATCH_QUESTIONS.map(function (q) {
    return { id: q.id, question: q.question, answer: q.answer, options: q.options.slice() };
  });
  (room.players || []).forEach(function (p) {
    p.score = 0;
    p.finished = false;
    p.qIndex = 0;
  });
  room.startedAt = now();
  room.gameStartsAt = Date.now();
  room.gameEndsAt = room.gameStartsAt + (room.durationMs || 10 * 60 * 1000);
  setStatus(room, 'PLAYING');
  await persist(room);
  return room;
}

async function answerQuestion(roomCode, playerId, token, questionId, rawAnswer) {
  const room = await findByCode(roomCode);
  if (!room) {
    const err = new Error('Room not found');
    err.status = 404;
    err.code = 'ROOM_NOT_FOUND';
    throw err;
  }
  const player = verifyPlayer(room, playerId, token);
  if (!player) {
    const err = new Error('Not a player in this room');
    err.status = 403;
    err.code = 'FORBIDDEN';
    throw err;
  }
  if (room.status !== 'PLAYING') {
    const err = new Error('Match is not in progress');
    err.status = 409;
    err.code = 'INVALID_STATE';
    throw err;
  }
  applyTimer(room);
  if (room.status !== 'PLAYING' || player.finished || (room.gameEndsAt && Date.now() >= new Date(room.gameEndsAt).getTime())) {
    const err = new Error('TIME UP — answers are closed');
    err.status = 409;
    err.code = 'TIME_UP';
    throw err;
  }
  if (player.finished) {
    return room;
  }
  const q = (room.questions || [])[player.qIndex || 0];
  if (!q) {
    player.finished = true;
    await maybeFinishRoom(room);
    await persist(room);
    return room;
  }
  if (questionId && q.id !== questionId) {
    const err = new Error('Question mismatch');
    err.status = 409;
    err.code = 'QUESTION_MISMATCH';
    throw err;
  }
  if (normalizeAnswer(rawAnswer) === normalizeAnswer(q.answer)) {
    player.score = (player.score || 0) + 100;
  }
  player.qIndex = (player.qIndex || 0) + 1;
  if (player.qIndex >= (room.questions || []).length) player.finished = true;
  refreshPresence(player);
  await maybeFinishRoom(room);
  await persist(room);
  return room;
}

async function maybeFinishRoom(room) {
  const list = room.players || [];
  if (!list.length) return;
  if (list.every((p) => p.finished)) {
    if (setStatus(room, 'FINISHED')) {
      room.finishedAt = now();
      mpRanks.recordFinishedRoom(room);
    }
  }
}

async function leaveRoom(roomCode, playerId, token) {
  const room = await findByCode(roomCode);
  if (!room) {
    const err = new Error('Room not found');
    err.status = 404;
    err.code = 'ROOM_NOT_FOUND';
    throw err;
  }
  const player = verifyPlayer(room, playerId, token);
  if (!player) {
    const err = new Error('Not a player in this room');
    err.status = 403;
    err.code = 'FORBIDDEN';
    throw err;
  }

  room.players = (room.players || []).filter((p) => p.playerId !== playerId);

  if (room.players.length === 0) {
    setStatus(room, 'CANCELLED');
  } else if (room.status === 'PLAYING' || room.status === 'STARTING') {
    setStatus(room, 'CANCELLED');
  } else {
    if (room.hostPlayerId === playerId) {
      room.hostPlayerId = room.players[0].playerId;
      room.players[0].isHost = true;
    }
    room.players.forEach((p) => {
      p.ready = false;
    });
    if (room.status === 'READY') setStatus(room, 'WAITING');
  }
  await persist(room);
  return room;
}

async function cleanupAbandoned() {
  const cutoff = Date.now() - EMPTY_GRACE_MS;
  if (useMongo()) {
    const MultiplayerRoom = require('../models/MultiplayerRoom');
    const open = await MultiplayerRoom.find({
      status: { $in: ['WAITING', 'READY', 'STARTING', 'PLAYING'] }
    }).select('+players.tokenHash');
    for (const room of open) {
      applyPresence(room);
      const alive = (room.players || []).filter((p) => p.connected);
      if (alive.length === 0) {
        const newest = Math.max(
          ...(room.players || []).map((p) => (p.lastSeenAt ? new Date(p.lastSeenAt).getTime() : 0)),
          room.updatedAt ? new Date(room.updatedAt).getTime() : 0
        );
        if (newest < cutoff) {
          setStatus(room, 'CANCELLED');
          await room.save();
        }
      } else if (room.status === 'STARTING' && room.startedAt && Date.now() - new Date(room.startedAt).getTime() > 1200) {
        setStatus(room, 'PLAYING');
        await room.save();
      }
    }
    return;
  }

  for (const [code, room] of memory.entries()) {
    applyPresence(room);
    if (new Date(room.expiresAt).getTime() < Date.now()) {
      memory.delete(code);
      continue;
    }
    if (['FINISHED', 'CANCELLED'].includes(room.status)) {
      if (Date.now() - new Date(room.updatedAt).getTime() > ROOM_TTL_MS) memory.delete(code);
      continue;
    }
    const alive = (room.players || []).filter((p) => p.connected);
    if (alive.length === 0) {
      const newest = Math.max(
        ...(room.players || []).map((p) => (p.lastSeenAt ? new Date(p.lastSeenAt).getTime() : 0)),
        room.updatedAt ? new Date(room.updatedAt).getTime() : 0
      );
      if (newest < cutoff) {
        setStatus(room, 'CANCELLED');
        room.updatedAt = now();
      }
    } else if (room.status === 'STARTING' && room.startedAt && Date.now() - new Date(room.startedAt).getTime() > 1200) {
      setStatus(room, 'PLAYING');
      room.updatedAt = now();
    }
  }
}

function storageMode() {
  return useMongo() ? 'mongodb' : 'memory';
}

function listLiveRooms() {
  const out = [];
  for (const room of memory.values()) {
    if (['WAITING', 'READY', 'STARTING', 'PLAYING'].includes(room.status)) {
      out.push(publicRoom(room));
    }
  }
  return out;
}

/**
 * Founder multiplayer snapshot — real counts only (memory + optional Mongo).
 */
async function getStats() {
  const byStatus = {
    WAITING: 0,
    READY: 0,
    STARTING: 0,
    PLAYING: 0,
    FINISHED: 0,
    CANCELLED: 0
  };
  let roomsCreated = 0;
  let activeMatches = 0;
  let completedMatches = 0;

  if (useMongo()) {
    try {
      const MultiplayerRoom = require('../models/MultiplayerRoom');
      roomsCreated = await MultiplayerRoom.countDocuments({});
      completedMatches = await MultiplayerRoom.countDocuments({ status: 'FINISHED' });
      activeMatches = await MultiplayerRoom.countDocuments({
        status: { $in: ['WAITING', 'READY', 'STARTING', 'PLAYING'] }
      });
      const grouped = await MultiplayerRoom.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]);
      grouped.forEach((g) => {
        if (g._id && byStatus[g._id] != null) byStatus[g._id] = g.count;
      });
    } catch (e) {
      /* fall through to memory */
    }
  }

  // Always include in-memory rooms for this process
  for (const room of memory.values()) {
    roomsCreated += 1;
    if (byStatus[room.status] != null) byStatus[room.status] += 1;
    if (['WAITING', 'READY', 'STARTING', 'PLAYING'].includes(room.status)) activeMatches += 1;
    if (room.status === 'FINISHED') completedMatches += 1;
  }

  return {
    storage: storageMode(),
    roomsCreated,
    roomsJoined: null, // join events are not counted separately in this store
    completedMatches,
    activeMatches,
    byStatus,
    timers: timerStats(),
    multiplayerErrors: null,
    hasData: roomsCreated > 0
  };
}

function timerStats() {
  let withTimer = 0;
  let finishedEarly = 0;
  let timedOut = 0;
  const durations = {};
  for (const room of memory.values()) {
    if (room.durationMs) {
      withTimer += 1;
      const key = String(Math.round(room.durationMs / 60000)) + 'm';
      durations[key] = (durations[key] || 0) + 1;
    }
    (room.players || []).forEach(function (p) {
      if (p.timedOut) timedOut += 1;
      else if (p.finished && room.status === 'FINISHED') finishedEarly += 1;
    });
  }
  return { withTimer, finishedEarly, timedOut, durations };
}

module.exports = {
  MAX_PLAYERS,
  publicRoom,
  publicRoomFor,
  createRoom,
  listLiveRooms,
  joinRoom,
  getRoom,
  heartbeat,
  setReady,
  startMatch,
  answerQuestion,
  leaveRoom,
  admitPlayer,
  declinePlayer,
  cleanupAbandoned,
  storageMode,
  cloneRoom,
  getStats
};
