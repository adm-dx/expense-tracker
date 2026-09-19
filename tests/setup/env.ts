/**
 * Environment for integration and e2e tests. The repo `.env` is deliberately
 * not read, so a test run can never reach the dev database.
 */
export const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  'postgresql://expense_tracker:dev_password@localhost:5433/expense_tracker_test?schema=public';

/** Refuses anything that doesn't look like a throwaway test database. */
export function assertTestDatabase(url: string): void {
  const name = new URL(url).pathname.replace(/^\//, '');
  if (!name.endsWith('_test')) {
    throw new Error(
      `Refusing to run tests against "${name}": the database name must end with "_test".`
    );
  }
}

export function applyTestEnv(): void {
  assertTestDatabase(TEST_DATABASE_URL);
  process.env.DATABASE_URL = TEST_DATABASE_URL;
  process.env.JWT_ACCESS_SECRET = 'test-access-secret';
  process.env.JWT_ACCESS_EXPIRES_IN = '15m';
  process.env.JWT_REFRESH_SECRET = 'test-refresh-secret';
  process.env.JWT_REFRESH_EXPIRES_IN = '7d';
  process.env.WEB_URL = 'http://localhost:3000';
}
