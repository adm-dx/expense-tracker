import type {
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
};
