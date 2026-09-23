const express = require('express');
const { getConnectionState } = require('../config/database');

const router = express.Router();

router.get('/', (req, res) => {
  const db = getConnectionState();
  res.json({
    success: true,
    service: 'riddle-realm-api',
    version: '1.0.0-phase20',
    time: new Date().toISOString(),
    database: {
      name: db.dbName,
      state: db.state,
      connected: db.isConnected
    }
  });
});

module.exports = router;
