import { minutes, type ThrottlerModuleOptions } from '@nestjs/throttler';

/**
 * Requests per client IP and route (the throttler keys on both), per window.
 * `default` applies everywhere; the others replace it on the routes that
 * name them with `@Throttle({ default: RATE_LIMITS.x })`.
 */
export const RATE_LIMITS = {
  /** A page load calls each endpoint once or twice. */
  default: { ttl: minutes(1), limit: 120 },
  /** Login, registration, password change: guessing passwords, spam accounts. */
  credentials: { ttl: minutes(1), limit: 10 },
  /** Every open tab refreshes its own session. */
  refresh: { ttl: minutes(1), limit: 30 },
  /** Each new point can cost an Open-Meteo and a Nominatim request. */
  weather: { ttl: minutes(1), limit: 30 },
  /** Nominatim allows one request a second for the whole app. */
  placeSearch: { ttl: minutes(1), limit: 10 },
} as const;

export const RATE_LIMIT_OPTIONS = {
  throttlers: [{ name: 'default', ...RATE_LIMITS.default }],
  // Shown as is by the web client; the default names the exception class.
  errorMessage: 'Too many requests, please try again in a minute',
} satisfies ThrottlerModuleOptions;
