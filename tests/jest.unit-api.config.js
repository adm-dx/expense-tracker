const path = require('node:path');

/**
 * API unit tests: classes built with `new`, every collaborator mocked.
 * @type {import('jest').Config}
 */
module.exports = {
  displayName: 'unit-api',
  rootDir: path.join(__dirname, '..'),
  // The sources are listed too so coverage can find files no test loads;
  // `testRegex` keeps them from being picked up as tests.
  roots: ['<rootDir>/tests/unit/api', '<rootDir>/apps/api/src'],
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
    '^@expense-tracker/types$': '<rootDir>/packages/types/src',
  },
  testEnvironment: 'node',
};
