import { configureHttpClient } from '@/shared/api/http-client';
import { useSessionStore } from './store';

configureHttpClient({
  getAccessToken: () => useSessionStore.getState().accessToken,
  getRefreshToken: () => useSessionStore.getState().refreshToken,
  onTokensRefreshed: (tokens) => useSessionStore.getState().setTokens(tokens),
  onAuthFailure: () => useSessionStore.getState().clearSession(),
});
