/**
 * The Content-Security-Policy of every page, built per request by
 * `src/proxy.ts` with a fresh nonce: Next puts it on its own inline scripts,
 * the root layout on the theme script, and no other script runs. Session
 * tokens live in `localStorage`, so an injected script is the one thing that
 * could take them; this is what stops it.
 */
export function buildContentSecurityPolicy({
  nonce,
  apiUrl,
  isDev,
}: {
  nonce: string;
  /** `NEXT_PUBLIC_API_URL`: the only other origin pages talk to. */
  apiUrl: string;
  isDev: boolean;
}): string {
  const directives = [
    "default-src 'self'",
    // React needs eval in development only, for its error overlays.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ''}`,
    // Radix, Recharts and sonner set inline styles; styles can't run code.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' blob: data:",
    "font-src 'self'",
    `connect-src 'self' ${new URL(apiUrl).origin}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  // Only when the API is on HTTPS: an HTTP one (local `next start`) would be
  // upgraded to an address that doesn't answer.
  if (new URL(apiUrl).protocol === 'https:') {
    directives.push('upgrade-insecure-requests');
  }
  return directives.join('; ');
}
