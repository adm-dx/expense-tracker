import type { DailyForecast, Place } from '@expense-tracker/types';
import type { WeatherReading } from '@api/modules/weather/contracts';
import { GeocodingProvider } from '@api/modules/weather/providers/geocoding.provider';
import { WeatherProvider } from '@api/modules/weather/providers/weather.provider';

export const TEST_FORECAST: DailyForecast[] = [
  {
    date: '2026-09-26',
    weatherCode: 2,
    temperatureMax: 21.3,
    temperatureMin: 11.8,
    precipitationProbability: 10,
  },
  {
    date: '2026-09-27',
    weatherCode: 61,
    temperatureMax: 17,
    temperatureMin: 10.2,
    precipitationProbability: 80,
  },
];

export const TEST_WEATHER = {
  temperature: 18.4,
  weatherCode: 2,
  isDay: true,
  observedAt: '2026-09-26T12:00:00.000Z',
  forecast: TEST_FORECAST,
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

export const TEST_PLACES: Place[] = [
  { name: 'Belgrade, RS', lat: 44.8178, lon: 20.4569 },
  { name: 'Belgrade, US', lat: 45.7761, lon: -111.1766 },
];

export class FakeGeocodingProvider extends GeocodingProvider {
  failing = false;
  calls: Array<[number, number]> = [];
  searches: string[] = [];

  reverse(lat: number, lon: number): Promise<string | null> {
    this.calls.push([lat, lon]);
    if (this.failing) {
      return Promise.reject(new Error('Simulated geocoding outage'));
    }
    return Promise.resolve(TEST_LOCATION);
  }

  /** Knows only "belgrade"; anything else finds nothing. */
  search(query: string): Promise<Place[]> {
    this.searches.push(query);
    if (this.failing) {
      return Promise.reject(new Error('Simulated geocoding outage'));
    }
    return Promise.resolve(query === 'belgrade' ? TEST_PLACES : []);
  }
}
