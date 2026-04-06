// statsService.js
const db = require('../db/pool');

const getGymsWithStats = async () => {
  const query = `
    SELECT 
      g.*,
      COALESCE(c.occupancy, 0) as current_occupancy,
      COALESCE(p.today_revenue, 0) as today_revenue
    FROM gyms g
    LEFT JOIN (
      SELECT gym_id, COUNT(*) as occupancy 
      FROM checkins 
      WHERE checked_out IS NULL 
      GROUP BY gym_id
    ) c ON g.id = c.gym_id
    LEFT JOIN (
      SELECT gym_id, SUM(amount) as today_revenue 
      FROM payments 
      WHERE paid_at >= CURRENT_DATE 
      GROUP BY gym_id
    ) p ON g.id = p.gym_id
    ORDER BY g.name ASC
  `;
  const { rows } = await db.query(query);
  return rows;
};

const getGymLiveSnapshot = async (gymId) => {
  const [gym, occupancy, revenue, recentEvents, activeAnomalies] = await Promise.all([
    db.query('SELECT * FROM gyms WHERE id = $1', [gymId]),
    db.query('SELECT COUNT(*) FROM checkins WHERE gym_id = $1 AND checked_out IS NULL', [gymId]),
    db.query('SELECT SUM(amount) FROM payments WHERE gym_id = $1 AND paid_at >= CURRENT_DATE', [gymId]),
    db.query(`
      (SELECT 'checkin' as event_type, m.name as member_name, c.checked_in as timestamp
       FROM checkins c JOIN members m ON c.member_id = m.id WHERE c.gym_id = $1 ORDER BY c.checked_in DESC LIMIT 10)
      UNION ALL
      (SELECT 'payment' as event_type, m.name as member_name, p.paid_at as timestamp
       FROM payments p JOIN members m ON p.member_id = m.id WHERE p.gym_id = $1 ORDER BY p.paid_at DESC LIMIT 10)
      ORDER BY timestamp DESC LIMIT 20
    `, [gymId]),
    db.query('SELECT * FROM anomalies WHERE gym_id = $1 AND resolved = FALSE ORDER BY detected_at DESC', [gymId])
  ]);

  return {
    ...gym.rows[0],
    current_occupancy: parseInt(occupancy.rows[0].count),
    today_revenue: parseFloat(revenue.rows[0].sum || 0),
    recent_events: recentEvents.rows,
    active_anomalies: activeAnomalies.rows
  };
};

const getGymAnalytics = async (gymId, days = 30) => {
  const [heatmap, revenueByPlan, churnRisk, newVsRenewal] = await Promise.all([
    db.query('SELECT day_of_week, hour_of_day, checkin_count FROM gym_hourly_stats WHERE gym_id = $1', [gymId]),
    db.query(`
      SELECT plan_type, SUM(amount) as total 
      FROM payments 
      WHERE gym_id = $1 AND paid_at >= NOW() - INTERVAL '1 day' * $2
      GROUP BY plan_type
    `, [gymId, days]),
    db.query(`
      SELECT id, name, last_checkin_at 
      FROM members 
      WHERE gym_id = $1 AND status = 'active' AND last_checkin_at < NOW() - INTERVAL '45 days'
      ORDER BY last_checkin_at ASC
    `, [gymId]),
    db.query(`
      SELECT member_type, COUNT(*) as count 
      FROM members 
      WHERE gym_id = $1 AND joined_at >= NOW() - INTERVAL '1 day' * $2
      GROUP BY member_type
    `, [gymId, days])
  ]);

  return {
    heatmap: heatmap.rows,
    revenue_by_plan: revenueByPlan.rows,
    churn_risk: churnRisk.rows,
    new_vs_renewal: newVsRenewal.rows
  };
};

const getCrossGymRevenue = async () => {
    const query = `
        SELECT 
            g.id as gym_id, 
            g.name as gym_name, 
            COALESCE(SUM(p.amount), 0) as total_revenue,
            RANK() OVER (ORDER BY SUM(p.amount) DESC NULLS LAST) as rank
        FROM gyms g
        LEFT JOIN payments p ON g.id = p.gym_id AND p.paid_at >= NOW() - INTERVAL '30 days'
        GROUP BY g.id, g.name
        ORDER BY total_revenue DESC
    `;
    const { rows } = await db.query(query);
    return rows;
}

module.exports = {
  getGymsWithStats,
  getGymLiveSnapshot,
  getGymAnalytics,
  getCrossGymRevenue
};
