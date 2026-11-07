// pm2 processes for production (see docs/deploy.md). Both bind to the
// loopback interface; nginx is the only way in.
const { existsSync } = require('node:fs');
const path = require('node:path');

// `next start` evaluates next.config.ts again, so it needs the same
// NEXT_PUBLIC_BASE_PATH as `next build`; without it every page is a 404.
// Read it from the repo-root .env instead of relying on the caller's shell.
const rootEnv = path.join(__dirname, '.env');
if (existsSync(rootEnv)) {
  process.loadEnvFile(rootEnv);
}

module.exports = {
  apps: [
    {
      name: 'et-api',
      // cwd = apps/api, so ConfigModule finds the repo-root `../../.env`.
      cwd: path.join(__dirname, 'apps/api'),
      script: path.join(__dirname, 'apps/api/dist/main.js'),
      env: { NODE_ENV: 'production' },
    },
    {
      name: 'et-web',
      cwd: path.join(__dirname, 'apps/web'),
      script: path.join(__dirname, 'node_modules/next/dist/bin/next'),
      args: `start -H 127.0.0.1 -p ${process.env.WEB_PORT || 3000}`,
      env: {
        NODE_ENV: 'production',
        NEXT_PUBLIC_BASE_PATH: process.env.NEXT_PUBLIC_BASE_PATH ?? '',
        NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL ?? '',
      },
    },
  ],
};
