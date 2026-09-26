import type {
  CurrentWeather,
  Place,
  WeatherParams,
} from '@expense-tracker/types';
import { httpClient } from './http-client';

export const weatherApi = {
  get: (params: WeatherParams) =>
    httpClient.get<CurrentWeather>('/weather', { params: { ...params } }),
  /** Towns matching `query`. Nominatim forbids autocomplete: call on submit. */
  searchPlaces: (query: string) =>
    httpClient.get<Place[]>('/weather/places', { params: { q: query } }),
};
