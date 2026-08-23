import { readFileSync } from 'fs';

// Reading the SWC compilation config for the spec files
const swcJestConfig = JSON.parse(
    readFileSync(`${__dirname}/.spec.swcrc`, 'utf-8')
);

// Disable .swcrc look-up by SWC core because we're passing in swcJestConfig ourselves
swcJestConfig.swcrc = false;

export default {
    displayName: 'server-e2e',
    preset: '../../jest.preset.js',
    globalSetup: '<rootDir>/src/support/global-setup.ts',
    globalTeardown: '<rootDir>/src/support/global-teardown.ts',
    // Per-test harness state that lives in memory rather than in the database,
    // and so is not reached by `resetDb`.
    setupFilesAfterEnv: ['<rootDir>/src/support/jest.setup.ts'],
    testEnvironment: 'node',
    // Key matches the Nx preset's transform pattern **exactly**, so this
    // overrides it rather than sitting alongside it. Otherwise the preset's
    // `ts-jest` entry stays in the map and claims the `@scalar` files below,
    // then dies looking for a `tsconfig.spec.json` this project doesn't have.
    transform: {
        '^.+\\.(ts|js|mts|mjs|cts|cjs)$': ['@swc/jest', swcJestConfig]
    },
    // `@scalar/*` ships ESM only, and the harness reaches it through
    // `bootstrap-server` → `setup-api-docs` → `@scalar/nestjs-api-reference`.
    // Jest ignores `node_modules` for transforms by default, so without this
    // exception every suite dies at import time on a bare `export {`. The
    // negative lookahead keeps the rest of `node_modules` untransformed.
    //
    // `jose` joins it for the same reason, reached through
    // `@orthacms/identity-provider-oidc` in the host's `buildPlugins`.
    transformIgnorePatterns: ['/node_modules/(?!(@scalar|jose)/)'],
    // Workspace packages are consumed from source; map the entry points the
    // harness (and `buildPlugins`) pull in to their `src/index.ts`.
    moduleNameMapper: {
        '^@orthacms/bootstrap-server$':
            '<rootDir>/../../packages/bootstrap/server/src/index.ts',
        '^@orthacms/database$':
            '<rootDir>/../../packages/database/src/index.ts',
        '^@orthacms/identity-server$':
            '<rootDir>/../../packages/identity/server/src/index.ts'
    },
    moduleFileExtensions: ['ts', 'js', 'html'],
    coverageDirectory: 'test-output/jest/coverage',
    // Booting Nest + bcrypt seeding exceeds Jest's 5s default on cold CI.
    testTimeout: 30000,
    // One shared testcontainer; serial suites avoid racing on `resetDb`.
    // Parallelism can come later via a DB-per-worker scheme.
    //
    // Load-bearing, and **enforced** in `global-setup` rather than merely set
    // here: a CLI `--maxWorkers` overrides this file, and the corruption that
    // follows presents as unique-constraint violations inside unrelated tests.
    maxWorkers: 1
    // NOT set: `workerIdleMemoryLimit`. The worker's RSS does climb across a run
    // — measured 1.3 GB at 12 minutes and 2.0 GB at 25 on the 70-file suite,
    // each file booting its own Nest app — and recycling the worker does hold it
    // near 500 MB. But it was measured on the machine that has the problem, and
    // it made things worse: 1894 s against 1030 s for the same suite, because a
    // restart discards the whole `node_modules` require cache and re-reading it
    // is exactly what a memory-starved box is worst at. The growth is real and
    // worth fixing at the source; this particular lever is not the fix.
};
