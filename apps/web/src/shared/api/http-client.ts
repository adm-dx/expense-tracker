import type { AuthTokens } from '@expense-tracker/types';
import { env } from '../config/env';

export class ApiError extends Error {
  readonly status: number;
  readonly messages: string[];
  readonly error: string | undefined;

  constructor(status: number, messages: string[], error?: string) {
    super(messages[0] ?? 'Request failed');
    this.status = status;
    this.messages = messages;
    this.error = error;
  }
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** Attach the current access token as a Bearer header. Defaults to true. */
  auth?: boolean;
  /** Internal: prevents the 401 refresh flow from retrying itself forever. */
  skipRefresh?: boolean;
}

interface HttpClientHooks {
  getAccessToken: () => string | null;
  getRefreshToken: () => string | null;
  onTokensRefreshed: (tokens: AuthTokens) => void;
  onAuthFailure: () => void;
}

let hooks: HttpClientHooks | null = null;

export function configureHttpClient(nextHooks: HttpClientHooks): void {
  hooks = nextHooks;
}

let refreshPromise: Promise<AuthTokens> | null = null;

function refreshTokens(): Promise<AuthTokens> {
  if (!hooks) {
    return Promise.reject(new ApiError(401, ['Not authenticated']));
  }
  const refreshToken = hooks.getRefreshToken();
  if (!refreshToken) {
    return Promise.reject(new ApiError(401, ['Not authenticated']));
  }

  refreshPromise ??= request<AuthTokens>('/auth/refresh', {
    method: 'POST',
    body: { refreshToken },
    auth: false,
    skipRefresh: true,
  }).finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
}

async function parseErrorBody(
  response: Response
): Promise<{ messages: string[]; error: string | undefined }> {
  try {
    const data = (await response.json()) as {
      message?: string | string[];
      error?: string;
    };
    const messages = Array.isArray(data.message)
      ? data.message
      : [data.message ?? response.statusText ?? 'Request failed'];
    return { messages, error: data.error };
  } catch {
    return {
      messages: [response.statusText || 'Request failed'],
      error: undefined,
    };
  }
}

async function request<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { body, auth = true, skipRefresh = false, headers, ...rest } = options;

  const requestHeaders = new Headers(headers);
  requestHeaders.set('Content-Type', 'application/json');
  if (auth) {
    const token = hooks?.getAccessToken();
    if (token) {
      requestHeaders.set('Authorization', `Bearer ${token}`);
    }
  }

  const response = await fetch(`${env.apiUrl}${path}`, {
    ...rest,
    headers: requestHeaders,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  if (response.status === 401 && auth && !skipRefresh && hooks) {
    try {
      const tokens = await refreshTokens();
      hooks.onTokensRefreshed(tokens);
      return await request<T>(path, { ...options, skipRefresh: true });
    } catch {
      hooks.onAuthFailure();
      const { messages, error } = await parseErrorBody(response);
      throw new ApiError(response.status, messages, error);
    }
  }

  if (!response.ok) {
    const { messages, error } = await parseErrorBody(response);
    throw new ApiError(response.status, messages, error);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export const httpClient = {
  get: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'POST', body }),
};
