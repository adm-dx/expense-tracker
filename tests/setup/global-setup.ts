import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { applyTestEnv, TEST_DATABASE_URL } from './env';

/** Applies all migrations to the test database once per run. */
export default function globalSetup(): void {
  applyTestEnv();
  try {
    execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
      cwd: path.join(__dirname, '../../apps/api'),
      env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
      stdio: 'pipe',
    });
  } catch (error) {
    const output =
      error instanceof Error && 'stderr' in error
        ? String((error as { stderr: unknown }).stderr)
        : String(error);
    throw new Error(
      `Could not migrate the test database. Is it running? (npm run db:test:start)\n${output}`,
      { cause: error }
    );
  }
}
