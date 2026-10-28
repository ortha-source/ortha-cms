const { readFileSync } = require('fs');
const { join } = require('path');

const swcJestConfig = JSON.parse(
    readFileSync(join(__dirname, '.spec.swcrc'), 'utf-8')
);
swcJestConfig.swcrc = false;

// `testEnvironment: 'node'`, like `activity-admin`: what is unit tested here is
// the pure part — the wire mapper and the day grouping. Rendering belongs in
// `admin-e2e`, which drives the real browser.
module.exports = {
    displayName: 'inbox-admin',
    preset: '../../../jest.preset.js',
    testEnvironment: 'node',
    transform: {
        '^.+\\.[tj]sx?$': ['@swc/jest', swcJestConfig]
    },
    moduleFileExtensions: ['ts', 'tsx', 'js'],
    testMatch: ['<rootDir>/src/**/*.spec.ts'],
    coverageDirectory: 'test-output/jest/coverage'
};
