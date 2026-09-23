/**
 * Privacy-safe activity log for the Founder live feed.
 * Memory ring buffer always. Mongo optional later.
 */
const { eventId } = require('../utils/ids');

const MAX = 200;
const events = [];

function record(type, message, extra) {
  extra = extra || {};
  const ev = {
    id: eventId(),
    type: String(type || 'system'),
    message: String(message || ''),
    guestKey: extra.guestKey ? String(extra.guestKey).slice(0, 16) : null,
    ref: extra.ref || null,
    at: new Date().toISOString()
  };
  events.unshift(ev);
  if (events.length > MAX) events.pop();
  return ev;
}

function recent(limit) {
  const n = Math.min(80, Math.max(1, parseInt(limit, 10) || 30));
  return events.slice(0, n);
}

function countsToday() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const t0 = start.getTime();
  const today = events.filter((e) => new Date(e.at).getTime() >= t0);
  const byType = {};
  today.forEach((e) => {
    byType[e.type] = (byType[e.type] || 0) + 1;
  });
  return { total: today.length, byType };
}

module.exports = { record, recent, countsToday };
