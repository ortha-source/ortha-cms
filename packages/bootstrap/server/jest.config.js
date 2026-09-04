const { readFileSync } = require('fs');
const { join } = require('path');

const swcJestConfig = JSON.parse(
    readFileSync(join(__dirname, '.spec.swcrc'), 'utf-8')
);
swcJestConfig.swcrc = false;

// The dossier used to say this package has "no test target of its own", on the
// grounds that a host only makes sense with an application around it. That is
// true of everything the host does *through* HTTP — which is why the real
// `createServer` is booted end to end in `apps/server-e2e/src/harness`. It is
// not true of the composition root's *ordering*: whether a hook ran before the
// app was created, whether the proxy setting was applied at all, which of two
// mounts went on first. Those are decisions this file makes and no request can
// observe, so they are pinned here against the real module with a recording
// application in place of Nest's.
module.exports = {
    displayName: 'bootstrap-server',
    preset: '../../../jest.preset.js',
    testEnvironment: 'node',
    transform: {
        '^.+\\.[tj]s$': ['@swc/jest', swcJestConfig]
    },
    moduleFileExtensions: ['ts', 'js'],
    // `@scalar/nestjs-api-reference` `require`s `@scalar/client-side-rendering`,
    // which ships ESM only — so the default "never transform node_modules"
    // leaves jest parsing a bare `export` and failing the suite before the first
    // assertion. Run the one scoped package through the same swc transform
    // rather than stubbing it: the reference handler this file mounts is the
    // real one everywhere else.
    transformIgnorePatterns: ['/node_modules/(?!@scalar/)'],
    testMatch: ['<rootDir>/src/**/*.spec.ts'],
    coverageDirectory: 'test-output/jest/coverage'
};
