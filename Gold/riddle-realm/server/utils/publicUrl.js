/**
 * Public share origin. Never invent a domain.
 * Production: set APP_PUBLIC_URL (https://your-real-domain.com).
 * Localhost is allowed only when NODE_ENV is not production.
 */
function publicBase(req) {
  const configured = String(process.env.APP_PUBLIC_URL || '').trim().replace(/\/$/, '');
  if (configured) return configured;

  const proto = (req && (req.headers['x-forwarded-proto'] || req.protocol)) || 'http';
  const host = (req && (req.headers['x-forwarded-host'] || req.headers.host)) || '';
  const fromReq = host ? proto + '://' + host : '';
  const isLocal = /localhost|127\.0\.0\.1/i.test(fromReq);
  if (process.env.NODE_ENV === 'production' && isLocal) {
    return '';
  }
  return fromReq;
}

function publicLink(req, path) {
  const base = publicBase(req);
  const p = path.charAt(0) === '/' ? path : '/' + path;
  if (!base) {
    return {
      path: p,
      url: p,
      publicUrlReady: false,
      note: 'Set APP_PUBLIC_URL for a production share link. Localhost is not used as a public URL.'
    };
  }
  return { path: p, url: base + p, publicUrlReady: true, note: null };
}

module.exports = { publicBase, publicLink };
