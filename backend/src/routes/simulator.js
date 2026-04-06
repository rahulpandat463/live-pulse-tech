// simulator.js
const express = require('express');
const router = express.Router();
const simulatorService = require('../services/simulatorService');
const db = require('../db/pool');

router.post('/start', (req, res) => {
    const speed = parseInt(req.body.speed) || 1;
    if (speed < 1 || speed > 10) {
        return res.status(400).json({ error: 'Speed must be between 1 and 10' });
    }
    const result = simulatorService.startSimulation(speed);
    res.json(result);
});

router.post('/stop', (req, res) => {
    const result = simulatorService.stopSimulation();
    res.json(result);
});

router.post('/reset', async (req, res) => {
    try {
        simulatorService.stopSimulation();
        // Clear open check-ins
        await db.query('UPDATE checkins SET checked_out = NOW() WHERE checked_out IS NULL');
        res.json({ status: 'reset' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
