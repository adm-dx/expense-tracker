const path = require('node:path');

/**
 * Default `npm test`: fast unit suites only, no database and no network.
 * Integration and e2e have their own configs (`npm run test:integration`,
 * `npm run test:e2e`) because they need the test database.
 *
 * Coverage options live here, not in the projects, because Jest reads them
 * from the top level. Listing every source file (not just the ones tests
 * happen to load) keeps the percentages honest.
 * @type {import('jest').Config}
 */
module.exports = {
  rootDir: path.join(__dirname, '..'),
  projects: [
    '<rootDir>/tests/jest.unit-api.config.js',
    '<rootDir>/tests/jest.unit-web.config.js',
  ],
  collectCoverageFrom: [
    'apps/api/src/**/*.ts',
    'apps/web/src/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/index.ts',
    '!apps/api/src/main.ts',
    '!apps/api/src/generated/**',
    // Generated shadcn/ui primitives: not our code to cover.
    '!apps/web/src/shared/ui/**',
  ],
  coverageDirectory: '<rootDir>/coverage',
};
