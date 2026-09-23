function notFound(req, res, next) {
  res.status(404).json({
    success: false,
    error: 'Not found',
    path: req.originalUrl
  });
}

function errorHandler(err, req, res, next) {
  const status = err.status || err.statusCode || 500;
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    console.error('[API Error]', err.message);
  }

  res.status(status).json({
    success: false,
    error: isProd && status === 500 ? 'Internal server error' : err.message || 'Error',
    code: err.code || undefined
  });
}

module.exports = { notFound, errorHandler };
