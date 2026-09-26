import { ConfigService } from '@nestjs/config';
import {
  DEFAULT_WEATHER_URL,
  OpenMeteoProvider,
} from '@api/modules/weather/providers/open-meteo.provider';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const SUCCESS = {
  latitude: 44.8,
  longitude: 20.46,
  current: {
    time: 1790416800,
    interval: 900,
    temperature_2m: 18.4,
    weather_code: 3,
    is_day: 0,
  },
};

describe('OpenMeteoProvider', () => {
  let fetchMock: jest.SpiedFunction<typeof fetch>;

  function makeProvider(url?: string) {
    const config = { get: jest.fn().mockReturnValue(url) };
    return new OpenMeteoProvider(config as unknown as ConfigService);
  }

  beforeEach(() => {
    fetchMock = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  it('requests the current conditions at the point', async () => {
    fetchMock.mockResolvedValue(jsonResponse(SUCCESS));

    const reading = await makeProvider().fetchCurrent(44.79, 20.45);

    const [url, init] = fetchMock.mock.calls[0]!;
    const parsed = new URL(String(url));
    expect(`${parsed.origin}${parsed.pathname}`).toBe(
      `${DEFAULT_WEATHER_URL}/forecast`
    );
    expect(Object.fromEntries(parsed.searchParams)).toEqual({
      latitude: '44.79',
      longitude: '20.45',
      current: 'temperature_2m,weather_code,is_day',
      timeformat: 'unixtime',
    });
    expect(init).toEqual(
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    expect(reading).toEqual({
      temperature: 18.4,
      weatherCode: 3,
      isDay: false,
      observedAt: new Date(1790416800 * 1000),
    });
  });

  it('uses WEATHER_URL when it is set', async () => {
    fetchMock.mockResolvedValue(jsonResponse(SUCCESS));

    await makeProvider('http://weather.test/v1').fetchCurrent(0, 0);

    expect(String(fetchMock.mock.calls[0]![0])).toMatch(
      /^http:\/\/weather\.test\/v1\/forecast\?/
    );
  });

  it('rejects a response without current conditions', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ ...SUCCESS, current: { time: 1790416800 } })
    );

    await expect(makeProvider().fetchCurrent(0, 0)).rejects.toThrow(
      'no current conditions'
    );
  });

  it('rejects a non-2xx response', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error: true, reason: 'Latitude must be in range' }, 400)
    );

    await expect(makeProvider().fetchCurrent(0, 0)).rejects.toThrow('HTTP 400');
  });

  it('passes a network failure or timeout through', async () => {
    fetchMock.mockRejectedValue(
      new DOMException('The operation was aborted', 'TimeoutError')
    );

    await expect(makeProvider().fetchCurrent(0, 0)).rejects.toThrow('aborted');
  });
});
