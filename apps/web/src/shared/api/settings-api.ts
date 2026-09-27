import type {
  AddCurrencyRequest,
  Currency,
  RemoveCurrencyResult,
  ReplaceUserSettingsRequest,
  UpdateUserSettingsRequest,
  UserSettings,
} from '@expense-tracker/types';
import { httpClient } from './http-client';

export const settingsApi = {
  get: () => httpClient.get<UserSettings>('/settings'),
  update: (body: UpdateUserSettingsRequest) =>
    httpClient.patch<UserSettings>('/settings', body),
  replace: (body: ReplaceUserSettingsRequest) =>
    httpClient.put<UserSettings>('/settings', body),
  /** Back to the defaults; answers with them. */
  reset: () => httpClient.delete<UserSettings>('/settings'),
  addCurrency: (code: Currency) =>
    httpClient.post<UserSettings>('/settings/currencies', {
      code,
    } satisfies AddCurrencyRequest),
  /** Converts the currency's transactions to RSD, then disables it. */
  removeCurrency: (code: Currency) =>
    httpClient.delete<RemoveCurrencyResult>(`/settings/currencies/${code}`),
};
