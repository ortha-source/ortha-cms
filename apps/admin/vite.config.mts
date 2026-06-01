/// <reference types='vitest' />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(() => ({
    root: import.meta.dirname,
    cacheDir: '../../node_modules/.vite/apps/admin',
    server: {
        port: 4200,
        host: 'localhost'
    },
    preview: {
        port: 4200,
        host: 'localhost'
    },
    plugins: [tailwindcss(), react()],
    // Uncomment this if you are using workers.
    // worker: {
    //  plugins: [],
    // },
    build: {
        outDir: './dist',
        emptyOutDir: true,
        reportCompressedSize: true,
        commonjsOptions: {
            transformMixedEsModules: true
        }
    },
    test: {
        name: 'admin',
        watch: false,
        globals: true,
        environment: 'jsdom',
        include: [
            '{src,tests}/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'
        ],
        reporters: ['default'],
        coverage: {
            reportsDirectory: './test-output/vitest/coverage',
            provider: 'v8' as const
        }
    }
}));
