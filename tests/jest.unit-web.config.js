const path = require('node:path');
const nextJest = require('next/jest');

// next/jest wires up the SWC transform, CSS/asset stubs and the Next config.
const createJestConfig = nextJest({
  dir: path.join(__dirname, '../apps/web'),
});

/**
 * Web unit tests: pure logic, stores and components under jsdom.
 * @type {import('jest').Config}
 */
module.exports = createJestConfig({
  displayName: 'unit-web',
  rootDir: path.join(__dirname, '..'),
  roots: ['<rootDir>/tests/unit/web'],
  testRegex: '.*\\.spec\\.tsx?$',
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/tests/setup/web-setup.ts'],
  moduleNameMapper: {
    '^@web/(.*)$': '<rootDir>/apps/web/src/$1',
    '^@/(.*)$': '<rootDir>/apps/web/src/$1',
    '^@expense-tracker/types$': '<rootDir>/packages/types/src',
  },
});
