/**
 * Riddle Realm — Frontend API client
 * Same-origin by default when the game is served by Express.
 */
const API = (function () {
  'use strict';

  const DEFAULT_BASE =
    typeof window !== 'undefined' && window.RR_API_BASE
      ? window.RR_API_BASE
      : '';

  function base() {
    return (typeof window !== 'undefined' && window.RR_API_BASE) || DEFAULT_BASE;
  }

  async function request(path, options) {
    const url = base().replace(/\/$/, '') + path;
    const opts = options || {};
    const { headers: optHeaders, ...rest } = opts;
    try {
      const res = await fetch(url, {
        ...rest,
        headers: {
          Accept: 'application/json',
          ...(optHeaders || {})
        }
      });
      const data = await res.json().catch(function () {
        return null;
      });
      if (!res.ok) {
        return {
          ok: false,
          status: res.status,
          error: (data && data.error) || res.statusText || 'Request failed',
          code: data && data.code,
          data: data
        };
      }
      return { ok: true, status: res.status, data: data };
    } catch (e) {
      return {
        ok: false,
        status: 0,
        error:
          'Network error — start the game server (npm start) and open the game from that same address (not as a local file).',
        code: 'NETWORK'
      };
    }
  }

  function health() {
    return request('/api/health');
  }

  function getRiddles(params) {
    const q = new URLSearchParams();
    if (params && params.category) q.set('category', params.category);
    if (params && params.difficulty) q.set('difficulty', params.difficulty);
    if (params && params.limit) q.set('limit', String(params.limit));
    const qs = q.toString();
    return request('/api/riddles' + (qs ? '?' + qs : ''));
  }

  function getRiddle(id) {
    return request('/api/riddles/' + encodeURIComponent(id));
  }

  return {
    base: base,
    health: health,
    getRiddles: getRiddles,
    getRiddle: getRiddle,
    request: request
  };
})();
