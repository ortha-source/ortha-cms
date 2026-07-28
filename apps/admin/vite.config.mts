/// <reference types='vitest' />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(() => ({
    root: import.meta.dirname,
    cacheDir: '../../node_modules/.vite/apps/admin',
    server: {
        port: 4200,
        host: 'localhost',
        // Proxy the API under the same origin as the admin app so the
        // session cookie (httpOnly, SameSite=lax) is first-party in dev —
        // the same-origin assumption identity's #8 settled on, avoiding CORS.
        //
        // The key is a **regex ending in a slash**, not the bare `/api`
        // prefix: a plain string key prefix-matches, so `/api` would also
        // swallow sibling SPA routes whose path merely starts with those
        // characters (`/api-tokens`) and forward them to Nest, which 404s
        // `Cannot GET /api-tokens` on a hard refresh. Every real request is
        // `apiClient`'s `baseURL: '/api'` + a rooted path, so it always has
        // the trailing slash and still proxies.
        proxy: {
            '^/api/': {
                target: 'http://localhost:3000',
                changeOrigin: true
            }
        }
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
