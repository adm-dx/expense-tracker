import { ConfigService } from '@nestjs/config';
import {
  DEFAULT_GEOCODING_URL,
  GEOCODING_USER_AGENT,
  MIN_REQUEST_INTERVAL_MS,
  NominatimProvider,
} from '@api/modules/weather/providers/nominatim.provider';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const BELGRADE = {
  name: 'City of Belgrade',
  address: {
    city: 'Belgrade',
    state: 'Central Serbia',
    country: 'Serbia',
    country_code: 'rs',
  },
};

describe('NominatimProvider', () => {
  let fetchMock: jest.SpiedFunction<typeof fetch>;

  function makeProvider(url?: string) {
    const config = { get: jest.fn().mockReturnValue(url) };
    return new NominatimProvider(config as unknown as ConfigService);
  }

  beforeEach(() => {
    fetchMock = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchMock.mockRestore();
    jest.useRealTimers();
  });

  it('asks for a city-level English name with an identifying User-Agent', async () => {
    fetchMock.mockResolvedValue(jsonResponse(BELGRADE));

    const name = await makeProvider().reverse(44.79, 20.45);

    const [url, init] = fetchMock.mock.calls[0]!;
    const parsed = new URL(String(url));
    expect(`${parsed.origin}${parsed.pathname}`).toBe(
      `${DEFAULT_GEOCODING_URL}/reverse`
    );
    expect(Object.fromEntries(parsed.searchParams)).toEqual({
      format: 'jsonv2',
      lat: '44.79',
      lon: '20.45',
      zoom: '10',
      'accept-language': 'en',
    });
    expect(init?.headers).toEqual({ 'User-Agent': GEOCODING_USER_AGENT });
    expect(name).toBe('Belgrade, RS');
  });

  it('uses GEOCODING_URL when it is set', async () => {
    fetchMock.mockResolvedValue(jsonResponse(BELGRADE));

    await makeProvider('http://geo.test').reverse(0, 0);

    expect(String(fetchMock.mock.calls[0]![0])).toMatch(
      /^http:\/\/geo\.test\/reverse\?/
    );
  });

  it.each([
    [{ town: 'Pančevo' }, 'Pančevo, RS'],
    [{ village: 'Zlatibor' }, 'Zlatibor, RS'],
    [{ municipality: 'Stari Grad' }, 'Stari Grad, RS'],
    [{ state: 'Vojvodina' }, 'Vojvodina, RS'],
  ])('names a place without a city: %p', async (place, expected) => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        address: { ...place, country: 'Serbia', country_code: 'rs' },
      })
    );

    await expect(makeProvider().reverse(0, 0)).resolves.toBe(expected);
  });

  it('does not repeat the country code after a country name', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ address: { country: 'Serbia', country_code: 'rs' } })
    );

    await expect(makeProvider().reverse(0, 0)).resolves.toBe('Serbia');
  });

  it('returns null for a point with no place (open sea)', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ error: 'Unable to geocode' }));

    await expect(makeProvider().reverse(0, -30)).resolves.toBeNull();
  });

  it('rejects a non-2xx response', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, 429));

    await expect(makeProvider().reverse(0, 0)).rejects.toThrow('HTTP 429');
  });

  it('keeps requests at least a second apart', async () => {
    jest.useFakeTimers({ now: new Date('2026-09-26T10:00:00.000Z') });
    fetchMock.mockImplementation(() => Promise.resolve(jsonResponse(BELGRADE)));
    const provider = makeProvider();

    await provider.reverse(0, 0);
    const second = provider.reverse(1, 1);
    await jest.advanceTimersByTimeAsync(MIN_REQUEST_INTERVAL_MS - 1);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(1);
    await second;
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('keeps going after a failed request', async () => {
    jest.useFakeTimers({ now: new Date('2026-09-26T10:00:00.000Z') });
    fetchMock
      .mockRejectedValueOnce(new Error('network down'))
      .mockImplementation(() => Promise.resolve(jsonResponse(BELGRADE)));
    const provider = makeProvider();

    await expect(provider.reverse(0, 0)).rejects.toThrow('network down');
    const next = provider.reverse(0, 0);
    await jest.advanceTimersByTimeAsync(MIN_REQUEST_INTERVAL_MS);

    await expect(next).resolves.toBe('Belgrade, RS');
  });
});
