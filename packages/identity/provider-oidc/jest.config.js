const { readFileSync } = require('fs');
const { join } = require('path');

const swcJestConfig = JSON.parse(
    readFileSync(join(__dirname, '.spec.swcrc'), 'utf-8')
);
swcJestConfig.swcrc = false;

module.exports = {
    displayName: 'identity-provider-oidc',
    preset: '../../../jest.preset.js',
    testEnvironment: 'node',
    transform: {
        '^.+\\.[tj]s$': ['@swc/jest', swcJestConfig]
    },
    moduleFileExtensions: ['ts', 'js'],
    // `jose` ships ESM only. Node 22 can `require()` that, but Jest resolves
    // modules through its own registry rather than Node's, so it needs the
    // package transformed like any source file — hence the one exception to
    // "never transform node_modules". Without it every suite in this package
    // dies on `Unexpected token 'export'` inside jose, with a stack that points
    // at the adapter rather than at the loader.
    transformIgnorePatterns: ['node_modules/(?!(jose)/)'],
    testMatch: ['<rootDir>/src/**/*.spec.ts'],
    coverageDirectory: 'test-output/jest/coverage'
};
