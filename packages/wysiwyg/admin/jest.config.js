const { readFileSync } = require('fs');
const { join } = require('path');

const swcJestConfig = JSON.parse(
    readFileSync(join(__dirname, '.spec.swcrc'), 'utf-8')
);
swcJestConfig.swcrc = false;

module.exports = {
    displayName: 'wysiwyg-admin',
    preset: '../../../jest.preset.js',
    // ProseMirror parses HTML through a real `DOMParser`, so the schema round
    // trip cannot be checked in a bare Node environment the way core's can.
    testEnvironment: 'jsdom',
    transform: {
        '^.+\\.[tj]sx?$': ['@swc/jest', swcJestConfig]
    },
    moduleFileExtensions: ['ts', 'tsx', 'js'],
    testMatch: ['<rootDir>/src/**/*.spec.ts?(x)'],
    coverageDirectory: 'test-output/jest/coverage'
};
