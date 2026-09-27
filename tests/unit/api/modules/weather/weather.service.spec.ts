import { ServiceUnavailableException } from '@nestjs/common';
import type { WeatherReading } from '@api/modules/weather/contracts';
import { GeocodingProvider } from '@api/modules/weather/providers/geocoding.provider';
import { WeatherProvider } from '@api/modules/weather/providers/weather.provider';
import {
  LOCATION_RETRY_MS,
  LOCATION_TTL_MS,
  MAX_CACHE_ENTRIES,
  PLACES_TTL_MS,
  roundCoordinate,
  STALE_WEATHER_MAX_AGE_MS,
  WEATHER_TTL_MS,
  WeatherService,
} from '@api/modules/weather/weather.service';

function makeReading(temperature = 18.4): WeatherReading {
  return {
    temperature,
    weatherCode: 2,
    isDay: true,
    observedAt: new Date('2026-09-26T10:00:00.000Z'),
  };
}

const PLACES = [{ name: 'Belgrade, RS', lat: 44.8178, lon: 20.4569 }];

describe('WeatherService', () => {
  let weatherProvider: { fetchCurrent: jest.Mock };
  let geocodingProvider: { reverse: jest.Mock; search: jest.Mock };
  let service: WeatherService;

  beforeEach(() => {
    jest.useFakeTimers({ now: new Date('2026-09-26T10:00:00.000Z') });
    weatherProvider = {
      fetchCurrent: jest.fn().mockResolvedValue(makeReading()),
    };
    geocodingProvider = {
      reverse: jest.fn().mockResolvedValue('Belgrade, RS'),
      search: jest.fn().mockResolvedValue(PLACES),
    };
    service = new WeatherService(
      weatherProvider as unknown as WeatherProvider,
      geocodingProvider as unknown as GeocodingProvider
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('combines the reading with the place name', async () => {
    await expect(service.getCurrent(44.7866, 20.4489)).resolves.toEqual({
      ...makeReading(),
      location: 'Belgrade, RS',
    });
  });

  it('asks the providers for coordinates rounded to two decimals', async () => {
    await service.getCurrent(44.78661, 20.44894);

    expect(weatherProvider.fetchCurrent).toHaveBeenCalledWith(44.79, 20.45);
    expect(geocodingProvider.reverse).toHaveBeenCalledWith(44.79, 20.45);
  });

  it('shares the cache between points that round to the same place', async () => {
    await service.getCurrent(44.7866, 20.4489);
    await service.getCurrent(44.7911, 20.4541);

    expect(weatherProvider.fetchCurrent).toHaveBeenCalledTimes(1);
    expect(geocodingProvider.reverse).toHaveBeenCalledTimes(1);
  });

  it('keeps separate places apart', async () => {
    await service.getCurrent(44.79, 20.45);
    await service.getCurrent(47.5, 19.04);

    expect(weatherProvider.fetchCurrent).toHaveBeenCalledTimes(2);
  });

  it('caches the weather for 30 minutes and the name for a day', async () => {
    await service.getCurrent(44.79, 20.45);
    jest.advanceTimersByTime(WEATHER_TTL_MS - 1);
    await service.getCurrent(44.79, 20.45);
    expect(weatherProvider.fetchCurrent).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(1);
    weatherProvider.fetchCurrent.mockResolvedValue(makeReading(20));
    const fresh = await service.getCurrent(44.79, 20.45);
    expect(weatherProvider.fetchCurrent).toHaveBeenCalledTimes(2);
    expect(fresh.temperature).toBe(20);
    expect(geocodingProvider.reverse).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(LOCATION_TTL_MS);
    await service.getCurrent(44.79, 20.45);
    expect(geocodingProvider.reverse).toHaveBeenCalledTimes(2);
  });

  it('shares one request between concurrent callers', async () => {
    const [first, second] = await Promise.all([
      service.getCurrent(44.79, 20.45),
      service.getCurrent(44.79, 20.45),
    ]);

    expect(weatherProvider.fetchCurrent).toHaveBeenCalledTimes(1);
    expect(first).toBe(second);
  });

  it('throws ServiceUnavailableException when nothing was ever fetched', async () => {
    weatherProvider.fetchCurrent.mockRejectedValue(new Error('network down'));

    await expect(service.getCurrent(44.79, 20.45)).rejects.toBeInstanceOf(
      ServiceUnavailableException
    );
  });

  it('serves the last reading while the provider is down, up to 3 hours', async () => {
    await service.getCurrent(44.79, 20.45);
    weatherProvider.fetchCurrent.mockRejectedValue(new Error('network down'));

    jest.advanceTimersByTime(STALE_WEATHER_MAX_AGE_MS - 1);
    await expect(service.getCurrent(44.79, 20.45)).resolves.toMatchObject({
      temperature: 18.4,
    });

    jest.advanceTimersByTime(1);
    await expect(service.getCurrent(44.79, 20.45)).rejects.toBeInstanceOf(
      ServiceUnavailableException
    );
  });

  it('returns the weather without a name when geocoding fails', async () => {
    geocodingProvider.reverse.mockRejectedValue(new Error('HTTP 429'));

    await expect(service.getCurrent(44.79, 20.45)).resolves.toMatchObject({
      temperature: 18.4,
      location: null,
    });
  });

  it('backs off after a failed lookup instead of retrying on every request', async () => {
    geocodingProvider.reverse.mockRejectedValueOnce(new Error('HTTP 429'));
    await service.getCurrent(44.79, 20.45);
    await service.getCurrent(44.79, 20.45);
    expect(geocodingProvider.reverse).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(LOCATION_RETRY_MS);
    const result = await service.getCurrent(44.79, 20.45);
    expect(geocodingProvider.reverse).toHaveBeenCalledTimes(2);
    expect(result.location).toBe('Belgrade, RS');
  });

  it('keeps a known name when a later lookup fails', async () => {
    await service.getCurrent(44.79, 20.45);
    jest.advanceTimersByTime(LOCATION_TTL_MS);
    geocodingProvider.reverse.mockRejectedValue(new Error('HTTP 429'));

    const result = await service.getCurrent(44.79, 20.45);

    expect(result.location).toBe('Belgrade, RS');
  });

  it('caches a place without a name too', async () => {
    geocodingProvider.reverse.mockResolvedValue(null);
    await service.getCurrent(0, -30);
    await service.getCurrent(0, -30);

    expect(geocodingProvider.reverse).toHaveBeenCalledTimes(1);
  });

  describe('searchPlaces', () => {
    it('asks the provider with the query normalized', async () => {
      await expect(service.searchPlaces('  Novi   SAD ')).resolves.toEqual(
        PLACES
      );
      expect(geocodingProvider.search).toHaveBeenCalledWith('novi sad');
    });

    it('caches results per normalized query for a day', async () => {
      await service.searchPlaces('Belgrade');
      await service.searchPlaces('belgrade ');
      expect(geocodingProvider.search).toHaveBeenCalledTimes(1);

      jest.setSystemTime(Date.now() + PLACES_TTL_MS);
      await service.searchPlaces('belgrade');
      expect(geocodingProvider.search).toHaveBeenCalledTimes(2);
    });

    it('caches an empty result too', async () => {
      geocodingProvider.search.mockResolvedValue([]);

      await service.searchPlaces('atlantis');
      await service.searchPlaces('atlantis');

      expect(geocodingProvider.search).toHaveBeenCalledTimes(1);
    });

    it('answers 503 when the provider fails, and retries next time', async () => {
      geocodingProvider.search.mockRejectedValueOnce(new Error('HTTP 429'));

      await expect(service.searchPlaces('belgrade')).rejects.toBeInstanceOf(
        ServiceUnavailableException
      );
      await expect(service.searchPlaces('belgrade')).resolves.toEqual(PLACES);
    });
  });

  it('drops the oldest place once the cache is full', async () => {
    for (let i = 0; i <= MAX_CACHE_ENTRIES; i++) {
      await service.getCurrent(0, i / 100);
    }
    const calls = MAX_CACHE_ENTRIES + 1;
    expect(weatherProvider.fetchCurrent).toHaveBeenCalledTimes(calls);

    // The newest is still cached, the first one was evicted.
    await service.getCurrent(0, MAX_CACHE_ENTRIES / 100);
    expect(weatherProvider.fetchCurrent).toHaveBeenCalledTimes(calls);
    await service.getCurrent(0, 0);
    expect(weatherProvider.fetchCurrent).toHaveBeenCalledTimes(calls + 1);
  });
});

describe('roundCoordinate', () => {
  it.each([
    [44.78661, 44.79],
    [20.444, 20.44],
    [-19.046, -19.05],
    [-179.999, -180],
  ])('%p → %p', (value, expected) => {
    expect(roundCoordinate(value)).toBe(expected);
  });
});
