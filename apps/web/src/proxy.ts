import { NextResponse, type NextRequest } from 'next/server';
import { env } from '@/shared/config/env';
import { buildContentSecurityPolicy } from '@/shared/config/security-headers';

/**
 * Gives every page a fresh CSP nonce (see `buildContentSecurityPolicy`).
 * Next reads it from the request's Content-Security-Policy header and puts
 * it on the scripts it renders; `x-nonce` is for the root layout's own.
 */
export function proxy(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const csp = buildContentSecurityPolicy({
    nonce,
    apiUrl: env.apiUrl,
    isDev: process.env.NODE_ENV === 'development',
  });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  matcher: [
    {
      // Pages only: not the static files, nor link prefetches.
      source: '/((?!_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
