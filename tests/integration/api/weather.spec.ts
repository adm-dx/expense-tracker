import { INestApplication } from '@nestjs/common';
import type { CurrentWeather, Place } from '@expense-tracker/types';
import {
  bearer,
  createTestApp,
  registerUser,
  request,
  TestUser,
} from '@tests/setup/app';
import { expectJson } from '@tests/setup/http';
import { disconnectDatabase, resetDatabase } from '@tests/setup/prisma';
import {
  FakeGeocodingProvider,
  FakeWeatherProvider,
  TEST_LOCATION,
  TEST_PLACES,
  TEST_WEATHER,
} from '@tests/setup/weather';

let app: INestApplication;
let weatherProvider: FakeWeatherProvider;
let geocodingProvider: FakeGeocodingProvider;
let user: TestUser;

beforeAll(async () => {
  weatherProvider = new FakeWeatherProvider();
  geocodingProvider = new FakeGeocodingProvider();
  app = await createTestApp(undefined, { weatherProvider, geocodingProvider });
  await resetDatabase();
  user = await registerUser(app);
});

afterAll(async () => {
  await app.close();
  await disconnectDatabase();
});

const server = () => request(app.getHttpServer());

describe('GET /weather', () => {
  it('requires a token', async () => {
    expect((await server().get('/weather?lat=44.79&lon=20.45')).status).toBe(
      401
    );
  });

  it('returns the weather and the place name', async () => {
    const weather = await expectJson<CurrentWeather>(
      server()
        .get('/weather?lat=44.786&lon=20.449')
        .set(...bearer(user))
    );

    expect(weather).toEqual({ ...TEST_WEATHER, location: TEST_LOCATION });
    // The server rounds again, so exact coordinates never reach the providers.
    expect(weatherProvider.calls).toContainEqual([44.79, 20.45]);
    expect(geocodingProvider.calls).toContainEqual([44.79, 20.45]);
  });

  it.each([
    ['no coordinates', ''],
    ['no longitude', '?lat=44.79'],
    ['an empty latitude', '?lat=&lon=20.45'],
    ['a latitude past the pole', '?lat=91&lon=20.45'],
    ['a longitude past the antimeridian', '?lat=44.79&lon=181'],
    ['a non-number', '?lat=abc&lon=20.45'],
    ['an unknown parameter', '?lat=44.79&lon=20.45&city=Belgrade'],
    ['refresh other than 1', '?lat=44.79&lon=20.45&refresh=yes'],
  ])('rejects %s with 400', async (_, query) => {
    const response = await server()
      .get(`/weather${query}`)
      .set(...bearer(user));

    expect(response.status).toBe(400);
  });

  it('asks the provider again for refresh=1, at most every 5 minutes', async () => {
    const get = (query: string) =>
      expectJson<CurrentWeather>(
        server()
          .get(`/weather?lat=40.42&lon=-3.7${query}`)
          .set(...bearer(user))
      );
    const callsHere = () =>
      weatherProvider.calls.filter(([lat]) => lat === 40.42).length;

    await get('');
    await get('&refresh=1');
    // Just fetched: the cache answers.
    expect(callsHere()).toBe(1);

    const realNow = Date.now.bind(Date);
    const clock = jest
      .spyOn(Date, 'now')
      .mockImplementation(() => realNow() + 5 * 60 * 1000);
    try {
      await get('');
      expect(callsHere()).toBe(1);
      await get('&refresh=1');
      expect(callsHere()).toBe(2);
    } finally {
      clock.mockRestore();
    }
  });

  it('answers 503 when the provider is down and nothing is cached', async () => {
    weatherProvider.failing = true;
    try {
      const response = await server()
        .get('/weather?lat=-33.87&lon=151.21')
        .set(...bearer(user));

      expect(response.status).toBe(503);
    } finally {
      weatherProvider.failing = false;
    }
  });

  it('still answers without a name when geocoding is down', async () => {
    geocodingProvider.failing = true;
    try {
      const weather = await expectJson<CurrentWeather>(
        server()
          .get('/weather?lat=47.5&lon=19.04')
          .set(...bearer(user))
      );

      expect(weather.location).toBeNull();
      expect(weather.temperature).toBe(TEST_WEATHER.temperature);
    } finally {
      geocodingProvider.failing = false;
    }
  });
});

describe('GET /weather/places', () => {
  it('requires a token', async () => {
    expect((await server().get('/weather/places?q=belgrade')).status).toBe(401);
  });

  it('returns the towns found for the query', async () => {
    const places = await expectJson<Place[]>(
      server()
        .get('/weather/places?q=Belgrade')
        .set(...bearer(user))
    );

    expect(places).toEqual(TEST_PLACES);
    expect(geocodingProvider.searches).toContain('belgrade');
  });

  it('returns an empty list when nothing matches', async () => {
    const places = await expectJson<Place[]>(
      server()
        .get('/weather/places?q=atlantis')
        .set(...bearer(user))
    );

    expect(places).toEqual([]);
  });

  it('asks the provider once per query', async () => {
    const before = geocodingProvider.searches.length;

    for (const q of ['Subotica', ' subotica ', 'SUBOTICA']) {
      await server()
        .get(`/weather/places?q=${encodeURIComponent(q)}`)
        .set(...bearer(user))
        .expect(200);
    }

    expect(geocodingProvider.searches.length - before).toBe(1);
  });

  it.each([
    ['no query', ''],
    ['a one-letter query', '?q=b'],
    ['a blank query', '?q=%20%20%20'],
    ['a query that is too long', `?q=${'x'.repeat(101)}`],
    ['an unknown parameter', '?q=belgrade&limit=50'],
  ])('rejects %s with 400', async (_, query) => {
    const response = await server()
      .get(`/weather/places${query}`)
      .set(...bearer(user));

    expect(response.status).toBe(400);
  });

  it('answers 503 when the search provider is down', async () => {
    geocodingProvider.failing = true;
    try {
      const response = await server()
        .get('/weather/places?q=kragujevac')
        .set(...bearer(user));

      expect(response.status).toBe(503);
    } finally {
      geocodingProvider.failing = false;
    }
  });
});
