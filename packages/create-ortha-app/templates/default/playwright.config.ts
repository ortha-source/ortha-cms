import { defineConfig, devices } from '@playwright/test';

/**
 * End-to-end tests, driving the app the way it is actually deployed.
 *
 * `webServer` runs `build` then `start`, so the suite exercises the **built**
 * app on one origin — API and admin from a single process, which is what
 * `staticDir` gives you and what a dev-server-only test would never check.
 *
 * Needs a migrated database: `docker compose up -d && npm run migrate` first.
 * The tests read and write real rows, so point `DATABASE_URL` at a database you
 * are willing to lose before running this against anything you care about.
 */
export default defineConfig({
    testDir: './e2e',
    fullyParallel: true,
    // A `.only` left in a file passes locally and silently stops running every
    // other test in CI.
    forbidOnly: !!process.env['CI'],
    retries: process.env['CI'] ? 2 : 0,
    reporter: process.env['CI'] ? 'github' : 'list',
    use: {
        baseURL: `http://localhost:${process.env['PORT'] ?? 3000}`,
        trace: 'on-first-retry'
    },
    projects: [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } }
    ],
    webServer: {
        command: 'npm run build && npm start',
        url: `http://localhost:${process.env['PORT'] ?? 3000}`,
        // Locally, reuse whatever is already running — rebuilding for every run
        // makes the suite too slow to reach for.
        reuseExistingServer: !process.env['CI'],
        timeout: 180_000
    }
});
