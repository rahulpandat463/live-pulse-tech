// gyms.js
const express = require('express');
const router = express.Router();
const statsService = require('../services/statsService');

router.get('/', async (req, res) => {
  try {
    const gyms = await statsService.getGymsWithStats();
    res.json(gyms);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id/live', async (req, res) => {
  try {
    const snapshot = await statsService.getGymLiveSnapshot(req.params.id);
    res.json(snapshot);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
