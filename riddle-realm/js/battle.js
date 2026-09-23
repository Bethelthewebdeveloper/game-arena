/**
 * Public Battle client — separate from Multiplayer rooms.
 */
const Battle = (function () {
  'use strict';

  let play = null;

  function guestKey() {
    if (typeof Storage !== 'undefined' && Storage.getGuestKey) return Storage.getGuestKey();
    return 'guest';
  }

  function headers() {
    return { 'Content-Type': 'application/json', 'X-Guest-Key': guestKey() };
  }

  async function create(opts) {
    opts = opts || {};
    const res = await API.request('/api/battles', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({
        name: opts.name,
        description: opts.description,
        type: opts.type || 'special',
        attemptLimit: opts.attemptLimit || 1,
        scoring: opts.scoring || 'best',
        timerMinutes: opts.timerMinutes
      })
    });
    return res.ok ? { ok: true, battle: res.data.data.battle, share: res.data.data.share } : res;
  }

  async function list() {
    const res = await API.request('/api/battles');
    if (!res.ok) return res;
    return { ok: true, battles: (res.data.data && res.data.data.battles) || [] };
  }

  async function get(id) {
    const res = await API.request('/api/battles/' + encodeURIComponent(id) + '?guestKey=' + encodeURIComponent(guestKey()));
    return res.ok ? { ok: true, data: res.data.data } : res;
  }

  async function join(id) {
    const res = await API.request('/api/battles/' + encodeURIComponent(id) + '/join', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ guestKey: guestKey() })
    });
    if (!res.ok) return res;
    play = {
      battleId: res.data.data.battle.battleId,
      questions: res.data.data.battle.questions || [],
      index: 0,
      answers: [],
      remainingMs: res.data.data.battle.remainingMs,
      serverNow: res.data.data.battle.serverNow,
      receivedAt: Date.now()
    };
    return { ok: true, battle: res.data.data.battle, play: play };
  }

  function currentQuestion() {
    if (!play) return null;
    return play.questions[play.index] || null;
  }

  function answerCurrent(text) {
    if (!play) return { done: true };
    const q = play.questions[play.index];
    if (!q) return { done: true };
    play.answers.push({ id: q.id, answer: text });
    play.index += 1;
    return { done: play.index >= play.questions.length, play: play };
  }

  async function submit() {
    if (!play) return { ok: false, error: 'No battle in progress' };
    const res = await API.request('/api/battles/' + encodeURIComponent(play.battleId) + '/submit', {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ guestKey: guestKey(), answers: play.answers })
    });
    return res.ok ? { ok: true, data: res.data.data } : res;
  }

  function remaining() {
    if (!play) return 0;
    const base = play.remainingMs || 0;
    const elapsed = Date.now() - (play.receivedAt || Date.now());
    return Math.max(0, base - elapsed);
  }

  function session() {
    return play;
  }

  function clear() {
    play = null;
  }

  return {
    create: create,
    list: list,
    get: get,
    join: join,
    currentQuestion: currentQuestion,
    answerCurrent: answerCurrent,
    submit: submit,
    remaining: remaining,
    session: session,
    clear: clear
  };
})();
