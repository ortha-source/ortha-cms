import { defineConfig, devices } from '@playwright/test';
import { nxE2EPreset } from '@nx/playwright/preset';
import { workspaceRoot } from '@nx/devkit';

// Which admin this run drives. `ADMIN_PORT` is the per-checkout dev port, so
// parallel worktrees each test their own stack instead of racing on one
// (`docs/parallel-stacks.md`); Nx exports it from the workspace `.env`.
const adminPort = Number(process.env['ADMIN_PORT']) || 4200;
const adminUrl = `http://localhost:${adminPort}`;

// For CI, you may want to set BASE_URL to the deployed application.
const baseURL = process.env['BASE_URL'] || adminUrl;

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// require('dotenv').config();

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
    ...nxE2EPreset(__filename, { testDir: './src' }),
    /* Checks the port really holds *this* app and that no live API is behind the
       proxy — both fail as a broad, plausible-looking regression otherwise.
       Runs after `webServer` is up (plugin setup precedes global setup). */
    globalSetup: './src/support/globalSetup.ts',
    /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
    use: {
        baseURL,
        /* `on-first-retry` produced a trace exactly never: the preset sets
           `retries` to 0 outside CI and this repo has no CI, so there was no
           first retry to collect on. Keep retries at 0 — a flake must stay
           visible as a failure rather than be papered over — and retain the
           trace on every failure instead, since a local run is the only
           post-mortem anyone gets. See https://playwright.dev/docs/trace-viewer */
        trace: 'retain-on-failure'
    },
    /* Run the admin dev server before starting the tests. Specs mock `/api`
       at the network layer, so no backend (or the dev proxy) is needed. */
    webServer: {
        command: 'npx nx run admin:serve',
        url: adminUrl,
        reuseExistingServer: true,
        cwd: workspaceRoot
    },
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] }
        }

        // Uncomment for mobile browsers support
        /* {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 12'] },
    }, */

        // Uncomment for branded browsers
        /* {
      name: 'Microsoft Edge',
      use: { ...devices['Desktop Edge'], channel: 'msedge' },
    },
    {
      name: 'Google Chrome',
      use: { ...devices['Desktop Chrome'], channel: 'chrome' },
    } */
    ]
});
