// anomalyService.js
const db = require('../db/pool');
const { broadcast } = require('../websocket/server');

const detectAnomalies = async () => {
  const gyms = await db.query('SELECT * FROM gyms WHERE status = \'active\'');
  const anomaliesDetected = [];

  for (const gym of gyms.rows) {
    // 1. Zero Check-ins (6am-10pm, last 2 hours)
    const now = new Date();
    const hour = now.getHours();
    if (hour >= 6 && hour <= 22) {
      const { rows: lastCheckins } = await db.query(`
        SELECT COUNT(*) 
        FROM checkins 
        WHERE gym_id = $1 AND checked_in >= NOW() - INTERVAL '2 hours'
      `, [gym.id]);

      if (parseInt(lastCheckins[0].count) === 0) {
        anomaliesDetected.push({
          gym_id: gym.id,
          type: 'zero_checkins',
          severity: 'warning',
          message: `Zero check-ins recorded in the last 2 hours for ${gym.name}.`
        });
      }
    }

    // 2. Capacity Breach (> 90%)
    const { rows: occupancy } = await db.query(`
      SELECT COUNT(*) 
      FROM checkins 
      WHERE gym_id = $1 AND checked_out IS NULL
    `, [gym.id]);

    const currentOccupancy = parseInt(occupancy[0].count);
    if (currentOccupancy > gym.capacity * 0.9) {
      anomaliesDetected.push({
        gym_id: gym.id,
        type: 'capacity_breach',
        severity: 'critical',
        message: `Capacity breach: ${currentOccupancy} members present in ${gym.name} (limit ${gym.capacity}).`
      });
    }

    // 3. Revenue Drop (> 30% vs last week same day)
    const { rows: todayRev } = await db.query(`
      SELECT SUM(amount) FROM payments 
      WHERE gym_id = $1 AND paid_at >= CURRENT_DATE
    `, [gym.id]);

    const { rows: lastWeekRev } = await db.query(`
      SELECT SUM(amount) FROM payments 
      WHERE gym_id = $1 
      AND paid_at >= CURRENT_DATE - INTERVAL '7 days' 
      AND paid_at < CURRENT_DATE - INTERVAL '6 days'
    `, [gym.id]);

    const today = parseFloat(todayRev[0].sum || 0);
    const lastWeek = parseFloat(lastWeekRev[0].sum || 0);

    if (lastWeek > 0 && today < lastWeek * 0.7) {
      anomaliesDetected.push({
        gym_id: gym.id,
        type: 'revenue_drop',
        severity: 'warning',
        message: `Revenue drop: Today's revenue (${today}) is over 30% lower than last week (${lastWeek}).`
      });
    }
  }

  // Persist anomalies
  for (const anomaly of anomaliesDetected) {
    const { rows: existing } = await db.query(`
      SELECT id FROM anomalies 
      WHERE gym_id = $1 AND type = $2 AND resolved = FALSE
    `, [anomaly.gym_id, anomaly.type]);

    if (existing.length === 0) {
      await db.query(`
        INSERT INTO anomalies (gym_id, type, severity, message)
        VALUES ($1, $2, $3, $4)
      `, [anomaly.gym_id, anomaly.type, anomaly.severity, anomaly.message]);
      
      broadcast({
        type: 'ANOMALY_DETECTED',
        anomaly_id: anomaly.gym_id,
        gym_id: anomaly.gym_id,
        gym_name: gyms.rows.find(g => g.id === anomaly.gym_id)?.name,
        anomaly_type: anomaly.type,
        severity: anomaly.severity,
        message: anomaly.message
      });
    }
  }

  // Auto-resolve anomalies
  const { rows: activeAnomalies } = await db.query('SELECT * FROM anomalies WHERE resolved = FALSE');
  
  for (const anomaly of activeAnomalies) {
    if (anomaly.type === 'zero_checkins') {
      const { rows: recentCheckins } = await db.query(
        'SELECT COUNT(*) FROM checkins WHERE gym_id = $1 AND checked_in >= NOW() - INTERVAL \'5 minutes\'',
        [anomaly.gym_id]
      );
      if (parseInt(recentCheckins[0].count) > 0) {
        await resolveAnomaly(anomaly.id);
      }
    } else if (anomaly.type === 'capacity_breach') {
      const g = gyms.rows.find(gym => gym.id === anomaly.gym_id);
      if (g) {
        const { rows: occupancy } = await db.query(
          'SELECT COUNT(*) FROM checkins WHERE gym_id = $1 AND checked_out IS NULL',
          [g.id]
        );
        if (parseInt(occupancy[0].count) < g.capacity * 0.85) {
          await resolveAnomaly(anomaly.id);
        }
      }
    } else if (anomaly.type === 'revenue_drop') {
      // For revenue drop, we check if today's revenue has recovered to within 20% of last week
      const g = gyms.rows.find(gym => gym.id === anomaly.gym_id);
      if (g) {
        const { rows: todayRev } = await db.query('SELECT SUM(amount) FROM payments WHERE gym_id = $1 AND paid_at >= CURRENT_DATE', [g.id]);
        const { rows: lastWeekRev } = await db.query(`
          SELECT SUM(amount) FROM payments 
          WHERE gym_id = $1 
          AND paid_at >= CURRENT_DATE - INTERVAL '7 days' 
          AND paid_at < CURRENT_DATE - INTERVAL '6 days'
        `, [g.id]);
        
        const today = parseFloat(todayRev[0].sum || 0);
        const lastWeek = parseFloat(lastWeekRev[0].sum || 0);
        
        if (lastWeek > 0 && today >= lastWeek * 0.8) {
          await resolveAnomaly(anomaly.id);
        }
      }
    }
  }

  // 4. Archive old resolved anomalies (3.3)
  await archiveOldAnomalies();
};

const resolveAnomaly = async (id) => {
  const { rows } = await db.query('SELECT * FROM anomalies WHERE id = $1', [id]);
  await db.query('UPDATE anomalies SET resolved = TRUE, resolved_at = NOW() WHERE id = $1', [id]);
  if (rows[0]) {
    broadcast({
      type: 'ANOMALY_RESOLVED',
      anomaly_id: id,
      gym_id: rows[0].gym_id,
      resolved_at: new Date()
    });
  }
};

const dismissAnomaly = async (id) => {
  const { rows } = await db.query('SELECT severity FROM anomalies WHERE id = $1', [id]);
  if (rows[0] && rows[0].severity === 'critical') {
    throw new Error('Critical anomalies cannot be dismissed');
  }
  await db.query('UPDATE anomalies SET dismissed = TRUE WHERE id = $1', [id]);
};

const archiveOldAnomalies = async () => {
  // Requirement 3.3: Resolved anomalies must remain visible for 24 hours, then auto-archived
  // We'll delete resolved ones older than 24h
  await db.query(`
    DELETE FROM anomalies 
    WHERE resolved = TRUE 
    AND resolved_at < NOW() - INTERVAL '24 hours'
  `);
};

module.exports = {
  detectAnomalies,
  resolveAnomaly,
  dismissAnomaly,
  archiveOldAnomalies
};
