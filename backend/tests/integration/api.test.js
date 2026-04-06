// api.test.js
const request = require('supertest');
const app = require('../../src/app');
const db = require('../../src/db/pool');

jest.mock('../../src/db/pool');

describe('API Integration Tests', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('GET /api/gyms returns correct structure', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: '1', name: 'WTF South Ex', current_occupancy: 10, today_revenue: 5000 }] });
        const res = await request(app).get('/api/gyms');
        expect(res.status).toBe(200);
        expect(res.body).toBeInstanceOf(Array);
        expect(res.body[0]).toHaveProperty('name');
    });

    test('GET /api/gyms/:id/live returns all required fields', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: '1', name: 'WTF South Ex' }] }); // gym
        db.query.mockResolvedValueOnce({ rows: [{ count: '10' }] }); // occupancy
        db.query.mockResolvedValueOnce({ rows: [{ sum: '5000' }] }); // revenue
        db.query.mockResolvedValueOnce({ rows: [] }); // recent events
        db.query.mockResolvedValueOnce({ rows: [] }); // anomalies
        
        const res = await request(app).get('/api/gyms/1/live');
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('current_occupancy');
        expect(res.body).toHaveProperty('today_revenue');
    });

    test('PATCH /api/anomalies/:id/dismiss returns 403 when critical', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ id: '1', severity: 'critical' }] });
        const res = await request(app).patch('/api/anomalies/1/dismiss');
        expect(res.status).toBe(403);
    });

    test('GET /api/analytics/gyms/:id returns analytics data', async () => {
        db.query.mockResolvedValueOnce({ rows: [] }); // heatmap
        db.query.mockResolvedValueOnce({ rows: [] }); // revenueByPlan
        db.query.mockResolvedValueOnce({ rows: [] }); // churnRisk
        db.query.mockResolvedValueOnce({ rows: [] }); // newVsRenewal
        
        const res = await request(app).get('/api/analytics/gyms/1');
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('heatmap');
    });

    test('GET /api/analytics/cross-gym returns ranked revenue', async () => {
        db.query.mockResolvedValueOnce({ rows: [{ gym_id: '1', gym_name: 'Test', total_revenue: 1000, rank: 1 }] });
        const res = await request(app).get('/api/analytics/cross-gym');
        expect(res.status).toBe(200);
        expect(res.body[0]).toHaveProperty('rank');
    });

    test('POST /api/simulator/stop pauses the engine', async () => {
        const res = await request(app).post('/api/simulator/stop');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('paused');
    });

    test('POST /api/simulator/reset clears live data', async () => {
        db.query.mockResolvedValueOnce({}); // checkins update
        const res = await request(app).post('/api/simulator/reset');
        expect(res.status).toBe(200);
        expect(res.body.status).toBe('reset');
    });

    test('GET /api/anomalies returns filtered anomalies', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });
        const res = await request(app).get('/api/anomalies?severity=critical');
        expect(res.status).toBe(200);
        expect(res.body).toBeInstanceOf(Array);
    });

    test('Invalid gym ID returns error in live snapshot', async () => {
        db.query.mockRejectedValueOnce(new Error('Database error'));
        const res = await request(app).get('/api/gyms/invalid/live');
        expect(res.status).toBe(500);
    });

    test('GET /api/anomalies filters by gym_id correctly', async () => {
        db.query.mockResolvedValueOnce({ rows: [] });
        const res = await request(app).get('/api/anomalies?gym_id=1');
        expect(res.status).toBe(200);
        expect(db.query).toHaveBeenCalledWith(expect.stringContaining('gym_id = $1'), ['1']);
    });

    test('POST /api/simulator/start validates speed range', async () => {
        const res = await request(app).post('/api/simulator/start').send({ speed: 50 });
        expect(res.status).toBe(400); 
    });

    test('GET /api/analytics/cross-gym returns correct data structure for all gyms', async () => {
        db.query.mockResolvedValueOnce({ rows: Array(10).fill({ gym_id: '1', gym_name: 'Test', total_revenue: 1000, rank: 1 }) });
        const res = await request(app).get('/api/analytics/cross-gym');
        expect(res.status).toBe(200);
        expect(res.body.length).toBe(10);
    });
});
