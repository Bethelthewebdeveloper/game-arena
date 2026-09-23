/**
 * Social share event tracking — Phase 26
 * Records share *initiations* only (not completions).
 */
const express = require('express');
const rateLimit = require('express-rate-limit');
const ShareEvent = require('../models/ShareEvent');
const dailyService = require('../services/dailyService');
const { getConnectionState } = require('../config/database');

const router = express.Router();

const limit = rateLimit({
  windowMs: 60 * 1000,
  max: 40,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: 'Too many share events', code: 'RATE_LIMIT' }
});

const CHANNELS = ['share_button', 'whatsapp', 'native', 'copy', 'other'];
const SOURCES = ['daily_result', 'challenge', 'other'];

/**
 * POST /api/share/event
 * Body: { guestKey?, channel, source?, dateKey?, score?, streak? }
 */
router.post('/event', limit, async (req, res, next) => {
  try {
    if (!getConnectionState().isConnected) {
      return res.status(503).json({
        success: false,
        error: 'Database unavailable',
        code: 'DB_UNAVAILABLE'
      });
    }

    const body = req.body || {};
    let channel = String(body.channel || '').toLowerCase();
    if (!CHANNELS.includes(channel)) channel = 'other';

    let source = String(body.source || 'daily_result').toLowerCase();
    if (!SOURCES.includes(source)) source = 'other';

    const guestKey = dailyService.normalizeGuestKey(
      body.guestKey || req.headers['x-guest-key']
    );

    const doc = await ShareEvent.create({
      guestKey: guestKey || null,
      channel,
      source,
      dateKey: body.dateKey ? String(body.dateKey).slice(0, 16) : dailyService.todayKey(),
      score: body.score != null ? Number(body.score) : null,
      streak: body.streak != null ? Number(body.streak) : null,
      status: 'initiated'
    });

    res.status(201).json({
      success: true,
      data: {
        id: doc._id,
        status: 'initiated',
        channel: doc.channel,
        source: doc.source,
        message: 'Share initiated recorded (completion cannot be confirmed by the browser)'
      }
    });
  } catch (err) {
    next(err);
  }
});

/** Aggregate for founder (internal helper used by founder routes too) */
async function getShareStats() {
  if (!getConnectionState().isConnected) {
    return { hasData: false, total: 0 };
  }

  const [total, byChannel, bySource, last7] = await Promise.all([
    ShareEvent.countDocuments({}),
    ShareEvent.aggregate([
      { $group: { _id: '$channel', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]),
    ShareEvent.aggregate([
      { $group: { _id: '$source', count: { $sum: 1 } } }
    ]),
    ShareEvent.aggregate([
      {
        $match: {
          createdAt: { $gte: new Date(Date.now() - 7 * 864e5) }
        }
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
          },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: -1 } }
    ])
  ]);

  const channelMap = {};
  byChannel.forEach((c) => {
    channelMap[c._id] = c.count;
  });

  return {
    hasData: total > 0,
    total,
    note: 'All counts are share initiations — not confirmed completions.',
    byChannel: {
      share_button: channelMap.share_button || 0,
      whatsapp: channelMap.whatsapp || 0,
      native: channelMap.native || 0,
      copy: channelMap.copy || 0,
      other: channelMap.other || 0
    },
    bySource,
    last7Days: last7
  };
}

router.getShareStats = getShareStats;

module.exports = router;
