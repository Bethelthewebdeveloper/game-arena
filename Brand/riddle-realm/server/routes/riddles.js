const express = require('express');
const Riddle = require('../models/Riddle');
const { getConnectionState } = require('../config/database');

const router = express.Router();

/**
 * GET /api/riddles
 * List active riddles (read-only foundation).
 * Query: category, difficulty, limit (max 100)
 */
router.get('/', async (req, res, next) => {
  try {
    if (!getConnectionState().isConnected) {
      return res.status(503).json({
        success: false,
        error: 'Database unavailable',
        code: 'DB_UNAVAILABLE'
      });
    }

    const filter = { active: true };
    if (req.query.category) filter.category = String(req.query.category);
    if (req.query.difficulty) filter.difficulty = String(req.query.difficulty);

    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 50));

    const riddles = await Riddle.find(filter)
      .select('-__v')
      .limit(limit)
      .lean();

    res.json({
      success: true,
      count: riddles.length,
      data: riddles
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/riddles/:id
 */
router.get('/:id', async (req, res, next) => {
  try {
    if (!getConnectionState().isConnected) {
      return res.status(503).json({
        success: false,
        error: 'Database unavailable',
        code: 'DB_UNAVAILABLE'
      });
    }

    const riddle = await Riddle.findById(req.params.id).select('-__v').lean();
    if (!riddle) {
      return res.status(404).json({ success: false, error: 'Riddle not found' });
    }
    res.json({ success: true, data: riddle });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
