import { existsSync } from 'node:fs';
import path from 'node:path';
import { defineConfig } from 'prisma/config';

// Prisma 7 no longer reads `.env` itself. Load the repo-root one when it
// exists; variables already set (the tests' TEST_DATABASE_URL) win.
const rootEnv = path.join(__dirname, '../../.env');
if (existsSync(rootEnv)) {
  process.loadEnvFile(rootEnv);
}

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations' },
  // Not `env('DATABASE_URL')`: that throws when unset, and `prisma generate`
  // must work without a database (fresh clone, CI).
  datasource: { url: process.env.DATABASE_URL ?? '' },
});
