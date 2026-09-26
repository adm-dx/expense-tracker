import type { WeatherReading } from '@api/modules/weather/contracts';
import { GeocodingProvider } from '@api/modules/weather/providers/geocoding.provider';
import { WeatherProvider } from '@api/modules/weather/providers/weather.provider';

export const TEST_WEATHER = {
  temperature: 18.4,
  weatherCode: 2,
  isDay: true,
  observedAt: '2026-09-26T12:00:00.000Z',
} as const;
export const TEST_LOCATION = 'Belgrade, RS';

/**
 * Stand-ins for Open-Meteo and Nominatim in integration and e2e tests: no
 * network, fixed answers, a switch to simulate an outage, and the calls made.
 */
export class FakeWeatherProvider extends WeatherProvider {
  failing = false;
  calls: Array<[number, number]> = [];

  fetchCurrent(lat: number, lon: number): Promise<WeatherReading> {
    this.calls.push([lat, lon]);
    if (this.failing) {
      return Promise.reject(new Error('Simulated provider outage'));
    }
    return Promise.resolve({
      ...TEST_WEATHER,
      observedAt: new Date(TEST_WEATHER.observedAt),
    });
  }
}

export class FakeGeocodingProvider extends GeocodingProvider {
  failing = false;
  calls: Array<[number, number]> = [];

  reverse(lat: number, lon: number): Promise<string | null> {
    this.calls.push([lat, lon]);
    if (this.failing) {
      return Promise.reject(new Error('Simulated geocoding outage'));
    }
    return Promise.resolve(TEST_LOCATION);
  }
}
