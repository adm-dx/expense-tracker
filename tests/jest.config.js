const path = require('node:path');

/**
 * Unit tests live outside the apps they cover, so `rootDir` is the repo root
 * and sources are reached through the `@api/*` alias.
 * @type {import('jest').Config}
 */
module.exports = {
  rootDir: path.join(__dirname, '..'),
  roots: ['<rootDir>/tests/unit'],
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
  collectCoverageFrom: ['apps/api/src/**/*.(t|j)s'],
  coverageDirectory: '<rootDir>/coverage',
  testEnvironment: 'node',
};
