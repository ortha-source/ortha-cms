import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vitest config for the plugin's unit and component tests, mirroring
// `packages/api-tokens/admin`. Page behaviour in a real browser — the
// skeleton swap, axe, the keyboard — belongs in `admin-e2e`; what lives here
// is the layout logic and the page's four states.
export default defineConfig(() => ({
    root: __dirname,
    cacheDir: '../../../node_modules/.vite/packages/schema-builder/admin',
    plugins: [react()],
    test: {
        name: '@orthacms/schema-builder-admin',
        watch: false,
        globals: true,
        environment: 'jsdom',
        include: ['src/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
        reporters: ['default'],
        coverage: {
            reportsDirectory: './test-output/vitest/coverage',
            provider: 'v8' as const
        }
    }
}));
