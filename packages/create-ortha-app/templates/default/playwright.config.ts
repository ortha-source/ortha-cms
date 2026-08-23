import { defineConfig, devices } from '@playwright/test';

/**
 * Admin end-to-end tests — the UI in a browser, against a **mocked** API.
 *
 * `webServer` runs the Vite dev server only. Specs intercept `/api` at the
 * network layer (`e2e/admin/support/seed.ts`), so a run needs no backend, no
 * database and no migration: it is fast, hermetic, and when it fails it is the
 * UI that is wrong. API behaviour is covered by `e2e/server`, where a failure
 * names the endpoint instead of blaming a page.
 */
const adminPort = Number(process.env['ADMIN_PORT']) || 4200;

export default defineConfig({
    testDir: './e2e/admin',
    fullyParallel: true,
    // A `.only` left in a file passes locally and silently stops running every
    // other test in CI.
    forbidOnly: !!process.env['CI'],
    retries: process.env['CI'] ? 2 : 0,
    reporter: process.env['CI'] ? 'github' : 'list',
    use: {
        baseURL: process.env['BASE_URL'] || `http://localhost:${adminPort}`,
        // Retained on every failure rather than on a retry: outside CI there
        // are no retries, so `on-first-retry` collects a trace exactly never —
        // and a local run is the only post-mortem anyone gets.
        trace: 'retain-on-failure'
    },
    projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
    webServer: {
        command: `npx vite --port ${adminPort} --strictPort`,
        url: `http://localhost:${adminPort}`,
        reuseExistingServer: !process.env['CI'],
        timeout: 120_000
    }
});
