/**
 * Lightweight request guards (foundation for Phase 21+).
 */
function requireJson(req, res, next) {
  if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
    if (req.headers['content-type'] && !req.headers['content-type'].includes('application/json')) {
      return res.status(415).json({ success: false, error: 'Content-Type must be application/json' });
    }
  }
  next();
}

/** Placeholder — real auth in Phase 21 */
function authRequiredPlaceholder(req, res, next) {
  res.status(501).json({
    success: false,
    error: 'Authentication not implemented yet (Phase 21)',
    code: 'AUTH_PENDING'
  });
}

module.exports = { requireJson, authRequiredPlaceholder };
