const path = require('node:path');

/**
 * Integration tests: the real Nest app (guards, pipes, controllers,
 * repositories) against the throwaway Postgres on :5433.
 * @type {import('jest').Config}
 */
module.exports = {
  displayName: 'integration',
  rootDir: path.join(__dirname, '..'),
  roots: ['<rootDir>/tests/integration'],
  testRegex: '.*\\.spec\\.ts$',
  moduleFileExtensions: ['js', 'json', 'ts'],
  transform: {
    '^.+\\.(t|j)s$': [
      'ts-jest',
      { tsconfig: path.join(__dirname, 'tsconfig.json') },
    ],
  },
  moduleNameMapper: {
    '^@api/(.*)$': '<rootDir>/apps/api/src/$1',
    '^@tests/(.*)$': '<rootDir>/tests/$1',
    '^@expense-tracker/types$': '<rootDir>/packages/types/src',
  },
  collectCoverageFrom: ['apps/api/src/**/*.ts', '!apps/api/src/main.ts'],
  coverageDirectory: '<rootDir>/coverage/integration',
  globalSetup: '<rootDir>/tests/setup/global-setup.ts',
  setupFiles: ['<rootDir>/tests/setup/apply-env.ts'],
  testEnvironment: 'node',
  // One shared database: files must not run in parallel.
  maxWorkers: 1,
  testTimeout: 30000,
};
