import baseConfig from '../../eslint.config.mjs';

export default [
    ...baseConfig,
    {
        // The e2e harness deliberately boots the host app and seeds through a
        // plugin-internal service — so it imports `apps/server` and an
        // identity-server internal by path. That trips the module-boundary
        // rule (meant for shipped app/lib code), but it's legitimate for an
        // out-of-process test harness with no published package to import.
        // Scope the exemption to the support harness; specs stay constrained.
        files: ['src/support/**/*.ts'],
        rules: {
            '@nx/enforce-module-boundaries': 'off'
        }
    }
];
