// anomaly.test.js
const { detectAnomalies } = require('../../src/services/anomalyService');
const db = require('../../src/db/pool');

jest.mock('../../src/db/pool');

describe('Anomaly Detection Logic', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        
        // Comprehensive mock implementation with safe defaults
        db.query.mockImplementation((sql, params) => {
            const rows = [];
            
            if (sql.includes('SELECT * FROM gyms')) {
                rows.push({ id: 'gym1', name: 'WTF Test', capacity: 100, status: 'active' });
            } else if (sql.includes('SELECT COUNT(*) FROM checkins')) {
                rows.push({ count: '10' }); // Default to non-zero to skip detection
            } else if (sql.includes('SELECT SUM(amount) FROM payments')) {
                rows.push({ sum: '1000' }); // Default to healthy revenue
            } else if (sql.includes('SELECT id FROM anomalies WHERE gym_id = $1 AND type = $2 AND resolved = FALSE')) {
                // Return empty by default to allow new anomaly creation if triggered
            } else if (sql.includes('SELECT * FROM anomalies WHERE resolved = FALSE')) {
                // Return empty by default to skip auto-resolve unless overridden in tests
            } else if (sql.includes('SELECT * FROM anomalies WHERE id = $1')) {
                rows.push({ id: 'anom1', gym_id: 'gym1', type: 'zero_checkins' });
            }
            
            return Promise.resolve({ rows, rowCount: rows.length });
        });
    });

    test('Zero check-ins anomaly fires correctly in operating hours', async () => {
        db.query.mockImplementation((sql) => {
            const rows = [];
            if (sql.includes('SELECT * FROM gyms')) rows.push({ id: 'gym1', name: 'WTF Test', capacity: 100, status: 'active' });
            else if (sql.includes('INTERVAL \'2 hours\'')) rows.push({ count: '0' }); 
            else if (sql.includes('COUNT(*)')) rows.push({ count: '10' });
            else if (sql.includes('SUM(amount)')) rows.push({ sum: '1000' });
            else if (sql.includes('SELECT id FROM anomalies')) { /* empty */ }
            return Promise.resolve({ rows, rowCount: rows.length });
        });

        const RealDate = Date;
        global.Date = class extends RealDate {
            constructor() { return new RealDate('2026-04-06T10:00:00Z'); }
            getHours() { return 10; }
        };

        await detectAnomalies();

        expect(db.query).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO anomalies'),
            expect.arrayContaining(['zero_checkins'])
        );
        
        global.Date = RealDate;
    });

    test('Capacity breach anomaly fires when > 90%', async () => {
        db.query.mockImplementation((sql) => {
            const rows = [];
            if (sql.includes('SELECT * FROM gyms')) rows.push({ id: 'gym1', name: 'WTF Test', capacity: 100, status: 'active' });
            else if (sql.includes('checked_out IS NULL')) rows.push({ count: '91' });
            else if (sql.includes('COUNT(*)')) rows.push({ count: '10' });
            else if (sql.includes('SUM(amount)')) rows.push({ sum: '1000' });
            return Promise.resolve({ rows, rowCount: rows.length });
        });

        await detectAnomalies();

        expect(db.query).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO anomalies'),
            expect.arrayContaining(['capacity_breach'])
        );
    });

    test('Revenue drop anomaly fires when < 70% of last week', async () => {
        db.query.mockImplementation((sql) => {
            const rows = [];
            if (sql.includes('SELECT * FROM gyms')) rows.push({ id: 'gym1', name: 'WTF Test', capacity: 100, status: 'active' });
            else if (sql.includes('SELECT SUM(amount) FROM payments')) {
                if (sql.includes('INTERVAL')) rows.push({ sum: '1000' });
                else rows.push({ sum: '500' });
            }
            else if (sql.includes('COUNT(*)')) rows.push({ count: '100' });
            return Promise.resolve({ rows, rowCount: rows.length });
        });

        await detectAnomalies();

        expect(db.query).toHaveBeenCalledWith(
            expect.stringContaining('INSERT INTO anomalies'),
            expect.arrayContaining(['revenue_drop'])
        );
    });

    test('Anomaly auto-resolves when zero-checkins condition is cleared', async () => {
        db.query.mockImplementation((sql) => {
            const rows = [];
            if (sql.includes('SELECT * FROM gyms')) rows.push({ id: 'gym1', status: 'active', capacity: 100 });
            else if (sql.includes('SELECT * FROM anomalies WHERE resolved = FALSE')) rows.push({ id: 'anom1', type: 'zero_checkins', gym_id: 'gym1' });
            else if (sql.includes('INTERVAL \'5 minutes\'')) rows.push({ count: '5' });
            else if (sql.includes('SELECT * FROM anomalies WHERE id = $1')) rows.push({ id: 'anom1', gym_id: 'gym1', type: 'zero_checkins' });
            else if (sql.includes('COUNT(*)')) rows.push({ count: '10' });
            else if (sql.includes('SUM(amount)')) rows.push({ sum: '1000' });
            return Promise.resolve({ rows, rowCount: rows.length });
        });

        await detectAnomalies();

        expect(db.query).toHaveBeenCalledWith(
            expect.stringContaining('UPDATE anomalies SET resolved = TRUE'),
            expect.anything()
        );
    });

    test('Capacity breach resolves when occupancy < 85%', async () => {
        db.query.mockImplementation((sql) => {
            const rows = [];
            if (sql.includes('SELECT * FROM gyms')) rows.push({ id: 'gym1', status: 'active', capacity: 100 });
            else if (sql.includes('SELECT * FROM anomalies WHERE resolved = FALSE')) rows.push({ id: 'anom1', type: 'capacity_breach', gym_id: 'gym1' });
            else if (sql.includes('checked_out IS NULL')) rows.push({ count: '84' });
            else if (sql.includes('SELECT * FROM anomalies WHERE id = $1')) rows.push({ id: 'anom1', gym_id: 'gym1', type: 'capacity_breach' });
            else if (sql.includes('COUNT(*)')) rows.push({ count: '10' });
            else if (sql.includes('SUM(amount)')) rows.push({ sum: '1000' });
            return Promise.resolve({ rows, rowCount: rows.length });
        });

        await detectAnomalies();

        expect(db.query).toHaveBeenCalledWith(
            expect.stringContaining('UPDATE anomalies SET resolved = TRUE'),
            expect.anything()
        );
    });

    test('Revenue drop resolves when revenue recovers to within 20%', async () => {
        db.query.mockImplementation((sql) => {
            const rows = [];
            if (sql.includes('SELECT * FROM gyms')) rows.push({ id: 'gym1', status: 'active', capacity: 100 });
            else if (sql.includes('SELECT * FROM anomalies WHERE resolved = FALSE')) rows.push({ id: 'anom1', type: 'revenue_drop', gym_id: 'gym1' });
            else if (sql.includes('SELECT SUM(amount) FROM payments')) {
                if (sql.includes('INTERVAL')) rows.push({ sum: '1000' });
                else rows.push({ sum: '800' });
            }
            else if (sql.includes('SELECT * FROM anomalies WHERE id = $1')) rows.push({ id: 'anom1', gym_id: 'gym1', type: 'revenue_drop' });
            else if (sql.includes('COUNT(*)')) rows.push({ count: '10' });
            return Promise.resolve({ rows, rowCount: rows.length });
        });

        await detectAnomalies();

        expect(db.query).toHaveBeenCalledWith(
            expect.stringContaining('UPDATE anomalies SET resolved = TRUE'),
            expect.anything()
        );
    });

    test('archiveOldAnomalies deletes records older than 24h', async () => {
        const { archiveOldAnomalies } = require('../../src/services/anomalyService');
        await archiveOldAnomalies();
        expect(db.query).toHaveBeenCalledWith(
            expect.stringContaining('DELETE FROM anomalies')
        );
    });
});
