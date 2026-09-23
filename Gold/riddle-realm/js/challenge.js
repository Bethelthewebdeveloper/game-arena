/**
 * Score Challenge client — server issues unique /challenge/CODE links.
 */
const Challenge = (function () {
  'use strict';

  function guestKey() {
    if (typeof Storage !== 'undefined' && Storage.getGuestKey) return Storage.getGuestKey();
    return 'guest';
  }

  function playerBits() {
    const p = typeof Storage !== 'undefined' && Storage.loadPlayer ? Storage.loadPlayer() : {};
    const s = typeof Storage !== 'undefined' && Storage.loadStreaks ? Storage.loadStreaks() : {};
    return {
      guestKey: guestKey(),
      name: (p && p.name) || 'Riddler',
      level: (p && p.level) || 1,
      streak: (s && s.current) || 0
    };
  }

  async function create(score, mode) {
    const bits = playerBits();
    const res = await API.request('/api/challenges', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Guest-Key': bits.guestKey },
      body: JSON.stringify({
        guestKey: bits.guestKey,
        name: bits.name,
        score: score || 0,
        level: bits.level,
        streak: bits.streak,
        mode: mode || 'classic'
      })
    });
    if (!res.ok) return res;
    return { ok: true, challenge: res.data.data };
  }

  async function open(id) {
    const res = await API.request('/api/challenges/' + encodeURIComponent(id));
    return res.ok ? { ok: true, challenge: res.data.data } : res;
  }

  async function submit(id, score) {
    const res = await API.request('/api/challenges/' + encodeURIComponent(id) + '/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Guest-Key': guestKey() },
      body: JSON.stringify({ guestKey: guestKey(), score: score })
    });
    return res.ok ? { ok: true, data: res.data.data } : res;
  }

  function message(ch) {
    return (
      'RIDDLE CHALLENGE\n' +
      'I scored ' +
      ch.targetScore +
      ' points\n' +
      'Level ' +
      ch.level +
      '\n' +
      (ch.streak ? ch.streak + '-day streak\n' : '') +
      'Can you beat my score?\n' +
      (typeof location !== 'undefined' ? location.origin : '') +
      ch.link
    );
  }

  return { create: create, open: open, submit: submit, message: message, playerBits: playerBits };
})();
