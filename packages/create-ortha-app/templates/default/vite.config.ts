import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
    // The empty prefix is what makes unprefixed keys visible. Nothing here is
    // inlined into the client bundle — only `import.meta.env` and `define` are.
    const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env };
    const adminPort = Number(env['ADMIN_PORT']) || 4200;
    const apiPort = Number(env['PORT']) || 3000;

    return {
        server: {
            port: adminPort,
            // Fail on a taken port rather than drifting to the next free one:
            // a silently-shifted port either 404s or lands on another app.
            strictPort: true,
            // Proxy the API under the admin's own origin, so the session
            // cookie (httpOnly, SameSite=lax) is first-party in development —
            // the same single origin `ortha start` gives you in production via
            // `staticDir`, and the reason neither needs CORS.
            //
            // The key is a REGEX ending in a slash, not the bare `/api`
            // prefix: a plain string key prefix-matches, so `/api` would also
            // swallow sibling SPA routes whose path merely starts with those
            // characters (`/api-tokens`) and forward them to the API, which
            // 404s them on a hard refresh.
            proxy: {
                '^/api/': {
                    target: `http://localhost:${apiPort}`,
                    changeOrigin: true
                }
            }
        },
        plugins: [tailwindcss(), react()],
        build: {
            // What `staticDir` serves in production.
            outDir: 'dist/admin',
            emptyOutDir: true
        }
    };
});
