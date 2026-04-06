-- 002_indexes_and_views.sql

-- Churn risk: active members who haven't checked in for 45+ days
CREATE INDEX idx_members_churn_risk
  ON members (last_checkin_at)
  WHERE status = 'active';

-- Support for gym-level queries
CREATE INDEX idx_members_gym_id ON members (gym_id);

-- BRIN index for time-series checkins (optimal for large append-only tables)
CREATE INDEX idx_checkins_time_brin ON checkins USING BRIN (checked_in);

-- Composite index for live occupancy (most frequent query)
CREATE INDEX idx_checkins_live_occupancy
  ON checkins (gym_id, checked_out)
  WHERE checked_out IS NULL;

-- Member-level history
CREATE INDEX idx_checkins_member ON checkins (member_id, checked_in DESC);

-- Today's revenue composite index
CREATE INDEX idx_payments_gym_date
  ON payments (gym_id, paid_at DESC);

-- Cross-gym revenue comparison
CREATE INDEX idx_payments_date ON payments (paid_at DESC);

-- Active anomalies partial index
CREATE INDEX idx_anomalies_active ON anomalies (gym_id, detected_at DESC) WHERE resolved = FALSE;

-- Materialized View for Peak Hour Heatmap (7d)
CREATE MATERIALIZED VIEW gym_hourly_stats AS
  SELECT
    gym_id,
    EXTRACT(DOW FROM checked_in)::INTEGER  AS day_of_week,   -- 0=Sunday, 6=Saturday
    EXTRACT(HOUR FROM checked_in)::INTEGER AS hour_of_day,
    COUNT(*)                               AS checkin_count
  FROM checkins
  WHERE checked_in >= NOW() - INTERVAL '7 days'
  GROUP BY gym_id, day_of_week, hour_of_day;

CREATE UNIQUE INDEX ON gym_hourly_stats (gym_id, day_of_week, hour_of_day);
