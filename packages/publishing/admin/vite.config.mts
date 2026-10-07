import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Vitest config for the plugin's unit tests. Component behaviour belongs in
// `admin-e2e`; what lives here is the pick algebra and the set model, whose
// whole job is to keep the three kinds of toggle agreeing about what is picked.
export default defineConfig(() => ({
    root: __dirname,
    cacheDir: '../../../node_modules/.vite/packages/publishing/admin',
    plugins: [react()],
    test: {
        name: '@orthacms/publishing-admin',
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
