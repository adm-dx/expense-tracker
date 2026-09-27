import type { CurrentWeather } from '@expense-tracker/types';
import { useWeatherStore } from '@web/entities/weather';
import { ApiError } from '@web/shared/api/http-client';
import { weatherApi } from '@web/shared/api/weather-api';
import { getApproximatePosition } from '@web/shared/lib/geolocation';
import { resetRegisteredStores } from '@web/shared/lib/store-reset';

jest.mock('@web/shared/api/weather-api', () => ({
  weatherApi: { get: jest.fn() },
}));
jest.mock('@web/shared/lib/geolocation', () => ({
  getApproximatePosition: jest.fn(),
}));

const getWeather = weatherApi.get as jest.MockedFunction<typeof weatherApi.get>;
const locate = getApproximatePosition as jest.MockedFunction<
  typeof getApproximatePosition
>;

const BELGRADE = { lat: 44.79, lon: 20.45 };
const WEATHER: CurrentWeather = {
  temperature: 18.4,
  weatherCode: 2,
  isDay: true,
  location: 'Belgrade, RS',
  observedAt: '2026-09-26T12:00:00.000Z',
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

beforeEach(() => {
  jest.useFakeTimers({ now: new Date('2026-09-26T12:00:00.000Z') });
  getWeather.mockReset();
  locate.mockReset();
  locate.mockResolvedValue(BELGRADE);
  getWeather.mockResolvedValue(WEATHER);
  useWeatherStore.getState().reset();
});

afterEach(() => {
  jest.useRealTimers();
});

describe('useWeatherStore', () => {
  it('locates the user and loads the weather there', async () => {
    await useWeatherStore.getState().refresh();

    expect(getWeather).toHaveBeenCalledWith(BELGRADE);
    expect(useWeatherStore.getState()).toMatchObject({
      weather: WEATHER,
      status: 'success',
      updatedAt: Date.now(),
    });
  });

  it('is unavailable, and asks no one, without a position', async () => {
    locate.mockResolvedValue(null);

    await useWeatherStore.getState().refresh();

    expect(getWeather).not.toHaveBeenCalled();
    expect(useWeatherStore.getState()).toMatchObject({
      weather: null,
      status: 'unavailable',
    });
  });

  it('forgets the old weather once location access is revoked', async () => {
    await useWeatherStore.getState().refresh();
    locate.mockResolvedValue(null);

    await useWeatherStore.getState().refresh();

    expect(useWeatherStore.getState()).toMatchObject({
      weather: null,
      status: 'unavailable',
      updatedAt: null,
    });
  });

  it('keeps the last weather when a refresh fails', async () => {
    await useWeatherStore.getState().refresh();
    const loadedAt = Date.now();
    jest.advanceTimersByTime(60 * 60 * 1000);
    getWeather.mockRejectedValue(new ApiError(503, ['Weather is unavailable']));

    await useWeatherStore.getState().refresh();

    expect(useWeatherStore.getState()).toMatchObject({
      weather: WEATHER,
      status: 'error',
      error: 'Weather is unavailable',
      updatedAt: loadedAt,
    });
  });

  it('keeps the old weather on screen while refreshing', async () => {
    await useWeatherStore.getState().refresh();
    const pending = deferred<CurrentWeather>();
    getWeather.mockReturnValue(pending.promise);

    const refreshing = useWeatherStore.getState().refresh();

    expect(useWeatherStore.getState()).toMatchObject({
      weather: WEATHER,
      status: 'loading',
    });
    pending.resolve({ ...WEATHER, temperature: 20 });
    await refreshing;
    expect(useWeatherStore.getState().weather?.temperature).toBe(20);
  });

  it('ignores a refresh while one is in flight', async () => {
    const pending = deferred<CurrentWeather>();
    getWeather.mockReturnValue(pending.promise);

    const first = useWeatherStore.getState().refresh();
    await useWeatherStore.getState().refresh();
    pending.resolve(WEATHER);
    await first;

    expect(locate).toHaveBeenCalledTimes(1);
    expect(getWeather).toHaveBeenCalledTimes(1);
  });

  it('drops a response that lands after the session was reset', async () => {
    const pending = deferred<CurrentWeather>();
    getWeather.mockReturnValue(pending.promise);

    const refreshing = useWeatherStore.getState().refresh();
    await Promise.resolve();
    resetRegisteredStores();
    pending.resolve(WEATHER);
    await refreshing;

    expect(useWeatherStore.getState()).toMatchObject({
      weather: null,
      status: 'idle',
    });
  });

  it('loads the weather at a given place without asking the browser', async () => {
    await useWeatherStore.getState().refresh({ lat: 45.25, lon: 19.84 });

    expect(locate).not.toHaveBeenCalled();
    expect(getWeather).toHaveBeenCalledWith({ lat: 45.25, lon: 19.84 });
    expect(useWeatherStore.getState().status).toBe('success');
  });

  it('lets a request for another place replace the one in flight', async () => {
    const stale = deferred<CurrentWeather>();
    getWeather.mockReturnValueOnce(stale.promise);
    const noviSad = { ...WEATHER, location: 'Novi Sad, RS' };
    getWeather.mockResolvedValueOnce(noviSad);

    const first = useWeatherStore.getState().refresh();
    await Promise.resolve();
    await useWeatherStore.getState().refresh({ lat: 45.25, lon: 19.84 });
    stale.resolve(WEATHER);
    await first;

    expect(getWeather).toHaveBeenCalledTimes(2);
    expect(useWeatherStore.getState().weather).toEqual(noviSad);
  });
});
