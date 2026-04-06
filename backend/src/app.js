// app.js
const express = require('express');
const http = require('http');
const cors = require('cors');
const dotenv = require('dotenv');
const { initWebSocket } = require('./websocket/server');
const gymRoutes = require('./routes/gyms');
const anomalyRoutes = require('./routes/anomalies');
const analyticsRoutes = require('./routes/analytics');
const simulatorRoutes = require('./routes/simulator');
const { detectAnomalies } = require('./services/anomalyService');
const { startSimulation } = require('./services/simulatorService');

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

// Routes
app.use('/api/gyms', gymRoutes);
app.use('/api/anomalies', anomalyRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/simulator', simulatorRoutes);

// Health check
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Only start the server process if not running under Jest
if (process.env.NODE_ENV !== 'test') {
  const server = http.createServer(app);

  // Initialize WebSocket
  initWebSocket(server);

  // Anomaly Detection Job every 30 seconds
  setInterval(async () => {
    try {
      await detectAnomalies();
      console.log('Anomaly detection job ran');
    } catch (err) {
      console.error('Anomaly detection error:', err);
    }
  }, 30000);

  // Start Simulator by default
  startSimulation(1);

  const PORT = process.env.PORT || 3001;
  server.listen(PORT, () => {
    console.log(`WTF LivePulse backend running on port ${PORT}`);
  });
}

module.exports = app;
