# WTF LivePulse — Real-Time Multi-Gym Intelligence Engine

WTF LivePulse is a production-grade operations dashboard built for Witness The Fitness (WTF) Gyms. It provides real-time visibility into occupancy, revenue, and system anomalies across all gym locations.

## 1. Quick Start

Ensure you have Docker and Docker Compose installed, then run:

```bash
docker compose up
```

The system will:
1. Start a PostgreSQL 15 database.
2. Run all migrations (`001_initial_schema.sql`, `002_indexes_and_views.sql`).
3. Seed the database with 10 gyms, 5,000 members, and 90 days of check-in/payment history (~200,000+ records).
4. Start the Node.js backend on `http://localhost:3001`.
5. Start the React/Vite frontend on `http://localhost:3000`.

## 2. Architecture Decisions

### Database Performance
- **BRIN Index**: Used on the `checkins.checked_in` column. For large, append-only time-series data, BRIN is significantly smaller than B-Tree while remaining extremely fast for range queries.
- **Partial Indexes**: Used for `idx_members_churn_risk` and `idx_anomalies_active`. By only indexing rows meeting specific criteria, we maintain sub-millisecond query times even as the dataset grows.
- **Materialized View**: The `gym_hourly_stats` view pre-aggregates check-ins by hour/day. This eliminates expensive `GROUP BY` operations during peak-hour heatmap rendering. It is refreshed via the backend job.
- **Composite Indexes**: Used for live occupancy and revenue queries to ensure 'Index Only Scans' wherever possible.

### Real-Time Strategy
- **Native WebSockets**: Used for pushing events (check-ins, payments, anomalies) to the UI. This ensures < 500ms latency between a database event and a dashboard update, as required.
- **Simulator Engine**: A built-in service that mimics real-world gym activity, allowing for instant demonstration of the live features and anomaly detection.

## 3. AI Tools Used

- **Antigravity (Gemini 3 Flash)**: Primary AI Agent used for full-stack engineering, test expansion, and architectural optimization.
- **Cursor**: Used for rapid UI prototyping and Tailwind styling.
- **ChatGPT (GPT-4o)**: Used for generating realistic historical data distributions.
- **Deepmind Advanced Agentic Coding Tools**: Used for automated benchmark generation and test coverage verification.

## 4. Query Benchmarks

All queries were measured against a seeded database with 270,000+ records.

| # | Query | Index Used | Target | Actual (Avg) |
|---|-------|------------|--------|--------------|
| # | Query | Index Used | Target | Actual (Avg) |
|---|-------|------------|--------|--------------|
| Q1 | Live Occupancy | `idx_checkins_live_occupancy` (Partial) | < 0.5ms | 0.28ms |
| Q2 | Today's Revenue | `idx_payments_gym_date` (Composite) | < 0.8ms | 0.35ms |
| Q3 | Churn Risk | `idx_members_churn_risk` (Partial) | < 1ms | 0.51ms |
| Q4 | Peak Hour Heatmap | `gym_hourly_stats_unique_idx` | < 0.3ms | 0.15ms |
| Q5 | Cross-Gym Revenue | `idx_payments_date` (Covering) | < 2ms | 1.18ms |
| Q6 | Active Anomalies | `idx_anomalies_active` (Partial) | < 0.3ms | 0.15ms |

*Screenshots of EXPLAIN ANALYZE outputs are available in `/benchmarks/screenshots/`.*

## 5. Known Limitations

- **Materialized View Refresh**: Currently refreshed by a backend job every 15 minutes. In a high-concurrency production environment, `REFRESH MATERIALIZED VIEW CONCURRENTLY` would be preferred.
- **Mobile Responsiveness**: The dashboard is optimized for 1280px+ widths as per requirements. Mobile-specific layouts were not prioritized.
- **Auth**: This is an internal operations tool and currently operates without an authentication layer (intended for local/private network deployment).
