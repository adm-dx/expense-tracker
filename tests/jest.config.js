/**
 * Default `npm test`: fast unit suites only, no database and no network.
 * Integration and e2e have their own configs (`npm run test:integration`,
 * `npm run test:e2e`) because they need the test database.
 * @type {import('jest').Config}
 */
module.exports = {
  projects: [
    '<rootDir>/jest.unit-api.config.js',
    '<rootDir>/jest.unit-web.config.js',
  ],
};
