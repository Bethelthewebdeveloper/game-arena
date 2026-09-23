/**
 * Riddle Realm API — Phase 27 competitive layer (Battle + Challenge + live founder)
 * Node + Express + MongoDB (Riddles-Game)
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const { connectDatabase, getConnectionState } = require('./config/database');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const healthRoutes = require('./routes/health');
const riddleRoutes = require('./routes/riddles');
const authRoutes = require('./routes/auth');
const founderRoutes = require('./routes/founder');
const founderAuthRoutes = require('./routes/founderAuth');
const aiRoutes = require('./routes/ai');
const multiplayerRoutes = require('./routes/multiplayer');
const dailyRoutes = require('./routes/daily');
const shareRoutes = require('./routes/share');
const battleRoutes = require('./routes/battles');
const challengeRoutes = require('./routes/challenges');
const arenaRoutes = require('./routes/arena');
const battleStore = require('./services/battleStore');

const PORT = parseInt(process.env.PORT, 10) || 8080;
const HOST = process.env.HOST || '0.0.0.0';
const app = express();

// CSP off for inline game scripts; frameguard off so local preview iframes work.
app.use(
  helmet({
    contentSecurityPolicy: false,
    frameguard: false
  })
);

const isProd = process.env.NODE_ENV === 'production';
const corsOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: isProd
      ? corsOrigins.length
        ? corsOrigins
        : false
      : function (origin, cb) {
          if (!origin) return cb(null, true);
          if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) {
            return cb(null, true);
          }
          if (corsOrigins.includes(origin)) return cb(null, true);
          return cb(null, true);
        },
    credentials: true
  })
);
app.use(express.json({ limit: '100kb' }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

app.use(
  '/api/',
  rateLimit({
    windowMs: 60 * 1000,
    max: 180,
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'Too many requests' }
  })
);

function publicOrigin(req) {
  if (process.env.APP_PUBLIC_URL) return String(process.env.APP_PUBLIC_URL).replace(/\/$/, '');
  const proto = req.headers['x-forwarded-proto'] || req.protocol || 'http';
  const host = req.headers['x-forwarded-host'] || req.headers.host || '127.0.0.1:8080';
  return proto + '://' + host;
}

function isShareBot(req) {
  return /facebookexternalhit|Facebot|Twitterbot|Slackbot|WhatsApp|LinkedInBot|TelegramBot|Discordbot|Pinterest/i.test(
    String(req.headers['user-agent'] || '')
  );
}

function sendSharePreview(req, res, opts) {
  const origin = publicOrigin(req);
  const url = origin + opts.path;
  const title = opts.title;
  const desc = opts.description;
  res.type('html').send(
    '<!doctype html><html><head><meta charset="utf-8">' +
      '<title>' + title + '</title>' +
      '<meta property="og:type" content="website">' +
      '<meta property="og:title" content="' + title + '">' +
      '<meta property="og:description" content="' + desc + '">' +
      '<meta property="og:url" content="' + url + '">' +
      '<meta property="og:image" content="' + origin + '/icons/icon-512.png">' +
      '<meta name="twitter:card" content="summary_large_image">' +
      '<meta name="twitter:title" content="' + title + '">' +
      '<meta name="twitter:description" content="' + desc + '">' +
      '<link rel="canonical" href="' + url + '">' +
      '</head><body><p>' + desc + '</p><p><a href="' + url + '">Open Riddle Realm</a></p></body></html>'
  );
}

const rootDir = path.join(__dirname, '..');
app.get('/', (req, res) => {
  res.sendFile(path.join(rootDir, 'landing.html'));
});
app.get('/play', (req, res) => {
  res.sendFile(path.join(rootDir, 'index.html'));
});
app.use(express.static(rootDir));

app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'Riddle Realm API',
    phase: '27',
    endpoints: {
      health: 'GET /api/health',
      riddles: 'GET /api/riddles',
      dailyToday: 'GET /api/daily/today',
      multiplayerStatus: 'GET /api/multiplayer/status',
      createRoom: 'POST /api/multiplayer/rooms',
      joinRoom: 'POST /api/multiplayer/rooms/join',
      founderVerify: 'POST /api/founder/verify',
      founderOverview: 'GET /api/founder/overview (founder only)',
      founderMultiplayer: 'GET /api/founder/multiplayer (founder only)',
      aiStatus: 'GET /api/ai/status'
    }
  });
});

app.use('/api/health', healthRoutes);
app.use('/api/riddles', riddleRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/founder', founderAuthRoutes);
app.use('/api/founder', founderRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/multiplayer', multiplayerRoutes);
app.use('/api/daily', dailyRoutes);
app.use('/api/share', shareRoutes);
app.use('/api/battles', battleRoutes);
app.use('/api/challenges', challengeRoutes);
app.use('/api/arena', arenaRoutes);

app.get('/multiplayer/:code', (req, res) => {
  if (isShareBot(req)) {
    return sendSharePreview(req, res, {
      path: '/multiplayer/' + encodeURIComponent(req.params.code),
      title: 'I created a Riddle Game',
      description: 'Think you can beat me? Join my private room ' + String(req.params.code).toUpperCase() + '.'
    });
  }
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

app.get('/battle/:code', (req, res) => {
  if (isShareBot(req)) {
    return sendSharePreview(req, res, {
      path: '/battle/' + encodeURIComponent(req.params.code),
      title: 'Riddle Battle is live',
      description: 'Can you reach #1? Join the competition.'
    });
  }
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

app.get('/challenge/:code', (req, res) => {
  if (isShareBot(req)) {
    return sendSharePreview(req, res, {
      path: '/challenge/' + encodeURIComponent(req.params.code),
      title: 'Riddle Challenge',
      description: 'I posted a score. Can you beat me?'
    });
  }
  res.sendFile(path.join(__dirname, '..', 'index.html'));
});

/* Battles are created by players. Do not seed fake Weekend/Daily battles. */

app.use(notFound);
app.use(errorHandler);

async function start() {
  console.log('[boot] start()');
  try {
    await connectDatabase();
    console.log('[boot] db connected');
  } catch (err) {
    console.error('MongoDB connection failed:', err.message);
    if (err.code === 'MISSING_URI') {
      console.error('→ Rooms will use in-memory storage until MONGODB_URI is set.');
    }
    if (process.env.REQUIRE_DB === 'true') {
      process.exit(1);
    }
    console.warn('Server starting WITHOUT database (multiplayer uses memory; other data routes may 503).');
  }

  console.log('[boot] listening', HOST, PORT);
  app.listen(PORT, HOST, () => {
    const db = getConnectionState();
    console.log(`API listening on http://${HOST}:${PORT}`);
    console.log(`Health: http://127.0.0.1:${PORT}/api/health`);
    console.log(`Founder: http://127.0.0.1:${PORT}/founder.html`);
    console.log(`DB state: ${db.state} (${db.dbName})`);
    if (process.env.FOUNDER_ACCESS_KEY && String(process.env.FOUNDER_ACCESS_KEY).trim()) {
      console.log('[boot] FOUNDER_ACCESS_KEY: configured');
    } else {
      console.warn('[boot] FOUNDER_ACCESS_KEY: MISSING — /api/founder/verify will return 503 until you set it in .env and restart');
    }
  });
}

if (require.main === module) {
  start();
}

module.exports = app;
