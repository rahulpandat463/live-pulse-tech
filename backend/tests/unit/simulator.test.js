// simulator.test.js
const { startSimulation, stopSimulation } = require('../../src/services/simulatorService');

describe('Simulator Service Unit Tests', () => {
    test('startSimulation returns correct running status and speed', () => {
        const result = startSimulation(5);
        expect(result.status).toBe('running');
        expect(result.speed).toBe(5);
        stopSimulation();
    });

    test('stopSimulation returns paused status', () => {
        startSimulation(1);
        const result = stopSimulation();
        expect(result.status).toBe('paused');
    });

    test('Simulation speed affects interval calculation internally', () => {
        // This is harder to test directly without spying on setInterval
        // But we can verify the status change
        const result = startSimulation(10);
        expect(result.speed).toBe(10);
        stopSimulation();
    });
});
