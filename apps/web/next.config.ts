import type { NextConfig } from 'next';

/**
 * Headers for every response. The Content-Security-Policy isn't here: it
 * needs a nonce per request, so `src/proxy.ts` sets it.
 */
const SECURITY_HEADERS = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // The weather widget asks for the position; nothing needs the rest.
  {
    key: 'Permissions-Policy',
    value: 'geolocation=(self), camera=(), microphone=(), payment=(), usb=()',
  },
  // Ignored over plain HTTP, so harmless locally. No includeSubDomains: other
  // sites may share the domain.
  { key: 'Strict-Transport-Security', value: 'max-age=31536000' },
];

const nextConfig: NextConfig = {
  // Set when the app is served under a path, e.g. `/expense-tracker` in
  // production (see docs/deploy.md). Needed by both `next build` and
  // `next start` (ecosystem.config.cjs passes it); unset locally.
  basePath: process.env.NEXT_PUBLIC_BASE_PATH ?? '',
  reactStrictMode: true,
  poweredByHeader: false,
  headers() {
    return Promise.resolve([{ source: '/:path*', headers: SECURITY_HEADERS }]);
  },
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
