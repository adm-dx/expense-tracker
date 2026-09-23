import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { applyTestEnv, TEST_DATABASE_URL } from './env';

/** Applies all migrations to the test database once per run. */
export default function globalSetup(): void {
  applyTestEnv();
  const apiDir = path.join(__dirname, '../../apps/api');
  // Run the Prisma CLI through node rather than `npx`: on Windows `npx` is a
  // .cmd shim that execFileSync can't spawn without a shell.
  const prismaCli = require.resolve('prisma/build/index.js', {
    paths: [apiDir],
  });
  try {
    execFileSync(process.execPath, [prismaCli, 'migrate', 'deploy'], {
      cwd: apiDir,
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
