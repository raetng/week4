// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * E2E Test: User Journey for Weather Reports Application
 *
 * This test simulates a complete user workflow:
 * 1. Navigate to the application
 * 2. View existing weather reports
 * 3. Submit a new weather report
 * 4. Verify the report appears in the list
 * 5. View report details
 * 6. Delete the report
 * 7. Verify the report is removed
 */

test.describe('Weather Reports User Journey', () => {
    // Test data
    const testStation = 'TEST-STATION-E2E';
    let createdReportId;

    test.beforeEach(async ({ page }) => {
        // Navigate to the application
        await page.goto('/');
    });

    test('complete user journey - submit, view, and delete weather report', async ({ page }) => {
        // ============================================
        // STEP 1: Verify page loads correctly
        // ============================================
        await test.step('Page loads correctly', async () => {
            await expect(page).toHaveTitle(/Weather/i);
            // Check for main elements
            await expect(page.locator('form')).toBeVisible();
        });

        // ============================================
        // STEP 2: Submit a new weather report
        // ============================================
        await test.step('Submit new weather report', async () => {
            // Fill in the station name
            await page.fill('input[name="station"]', testStation);

            // Select weather conditions (rain and thunder)
            const rainCheckbox = page.locator('input[name="rain"]');
            const thunderCheckbox = page.locator('input[name="thunder"]');

            if (await rainCheckbox.isVisible()) {
                await rainCheckbox.check();
            }
            if (await thunderCheckbox.isVisible()) {
                await thunderCheckbox.check();
            }

            // Submit the form
            await page.click('button[type="submit"]');

            // Wait for submission to complete
            await page.waitForTimeout(1000);
        });

        // ============================================
        // STEP 3: Verify report appears in the list
        // ============================================
        await test.step('Verify report in list', async () => {
            // Refresh to see updated list
            await page.reload();

            // Check that our test station appears
            const reportsList = page.locator('table, .reports-list, #reports');
            await expect(reportsList).toBeVisible();

            // Verify test station is in the list
            const stationCell = page.locator(`text=${testStation}`).first();
            await expect(stationCell).toBeVisible();
        });

        // ============================================
        // STEP 4: Verify via API that report was created
        // ============================================
        await test.step('Verify report via API', async () => {
            const response = await page.request.get('/weather');
            expect(response.ok()).toBeTruthy();

            const reports = await response.json();
            const ourReport = reports.find(r => r.station === testStation);

            expect(ourReport).toBeDefined();
            expect(ourReport.rain).toBe(true);
            expect(ourReport.thunder).toBe(true);

            // Store ID for cleanup
            createdReportId = ourReport.id;
        });

        // ============================================
        // STEP 5: View individual report details via API
        // ============================================
        await test.step('View report details', async () => {
            const response = await page.request.get(`/weather/${createdReportId}`);
            expect(response.ok()).toBeTruthy();

            const report = await response.json();
            expect(report.station).toBe(testStation);
            expect(report.id).toBe(createdReportId);
        });

        // ============================================
        // STEP 6: Delete the report
        // ============================================
        await test.step('Delete weather report', async () => {
            const response = await page.request.delete(`/weather/${createdReportId}`);
            expect(response.ok()).toBeTruthy();

            const result = await response.json();
            expect(result.message).toContain('deleted');
        });

        // ============================================
        // STEP 7: Verify report is removed
        // ============================================
        await test.step('Verify report is deleted', async () => {
            // Try to fetch deleted report - should return 404
            const response = await page.request.get(`/weather/${createdReportId}`);
            expect(response.status()).toBe(404);

            // Refresh page and verify station is gone
            await page.reload();

            // The test station should no longer appear
            const response2 = await page.request.get('/weather');
            const reports = await response2.json();
            const deletedReport = reports.find(r => r.station === testStation);
            expect(deletedReport).toBeUndefined();
        });
    });

    test('view station statistics', async ({ page }) => {
        // ============================================
        // Create a report first
        // ============================================
        const statsStation = 'STATS-TEST';

        await test.step('Create test report', async () => {
            const response = await page.request.post('/weather', {
                data: {
                    station: statsStation,
                    fog: true,
                    rain: true
                }
            });
            expect(response.ok()).toBeTruthy();
        });

        // ============================================
        // Get statistics for the station
        // ============================================
        await test.step('Fetch station statistics', async () => {
            const response = await page.request.get(`/stats/${statsStation}`);
            expect(response.ok()).toBeTruthy();

            const stats = await response.json();
            expect(stats.station).toBe(statsStation);
            expect(stats.total_reports).toBeGreaterThanOrEqual(1);
            expect(stats.conditions).toBeDefined();
            expect(stats.conditions.fog).toBeGreaterThanOrEqual(1);
            expect(stats.conditions.rain).toBeGreaterThanOrEqual(1);
        });

        // ============================================
        // Cleanup
        // ============================================
        await test.step('Cleanup test data', async () => {
            const response = await page.request.get('/weather');
            const reports = await response.json();
            const testReports = reports.filter(r => r.station === statsStation);

            for (const report of testReports) {
                await page.request.delete(`/weather/${report.id}`);
            }
        });
    });

    test('handles invalid input gracefully', async ({ page }) => {
        // ============================================
        // Test submitting without station name
        // ============================================
        await test.step('Reject empty station name', async () => {
            const response = await page.request.post('/weather', {
                data: {
                    station: '',
                    rain: true
                }
            });
            expect(response.status()).toBe(400);

            const error = await response.json();
            expect(error.error).toContain('Station');
        });

        // ============================================
        // Test fetching non-existent report
        // ============================================
        await test.step('Return 404 for non-existent report', async () => {
            const response = await page.request.get('/weather/99999');
            expect(response.status()).toBe(404);
        });

        // ============================================
        // Test invalid ID format
        // ============================================
        await test.step('Handle invalid ID format', async () => {
            const response = await page.request.get('/weather/not-a-number');
            expect(response.status()).toBe(400);
        });
    });
});