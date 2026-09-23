/**
 * Riddle Realm — Multiplayer client (Phase 24)
 * Guest rooms only. Server owns room state.
 */
const Multiplayer = (function () {
  'use strict';

  const SESSION_KEY = 'rr_mp_session';
  let pollId = null;
  let onUpdate = null;

  function api() {
    if (typeof API === 'undefined') throw new Error('API client missing');
    return API;
  }

  function loadSession() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function saveSession(s) {
    try {
      if (s) sessionStorage.setItem(SESSION_KEY, JSON.stringify(s));
      else sessionStorage.removeItem(SESSION_KEY);
    } catch (e) {}
  }

  function headers() {
    const s = loadSession();
    if (!s) return {};
    return {
      'X-Player-Id': s.playerId,
      'X-Player-Token': s.playerToken,
      'Content-Type': 'application/json'
    };
  }

  function body() {
    const s = loadSession();
    return s ? { playerId: s.playerId, playerToken: s.playerToken } : {};
  }

  async function createRoom(maxPlayers, durationMinutes) {
    const res = await api().request('/api/multiplayer/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ maxPlayers: maxPlayers || 2, durationMinutes: durationMinutes || 10 })
    });
    if (!res.ok) return res;
    const d = res.data && res.data.data;
    saveSession({
      playerId: d.playerId,
      playerToken: d.playerToken,
      roomCode: d.room.roomCode,
      isHost: true
    });
    startPolling();
    return { ok: true, room: d.room, playerId: d.playerId };
  }

  async function joinRoom(code) {
    const res = await api().request('/api/multiplayer/rooms/join', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roomCode: String(code || '').trim().toUpperCase() })
    });
    if (!res.ok) return res;
    const d = res.data && res.data.data;
    saveSession({
      playerId: d.playerId,
      playerToken: d.playerToken,
      roomCode: d.room.roomCode,
      isHost: false
    });
    startPolling();
    return { ok: true, room: d.room, playerId: d.playerId, waiting: !!d.waiting };
  }

  async function fetchRoom() {
    const s = loadSession();
    if (!s) return { ok: false, error: 'No session', code: 'NO_SESSION' };
    const res = await api().request('/api/multiplayer/rooms/' + encodeURIComponent(s.roomCode), {
      headers: headers()
    });
    if (res.ok && onUpdate) onUpdate(res.data.data.room, s);
    if (!res.ok && (res.status === 404 || res.status === 403)) {
      stopPolling();
      saveSession(null);
    }
    return res.ok ? { ok: true, room: res.data.data.room } : res;
  }

  async function heartbeat() {
    const s = loadSession();
    if (!s) return { ok: false };
    const res = await api().request(
      '/api/multiplayer/rooms/' + encodeURIComponent(s.roomCode) + '/heartbeat',
      {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(body())
      }
    );
    if (res.ok && onUpdate) onUpdate(res.data.data.room, s);
    if (!res.ok && (res.status === 404 || res.status === 403)) {
      stopPolling();
      saveSession(null);
    }
    return res;
  }

  async function setReady(ready) {
    const s = loadSession();
    if (!s) return { ok: false, error: 'No session' };
    const res = await api().request(
      '/api/multiplayer/rooms/' + encodeURIComponent(s.roomCode) + '/ready',
      {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(Object.assign({ ready: !!ready }, body()))
      }
    );
    if (res.ok && onUpdate) onUpdate(res.data.data.room, s);
    return res.ok ? { ok: true, room: res.data.data.room } : res;
  }

  async function admit(targetId) {
    const s = loadSession();
    if (!s) return { ok: false, error: 'No session' };
    const res = await api().request(
      '/api/multiplayer/rooms/' + encodeURIComponent(s.roomCode) + '/admit',
      {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(Object.assign({ targetId: targetId }, body()))
      }
    );
    if (res.ok && onUpdate) onUpdate(res.data.data.room, s);
    return res.ok ? { ok: true, room: res.data.data.room } : res;
  }

  async function decline(targetId) {
    const s = loadSession();
    if (!s) return { ok: false, error: 'No session' };
    const res = await api().request(
      '/api/multiplayer/rooms/' + encodeURIComponent(s.roomCode) + '/decline',
      {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(Object.assign({ targetId: targetId }, body()))
      }
    );
    if (res.ok && onUpdate) onUpdate(res.data.data.room, s);
    return res.ok ? { ok: true, room: res.data.data.room } : res;
  }

  async function startMatch() {
    const s = loadSession();
    if (!s) return { ok: false, error: 'No session' };
    const res = await api().request(
      '/api/multiplayer/rooms/' + encodeURIComponent(s.roomCode) + '/start',
      {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(body())
      }
    );
    if (res.ok && onUpdate) onUpdate(res.data.data.room, s);
    return res.ok ? { ok: true, room: res.data.data.room } : res;
  }

  async function answer(questionId, answer) {
    const s = loadSession();
    if (!s) return { ok: false, error: 'No session' };
    const res = await api().request(
      '/api/multiplayer/rooms/' + encodeURIComponent(s.roomCode) + '/answer',
      {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(Object.assign({ questionId: questionId, answer: answer }, body()))
      }
    );
    if (res.ok && onUpdate) onUpdate(res.data.data.room, s);
    return res.ok ? { ok: true, room: res.data.data.room } : res;
  }

  async function leaderboard() {
    const s = loadSession();
    const you = s && s.playerId ? '?playerId=' + encodeURIComponent(s.playerId) : '';
    const res = await api().request('/api/multiplayer/leaderboard' + you);
    return res.ok ? { ok: true, data: res.data.data } : res;
  }

  async function leaveRoom() {
    const s = loadSession();
    stopPolling();
    if (!s) return { ok: true };
    const res = await api().request(
      '/api/multiplayer/rooms/' + encodeURIComponent(s.roomCode) + '/leave',
      {
        method: 'POST',
        headers: headers(),
        body: JSON.stringify(body())
      }
    );
    saveSession(null);
    return res;
  }

  function startPolling() {
    stopPolling();
    pollId = setInterval(function () {
      heartbeat();
    }, 2000);
    heartbeat();
  }

  function stopPolling() {
    if (pollId) {
      clearInterval(pollId);
      pollId = null;
    }
  }

  function setOnUpdate(fn) {
    onUpdate = typeof fn === 'function' ? fn : null;
  }

  function session() {
    return loadSession();
  }

  return {
    createRoom: createRoom,
    joinRoom: joinRoom,
    fetchRoom: fetchRoom,
    heartbeat: heartbeat,
    setReady: setReady,
    startMatch: startMatch,
    admit: admit,
    decline: decline,
    answer: answer,
    leaderboard: leaderboard,
    leaveRoom: leaveRoom,
    startPolling: startPolling,
    stopPolling: stopPolling,
    setOnUpdate: setOnUpdate,
    session: session
  };
})();
