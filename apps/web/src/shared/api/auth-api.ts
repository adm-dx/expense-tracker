import type {
  AuthResponse,
  AuthTokens,
  LoginRequest,
  RefreshTokenRequest,
  RegisterRequest,
  User,
} from '@expense-tracker/types';
import { httpClient } from './http-client';

export const authApi = {
  register: (body: RegisterRequest) =>
    httpClient.post<AuthResponse>('/auth/register', body, { auth: false }),
  login: (body: LoginRequest) =>
    httpClient.post<AuthResponse>('/auth/login', body, { auth: false }),
  refresh: (body: RefreshTokenRequest) =>
    httpClient.post<AuthTokens>('/auth/refresh', body, {
      auth: false,
      skipRefresh: true,
    }),
  logout: (body: RefreshTokenRequest) =>
    httpClient.post<void>('/auth/logout', body),
  me: () => httpClient.get<User>('/auth/me'),
};
