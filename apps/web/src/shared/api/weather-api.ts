import type { CurrentWeather, WeatherParams } from '@expense-tracker/types';
import { httpClient } from './http-client';

export const weatherApi = {
  get: (params: WeatherParams) =>
    httpClient.get<CurrentWeather>('/weather', { params: { ...params } }),
};
