import type {
  CurrentWeather,
  Place,
  WeatherParams,
} from '@expense-tracker/types';
import { httpClient } from './http-client';

export const weatherApi = {
  /**
   * `refresh` asks the server to skip its cache; it does so at most every
   * five minutes per place and answers from the cache otherwise.
   */
  get: (params: WeatherParams, { refresh = false } = {}) =>
    httpClient.get<CurrentWeather>('/weather', {
      params: refresh ? { ...params, refresh: 1 } : { ...params },
    }),
  /** Towns matching `query`. Nominatim forbids autocomplete: call on submit. */
  searchPlaces: (query: string) =>
    httpClient.get<Place[]>('/weather/places', { params: { q: query } }),
};
