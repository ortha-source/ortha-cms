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
    transformIgnorePatterns: ['/node_modules/(?!@scalar/)'],
    // Workspace packages are consumed from source; map the entry points the
    // harness (and `buildPlugins`) pull in to their `src/index.ts`.
    moduleNameMapper: {
        '^@ortha-cms/bootstrap-server$':
            '<rootDir>/../../packages/bootstrap/server/src/index.ts',
        '^@ortha-cms/database$':
            '<rootDir>/../../packages/database/src/index.ts',
        '^@ortha-cms/identity-server$':
            '<rootDir>/../../packages/identity/server/src/index.ts'
    },
    moduleFileExtensions: ['ts', 'js', 'html'],
    coverageDirectory: 'test-output/jest/coverage',
    // Booting Nest + bcrypt seeding exceeds Jest's 5s default on cold CI.
    testTimeout: 30000,
    // One shared testcontainer; serial suites avoid racing on `resetDb`.
    // Parallelism can come later via a DB-per-worker scheme.
    maxWorkers: 1
};
