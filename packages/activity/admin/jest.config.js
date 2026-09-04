const { readFileSync } = require('fs');
const { join } = require('path');

const swcJestConfig = JSON.parse(
    readFileSync(join(__dirname, '.spec.swcrc'), 'utf-8')
);
swcJestConfig.swcrc = false;

// `testEnvironment: 'node'`, matching `alarms-admin` and `copilot-admin`: what
// is unit tested here is the pure part — the wire→view mapper's refusal to
// invent a timestamp, the `<time datetime>` guard, and the label catalogue's
// agreement with the kind catalogue. Rendering belongs in `admin-e2e`, which
// drives the real browser; a jsdom layer in between would be a third place for
// the UI to be almost-right.
module.exports = {
    displayName: 'activity-admin',
    preset: '../../../jest.preset.js',
    testEnvironment: 'node',
    transform: {
        '^.+\\.[tj]sx?$': ['@swc/jest', swcJestConfig]
    },
    moduleFileExtensions: ['ts', 'tsx', 'js'],
    testMatch: ['<rootDir>/src/**/*.spec.ts'],
    coverageDirectory: 'test-output/jest/coverage'
};
