// anomalies.js
const express = require('express');
const router = express.Router();
const db = require('../db/pool');
const { dismissAnomaly } = require('../services/anomalyService');

router.get('/', async (req, res) => {
  try {
    const { gym_id, severity } = req.query;
    let query = `
      SELECT a.*, g.name as gym_name 
      FROM anomalies a 
      JOIN gyms g ON a.gym_id = g.id 
      WHERE a.resolved = FALSE
    `;
    let params = [];

    if (gym_id) {
      params.push(gym_id);
      query += ` AND a.gym_id = $${params.length}`;
    }

    if (severity) {
      params.push(severity);
      query += ` AND a.severity = $${params.length}`;
    }

    query += ' ORDER BY a.detected_at DESC';

    const { rows } = await db.query(query, params);
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id/dismiss', async (req, res) => {
  try {
    await dismissAnomaly(req.params.id);
    res.json({ status: 'dismissed' });
  } catch (err) {
    if (err.message.includes('Critical')) {
      return res.status(403).json({ error: err.message });
    }
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
