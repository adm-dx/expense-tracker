import { ConfigService } from '@nestjs/config';
import {
  DEFAULT_WEATHER_URL,
  FORECAST_DAYS,
  OpenMeteoProvider,
} from '@api/modules/weather/providers/open-meteo.provider';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

// 2026-09-26 and 2026-09-27, midnight in Belgrade (UTC+2).
const DAY_1 = Date.UTC(2026, 8, 25, 22) / 1000;
const DAY_2 = DAY_1 + 24 * 60 * 60;

const SUCCESS = {
  latitude: 44.8,
  longitude: 20.46,
  utc_offset_seconds: 7200,
  daily: {
    time: [DAY_1, DAY_2],
    weather_code: [3, 61],
    temperature_2m_max: [21.3, 17],
    temperature_2m_min: [11.8, 10.2],
    precipitation_probability_max: [10, null],
  },
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

  it('requests the current conditions and the forecast at the point', async () => {
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
      daily:
        'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
      forecast_days: String(FORECAST_DAYS),
      timezone: 'auto',
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
      forecast: [
        {
          date: '2026-09-26',
          weatherCode: 3,
          temperatureMax: 21.3,
          temperatureMin: 11.8,
          precipitationProbability: 10,
        },
        {
          date: '2026-09-27',
          weatherCode: 61,
          temperatureMax: 17,
          temperatureMin: 10.2,
          precipitationProbability: null,
        },
      ],
    });
  });

  it('leaves out a forecast day with a missing value', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        ...SUCCESS,
        daily: { ...SUCCESS.daily, temperature_2m_max: [21.3, null] },
      })
    );

    const reading = await makeProvider().fetchCurrent(0, 0);

    expect(reading.forecast.map((day) => day.date)).toEqual(['2026-09-26']);
  });

  it('keeps the current conditions when the forecast is missing', async () => {
    const { daily: _daily, ...withoutForecast } = SUCCESS;
    fetchMock.mockResolvedValue(jsonResponse(withoutForecast));

    const reading = await makeProvider().fetchCurrent(0, 0);

    expect(reading.temperature).toBe(18.4);
    expect(reading.forecast).toEqual([]);
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
