// analytics.js
const express = require('express');
const router = express.Router();
const statsService = require('../services/statsService');

router.get('/gyms/:id', async (req, res) => {
  try {
    const days = req.query.dateRange === '90d' ? 90 : req.query.dateRange === '7d' ? 7 : 30;
    const analytics = await statsService.getGymAnalytics(req.params.id, days);
    res.json(analytics);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/cross-gym', async (req, res) => {
    try {
        const result = await statsService.getCrossGymRevenue();
        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
