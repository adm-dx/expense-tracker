import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
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
