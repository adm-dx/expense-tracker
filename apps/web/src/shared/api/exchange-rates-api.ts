import type { ExchangeRates } from '@expense-tracker/types';
import { httpClient } from './http-client';

export const exchangeRatesApi = {
  get: () => httpClient.get<ExchangeRates>('/exchange-rates'),
};
