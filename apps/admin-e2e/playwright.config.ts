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
    /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
    use: {
        baseURL,
        /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
        trace: 'on-first-retry'
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
