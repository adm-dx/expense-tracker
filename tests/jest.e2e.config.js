const path = require('node:path');
const integration = require('./jest.integration.config');

/**
 * End-to-end scenarios over HTTP; same runtime as the integration tests.
 * @type {import('jest').Config}
 */
module.exports = {
  ...integration,
  displayName: 'e2e',
  roots: ['<rootDir>/tests/e2e'],
  testRegex: '.*\\.e2e-spec\\.ts$',
};
