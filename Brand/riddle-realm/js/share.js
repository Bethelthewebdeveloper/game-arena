/**
 * Riddle Realm — Social / Challenge Share (Phase 16 + 26)
 * ========================================================
 * Score challenges + Daily result sharing.
 * Never includes the daily answer. Tracks share *initiations* only.
 */
const Share = (function () {
  'use strict';

  const VERSION = 1;

  function buildChallenge(session) {
    const player = Storage.loadPlayer();
    return {
      v: VERSION,
      type: 'score_challenge',
      score: session.score || 0,
      mode: session.mode || 'classic',
      category: session.category || null,
      correct: session.correctCount || 0,
      name: player.name || 'Riddler',
      level: player.level || 1,
      at: Date.now()
    };
  }

  function encode(payload) {
    try {
      const json = JSON.stringify(payload);
      return btoa(unescape(encodeURIComponent(json)))
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
    } catch (e) {
      return '';
    }
  }

  function decode(token) {
    try {
      let s = token.replace(/-/g, '+').replace(/_/g, '/');
      while (s.length % 4) s += '=';
      return JSON.parse(decodeURIComponent(escape(atob(s))));
    } catch (e) {
      return null;
    }
  }

  function getBaseUrl() {
    if (typeof location !== 'undefined' && location.origin && location.origin !== 'null') {
      return location.origin + (location.pathname || '/');
    }
    return 'https://riddlerealm.app/';
  }

  function challengeLink(payload) {
    const token = encode(payload);
    return getBaseUrl() + '#challenge=' + token;
  }

  function challengeText(payload) {
    const mode = payload.mode || 'classic';
    return (
      'Can you beat my score of ' +
      payload.score +
      ' in Riddle Realm (' +
      mode +
      ')? 🧠\n' +
      challengeLink(payload)
    );
  }

  /**
   * Daily result text — no answer, no private ids.
   */
  function buildDailyResultText(opts) {
    opts = opts || {};
    const score = opts.score != null ? opts.score : 0;
    const streak = opts.streak != null ? opts.streak : 0;
    const correct = opts.correct != null ? opts.correct : null;
    const date = opts.date || '';

    let lines = [
      'I completed today’s Daily Riddle on Riddle Realm!',
      'Score: ' + score
    ];
    if (correct != null) lines.push('Correct: ' + correct);
    if (streak > 0) lines.push('Streak: 🔥 ' + streak + (streak === 1 ? ' day' : ' days'));
    if (date) lines.push('Date: ' + date);
    lines.push('Can you solve today’s riddles? Play free:');
    lines.push(getBaseUrl());
    return lines.join('\n');
  }

  function reportShareEvent(channel, source, extra) {
    extra = extra || {};
    if (typeof Analytics !== 'undefined') {
      Analytics.track('share_initiated', {
        channel: channel,
        source: source
      });
    }
    if (typeof API === 'undefined') return;
    const gk =
      typeof Storage !== 'undefined' && Storage.getGuestKey ? Storage.getGuestKey() : null;
    const body = {
      guestKey: gk,
      channel: channel,
      source: source || 'daily_result',
      dateKey: extra.dateKey || null,
      score: extra.score != null ? extra.score : null,
      streak: extra.streak != null ? extra.streak : null
    };
    API.request('/api/share/event', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(gk ? { 'X-Guest-Key': gk } : {})
      },
      body: JSON.stringify(body)
    }).catch(function () {});
  }

  async function shareChallenge(session) {
    const payload = buildChallenge(session);
    const text = challengeText(payload);
    const url = challengeLink(payload);

    reportShareEvent(
      typeof navigator !== 'undefined' && navigator.share ? 'native' : 'copy',
      'challenge',
      { score: payload.score }
    );

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'Riddle Realm Challenge',
          text: 'Can you beat my score of ' + payload.score + '?',
          url: url
        });
        return { ok: true, method: 'webshare', payload: payload, url: url, status: 'initiated' };
      } catch (e) {
        if (e && e.name === 'AbortError') return { ok: false, reason: 'cancelled' };
      }
    }

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return {
          ok: true,
          method: 'clipboard',
          payload: payload,
          url: url,
          text: text,
          status: 'initiated'
        };
      }
    } catch (e) {
      /* ignore */
    }

    return {
      ok: true,
      method: 'manual',
      payload: payload,
      url: url,
      text: text,
      status: 'initiated'
    };
  }

  /**
   * Share daily result: native / WhatsApp / copy.
   * opts: { score, streak, correct, date, channel?: 'native'|'whatsapp'|'copy' }
   */
  async function shareDailyResult(opts) {
    opts = opts || {};
    const text = buildDailyResultText(opts);
    const preferred = opts.channel || null;

    if (preferred === 'whatsapp') {
      reportShareEvent('whatsapp', 'daily_result', opts);
      const wa = 'https://wa.me/?text=' + encodeURIComponent(text);
      try {
        window.open(wa, '_blank', 'noopener,noreferrer');
      } catch (e) {
        window.location.href = wa;
      }
      return { ok: true, method: 'whatsapp', text: text, status: 'initiated' };
    }

    if (preferred === 'copy' || (!preferred && !(navigator.share))) {
      reportShareEvent('copy', 'daily_result', opts);
      try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
          await navigator.clipboard.writeText(text);
          return { ok: true, method: 'clipboard', text: text, status: 'initiated' };
        }
      } catch (e) {
        /* fall through */
      }
      return { ok: true, method: 'manual', text: text, status: 'initiated' };
    }

    // Native share or generic share button
    reportShareEvent(preferred === 'native' ? 'native' : 'share_button', 'daily_result', opts);

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'Riddle Realm — Daily Riddle',
          text: text
        });
        return { ok: true, method: 'webshare', text: text, status: 'initiated' };
      } catch (e) {
        if (e && e.name === 'AbortError') return { ok: false, reason: 'cancelled' };
      }
    }

    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return { ok: true, method: 'clipboard', text: text, status: 'initiated' };
      }
    } catch (e) {
      /* ignore */
    }

    return { ok: true, method: 'manual', text: text, status: 'initiated' };
  }

  function shareText(text, channel, source) {
    source = source || 'generic';
    const preferred = channel || (navigator.share ? 'native' : 'copy');
    reportShareEvent(preferred, source, {});
    if (preferred === 'whatsapp') {
      const wa = 'https://wa.me/?text=' + encodeURIComponent(text);
      try { window.open(wa, '_blank', 'noopener,noreferrer'); } catch (e) { window.location.href = wa; }
      return Promise.resolve({ ok: true, method: 'whatsapp', status: 'initiated' });
    }
    if (preferred === 'native' && navigator.share) {
      return navigator.share({ title: 'Riddle Realm', text: text }).then(function () {
        return { ok: true, method: 'webshare', status: 'initiated' };
      }).catch(function (e) {
        if (e && e.name === 'AbortError') return { ok: false, reason: 'cancelled' };
        return copyFallback(text);
      });
    }
    return copyFallback(text);
  }

  async function copyFallback(text) {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        return { ok: true, method: 'clipboard', status: 'initiated' };
      }
    } catch (e) {}
    return { ok: true, method: 'manual', text: text, status: 'initiated' };
  }

  function readIncomingChallenge() {
    if (typeof location === 'undefined') return null;
    const hash = location.hash || '';
    const m = hash.match(/challenge=([A-Za-z0-9_-]+)/);
    if (!m) return null;
    return decode(m[1]);
  }

  return {
    buildChallenge: buildChallenge,
    encode: encode,
    decode: decode,
    challengeLink: challengeLink,
    challengeText: challengeText,
    buildDailyResultText: buildDailyResultText,
    shareChallenge: shareChallenge,
    shareDailyResult: shareDailyResult,
    shareText: shareText,
    reportShareEvent: reportShareEvent,
    readIncomingChallenge: readIncomingChallenge
  };
})();
