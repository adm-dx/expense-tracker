import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Set when the app is served under a path, e.g. `/expense-tracker` in
  // production (see docs/deploy.md). Needed by both `next build` and
  // `next start` (ecosystem.config.cjs passes it); unset locally.
  basePath: process.env.NEXT_PUBLIC_BASE_PATH ?? '',
  reactStrictMode: true,
  transpilePackages: ['@expense-tracker/types'],
  redirects() {
    return [
      // Categories used to have their own page; they are managed in the
      // settings now. Temporary (307), so browsers don't cache it for good.
      { source: '/categories', destination: '/settings', permanent: false },
    ];
  },
};

export default nextConfig;
