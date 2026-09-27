import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { AuthResponse, Currency } from '@expense-tracker/types';
import { sign, type SignOptions } from 'jsonwebtoken';
import { AppModule } from '@api/app.module';
import { configureApp } from '@api/app.config';
import { ExchangeRatesProvider } from '@api/modules/exchange-rates/providers/exchange-rates.provider';
import { GeocodingProvider } from '@api/modules/weather/providers/geocoding.provider';
import { WeatherProvider } from '@api/modules/weather/providers/weather.provider';
import { assertTestDatabase } from './env';
import { FakeExchangeRatesProvider } from './exchange-rates';
import { expectJson, expectStatus } from './http';
import { FakeGeocodingProvider, FakeWeatherProvider } from './weather';

/** Fakes for the weather module's outside services, see `createTestApp`. */
export interface WeatherFakes {
  weatherProvider?: WeatherProvider;
  geocodingProvider?: GeocodingProvider;
}

/**
 * Boots the real application (guards, pipes, controllers, repositories) with
 * the same global configuration as `main.ts`. The only stand-ins are the
 * providers of exchange rates, weather and place names, so tests never reach
 * the network; pass your own fakes to control them.
 */
export async function createTestApp(
  ratesProvider: ExchangeRatesProvider = new FakeExchangeRatesProvider(),
  {
    weatherProvider = new FakeWeatherProvider(),
    geocodingProvider = new FakeGeocodingProvider(),
  }: WeatherFakes = {}
): Promise<INestApplication> {
  // Last line of defence: the app's own Prisma client reads DATABASE_URL.
  assertTestDatabase(process.env.DATABASE_URL ?? '');

  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  })
    .overrideProvider(ExchangeRatesProvider)
    .useValue(ratesProvider)
    .overrideProvider(WeatherProvider)
    .useValue(weatherProvider)
    .overrideProvider(GeocodingProvider)
    .useValue(geocodingProvider)
    .compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  await app.init();
  // Listen once on a fixed ephemeral port. Otherwise supertest would bind a
  // new port for every request, and a request can then hit whatever else
  // happens to be listening on a recycled port.
  await app.listen(0, '127.0.0.1');
  return app;
}

export interface TestUser {
  id: string;
  email: string;
  name: string;
  password: string;
  accessToken: string;
  refreshToken: string;
}

export const DEFAULT_PASSWORD = 'password123';

let counter = 0;

/** Registers a fresh user through the public API. */
export async function registerUser(
  app: INestApplication,
  overrides: Partial<{ name: string; email: string; password: string }> = {}
): Promise<TestUser> {
  counter += 1;
  const body = {
    name: overrides.name ?? `Test User ${counter}`,
    email: overrides.email ?? `user${counter}-${Date.now()}@example.com`,
    password: overrides.password ?? DEFAULT_PASSWORD,
  };
  const auth = await expectJson<AuthResponse>(
    request(app.getHttpServer()).post('/auth/register').send(body),
    201
  );

  return {
    id: auth.user.id,
    email: body.email,
    name: body.name,
    password: body.password,
    accessToken: auth.accessToken,
    refreshToken: auth.refreshToken,
  };
}

/**
 * Enables currencies for the user through the API, in order. A new user has
 * only EUR, so a test that writes transactions in anything else needs this.
 */
export async function enableCurrencies(
  app: INestApplication,
  user: Pick<TestUser, 'accessToken'>,
  codes: readonly Currency[]
): Promise<void> {
  for (const code of codes) {
    await expectStatus(
      request(app.getHttpServer())
        .post('/settings/currencies')
        .set(...bearer(user))
        .send({ code }),
      200
    );
  }
}

export function bearer(user: Pick<TestUser, 'accessToken'>): [string, string] {
  return ['Authorization', `Bearer ${user.accessToken}`];
}

export { request };

/**
 * Mints an access token the API did not issue, for testing the guard:
 * expired, signed with the wrong secret, or unsigned (`alg: none`).
 */
export function forgeAccessToken(
  payload: { sub: string; email: string },
  options: { secret?: string; expiresIn?: string | number; alg?: 'none' } = {}
): string {
  if (options.alg === 'none') {
    const encode = (value: unknown) =>
      Buffer.from(JSON.stringify(value)).toString('base64url');
    // The classic "alg: none" attack: a header claiming no signature at all.
    return `${encode({ alg: 'none', typ: 'JWT' })}.${encode(payload)}.`;
  }
  return sign(payload, options.secret ?? process.env.JWT_ACCESS_SECRET ?? '', {
    expiresIn: options.expiresIn ?? '15m',
  } as SignOptions);
}
