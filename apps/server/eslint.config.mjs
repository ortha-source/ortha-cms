import baseConfig from '../../eslint.config.mjs';

export default [
    ...baseConfig,
    {
        // The dev seed's bundle (`dev:seed:build`).
        ignores: ['dist-seed']
    },
    {
        // The dev seed reaches use cases and schema tables that plugins do not
        // export — the same exemption, for the same reason, as server-e2e's
        // support harness: it is development tooling, never shipped, and the
        // alternative is widening every plugin's public surface for it.
        files: ['dev/**/*.ts'],
        rules: {
            '@nx/enforce-module-boundaries': 'off'
        }
    }
];
