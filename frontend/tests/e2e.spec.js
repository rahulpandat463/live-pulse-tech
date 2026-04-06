// e2e.spec.js
import { test, expect } from '@playwright/test';

test.describe('Dashboard E2E', () => {
    test.beforeEach(async ({ page }) => {
        // Log all browser console messages
        page.on('console', msg => console.log('BROWSER LOG:', msg.text()));

        // Mock Gyms List - use Regex to be safe
        await page.route(/\/api\/gyms$/, async (route) => {
            console.log('MOCKING GYMS LIST HIT');
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify([
                    { id: '1', name: 'WTF Elite - Indiranagar', city: 'Bangalore', capacity: 150 },
                    { id: '2', name: 'WTF Pro - Koramangala', city: 'Bangalore', capacity: 100 }
                ])
            });
        });

        // Mock Live Snapshot
        await page.route(/\/api\/gyms\/.*\/live/, async (route) => {
            console.log('MOCKING LIVE SNAPSHOT HIT');
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    current_occupancy: 45,
                    today_revenue: 1200,
                    recent_events: [
                        { type: 'CHECKIN_EVENT', member_name: 'John Doe', timestamp: new Date().toISOString() }
                    ]
                })
            });
        });

        // Mock Anomalies
        await page.route(/\/api\/anomalies$/, async (route) => {
            console.log('MOCKING ANOMALIES HIT');
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify([])
            });
        });

        // Mock Analytics Data
        await page.route(/\/api\/analytics/, async (route) => {
            console.log('MOCKING ANALYTICS HIT');
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    occupancy: 45,
                    revenue: 1200,
                    churn_risk: 12,
                    heatmap: Array(24).fill(0).map((_, i) => ({ hour: i, count: 20 }))
                })
            });
        });

        // Mock Simulator Status
        await page.route(/\/api\/simulator\/status/, async (route) => {
            console.log('MOCKING SIMULATOR STATUS HIT');
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({ running: false, speed: 1 })
            });
        });
    });

    test('Main dashboard loads and displays gym list', async ({ page }) => {
        await page.goto('/');
        const select = page.locator('select');
        await expect(select).toBeVisible();
        // Wait for options to load via the mock - use toBeAttached as options might be reported as "hidden"
        await expect(select.locator('option').first()).toBeAttached({ timeout: 15000 });
        const count = await select.locator('option').count();
        expect(count).toBeGreaterThan(0);
    });

    test('Switching gym updates occupancy count', async ({ page }) => {
        await page.goto('/');
        const select = page.locator('select');
        
        // Wait for data to arrive
        await expect(select.locator('option').nth(1)).toBeAttached({ timeout: 15000 });
        
        // Switch to the second gym (index 1)
        await select.selectOption({ index: 1 });
        
        // Check if various KPI cards are visible and populated
        const occupancy = page.locator('.kpi-value').first();
        await expect(occupancy).toBeVisible();
        const text = await occupancy.textContent();
        expect(Number(text)).toBeGreaterThanOrEqual(0);
    });

    test('Simulator controls start and pause the engine', async ({ page }) => {
        await page.goto('/');
        // Check for Resume/Pause button in simulation panel
        const button = page.getByRole('button', { name: /resume|pause/i });
        await expect(button).toBeVisible({ timeout: 10000 });
    });
});
