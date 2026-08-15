/// <reference types='vitest' />
import { resolve } from 'node:path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const workspaceRoot = resolve(import.meta.dirname, '../..');

export default defineConfig(({ mode }) => {
    // Both ports come from this checkout's `.env` so several checkouts — one
    // git worktree per agent or ticket — can run their own stack side by side
    // (`docs/parallel-stacks.md`). `loadEnv` reads the workspace `.env`
    // directly rather than trusting the task runner to have exported it; the
    // empty prefix is what makes unprefixed keys visible, and nothing here is
    // inlined into the client bundle — only `import.meta.env`/`define` are.
    // An explicitly exported variable still wins over the file.
    const env = { ...loadEnv(mode, workspaceRoot, ''), ...process.env };
    const adminPort = Number(env['ADMIN_PORT']) || 4200;
    // The proxy has to follow *this* checkout's API. Left at a literal 3000,
    // the second worktree's admin serves its own UI while silently reading and
    // writing the first worktree's database.
    const apiPort = Number(env['API_PORT'] ?? env['PORT']) || 3000;

    return {
        root: import.meta.dirname,
        cacheDir: '../../node_modules/.vite/apps/admin',
        server: {
            port: adminPort,
            // Fail loudly on a taken port instead of drifting to the next free
            // one: an agent is handed a URL to drive, and a silently-shifted
            // port either 404s or lands on a neighbouring worktree's admin.
            strictPort: true,
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
                    target: `http://localhost:${apiPort}`,
                    changeOrigin: true
                }
            }
        },
        preview: {
            port: adminPort,
            strictPort: true,
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
    };
});
