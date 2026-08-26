const { readFileSync } = require('fs');
const { join } = require('path');

const swcJestConfig = JSON.parse(
    readFileSync(join(__dirname, '.spec.swcrc'), 'utf-8')
);
swcJestConfig.swcrc = false;

// `testEnvironment: 'node'` on purpose, matching `copilot-admin`: what is unit
// tested here is the pure part — the defensive reader for a stored tool result
// and the age-bar arithmetic. Component tests belong in `admin-e2e`, which
// drives the real browser; a jsdom layer in between would be a third place for
// the UI to be almost-right.
module.exports = {
    displayName: 'alarms-admin',
    preset: '../../../jest.preset.js',
    testEnvironment: 'node',
    transform: {
        '^.+\\.[tj]sx?$': ['@swc/jest', swcJestConfig]
    },
    moduleFileExtensions: ['ts', 'tsx', 'js'],
    testMatch: ['<rootDir>/src/**/*.spec.ts'],
    coverageDirectory: 'test-output/jest/coverage'
};
