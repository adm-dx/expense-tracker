/**
 * @jest-environment node
 *
 * The HTTP client only touches `fetch`, `Response` and `Headers`, which jsdom
 * does not provide; Node does. No DOM is needed here.
 */
import type { AuthTokens } from '@expense-tracker/types';

/**
 * The client keeps module-level state (the hooks and the in-flight refresh),
 * so every test works with a freshly loaded copy.
 */
function loadClient() {
  let mod!: typeof import('@web/shared/api/http-client');
  jest.isolateModules(() => {
    mod = require('@web/shared/api/http-client');
  });
  return mod;
}

type FetchMock = jest.MockedFunction<typeof fetch>;

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const API_URL = 'http://localhost:3001';

let fetchMock: FetchMock;

function hooks(
  overrides: Partial<
    Parameters<ReturnType<typeof loadClient>['configureHttpClient']>[0]
  > = {}
) {
  return {
    getAccessToken: jest.fn(() => 'access-token'),
    getRefreshToken: jest.fn(() => 'refresh-token'),
    onTokensRefreshed: jest.fn(),
    onAuthFailure: jest.fn(),
    ...overrides,
  };
}

/** The URL and init of the nth fetch call. */
function callArgs(index: number) {
  const [url, init] = fetchMock.mock.calls[index] ?? [];
  return { url: String(url), init: init as RequestInit };
}

const headersOf = (index: number) =>
  new Headers(callArgs(index).init?.headers as HeadersInit);

beforeEach(() => {
  fetchMock = jest.fn() as FetchMock;
  global.fetch = fetchMock;
});

describe('request building', () => {
  it('sends JSON with the bearer token', async () => {
    const { httpClient, configureHttpClient } = loadClient();
    configureHttpClient(hooks());
    fetchMock.mockResolvedValue(jsonResponse(200, { ok: true }));

    const result = await httpClient.post('/transactions', { amount: 1 });

    expect(result).toEqual({ ok: true });
    expect(callArgs(0).url).toBe(`${API_URL}/transactions`);
    expect(callArgs(0).init.method).toBe('POST');
    expect(callArgs(0).init.body).toBe(JSON.stringify({ amount: 1 }));
    expect(headersOf(0).get('Authorization')).toBe('Bearer access-token');
    expect(headersOf(0).get('Content-Type')).toBe('application/json');
  });

  it.each([
    ['patch', 'PATCH'],
    ['post', 'POST'],
  ] as const)('%s uses the %s verb', async (method, verb) => {
    const { httpClient, configureHttpClient } = loadClient();
    configureHttpClient(hooks());
    fetchMock.mockResolvedValue(jsonResponse(200, {}));

    await httpClient[method]('/transactions/1', { amount: 1 });

    expect(callArgs(0).init.method).toBe(verb);
  });

  it('delete sends no body and tolerates an empty 204', async () => {
    const { httpClient, configureHttpClient } = loadClient();
    configureHttpClient(hooks());
    fetchMock.mockResolvedValue(new Response(null, { status: 204 }));

    const result = await httpClient.delete('/transactions/1');

    expect(result).toBeUndefined();
    expect(callArgs(0).init.method).toBe('DELETE');
    expect(callArgs(0).init.body).toBeUndefined();
  });

  it('appends query parameters and drops undefined ones', async () => {
    const { httpClient, configureHttpClient } = loadClient();
    configureHttpClient(hooks());
    fetchMock.mockResolvedValue(jsonResponse(200, {}));

    await httpClient.get('/transactions', {
      params: { page: 2, pageSize: 10, type: undefined },
    });

    expect(callArgs(0).url).toBe(`${API_URL}/transactions?page=2&pageSize=10`);
  });

  it('encodes parameter values', async () => {
    const { httpClient, configureHttpClient } = loadClient();
    configureHttpClient(hooks());
    fetchMock.mockResolvedValue(jsonResponse(200, {}));

    await httpClient.get('/transactions', {
      params: { dateFrom: '2026-09-01T00:00:00.000Z' },
    });

    expect(callArgs(0).url).toContain('dateFrom=2026-09-01T00%3A00%3A00.000Z');
  });

  it('omits the query string when there are no parameters', async () => {
    const { httpClient, configureHttpClient } = loadClient();
    configureHttpClient(hooks());
    fetchMock.mockResolvedValue(jsonResponse(200, {}));

    await httpClient.get('/transactions', { params: { type: undefined } });

    expect(callArgs(0).url).toBe(`${API_URL}/transactions`);
  });

  it('never attaches the token when auth is false', async () => {
    const { httpClient, configureHttpClient } = loadClient();
    const clientHooks = hooks();
    configureHttpClient(clientHooks);
    fetchMock.mockResolvedValue(jsonResponse(200, {}));

    await httpClient.post('/auth/login', { email: 'a@b.c' }, { auth: false });

    expect(headersOf(0).has('Authorization')).toBe(false);
    expect(clientHooks.getAccessToken).not.toHaveBeenCalled();
  });
});

describe('errors', () => {
  it('throws ApiError carrying the status and the list of messages', async () => {
    const { httpClient, configureHttpClient, ApiError } = loadClient();
    configureHttpClient(hooks());
    fetchMock.mockResolvedValue(
      jsonResponse(400, {
        message: ['amount must be a number', 'type must be one of'],
        error: 'Bad Request',
      })
    );

    const error = await httpClient
      .get('/transactions')
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      status: 400,
      messages: ['amount must be a number', 'type must be one of'],
      error: 'Bad Request',
      message: 'amount must be a number',
    });
  });

  it('wraps a single string message', async () => {
    const { httpClient, configureHttpClient } = loadClient();
    configureHttpClient(hooks());
    fetchMock.mockResolvedValue(jsonResponse(404, { message: 'Not found' }));

    await expect(httpClient.get('/transactions/x')).rejects.toMatchObject({
      status: 404,
      messages: ['Not found'],
    });
  });

  it('falls back to the status text when the body is not JSON', async () => {
    const { httpClient, configureHttpClient } = loadClient();
    configureHttpClient(hooks());
    fetchMock.mockResolvedValue(
      new Response('<html>502</html>', {
        status: 502,
        statusText: 'Bad Gateway',
      })
    );

    await expect(httpClient.get('/transactions')).rejects.toMatchObject({
      status: 502,
      message: 'Bad Gateway',
    });
  });
});

describe('refreshing an expired session', () => {
  const tokens: AuthTokens = {
    accessToken: 'new-access',
    refreshToken: 'new-refresh',
  };

  it('refreshes once on a 401 and retries the original request', async () => {
    const { httpClient, configureHttpClient } = loadClient();
    const clientHooks = hooks();
    configureHttpClient(clientHooks);
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(401, { message: 'Invalid access token' })
      )
      .mockResolvedValueOnce(jsonResponse(200, tokens))
      .mockResolvedValueOnce(jsonResponse(200, { items: [] }));

    const result = await httpClient.get('/transactions');

    expect(result).toEqual({ items: [] });
    expect(callArgs(1).url).toBe(`${API_URL}/auth/refresh`);
    expect(callArgs(1).init.body).toBe(
      JSON.stringify({ refreshToken: 'refresh-token' })
    );
    expect(clientHooks.onTokensRefreshed).toHaveBeenCalledWith(tokens);
    expect(clientHooks.onAuthFailure).not.toHaveBeenCalled();
    expect(callArgs(2).url).toBe(`${API_URL}/transactions`);
  });

  it('shares one refresh between requests that 401 at the same time', async () => {
    const { httpClient, configureHttpClient } = loadClient();
    const clientHooks = hooks();
    configureHttpClient(clientHooks);
    fetchMock.mockImplementation(((input: RequestInfo | URL) => {
      const url = String(input);
      if (url.endsWith('/auth/refresh')) {
        return Promise.resolve(jsonResponse(200, tokens));
      }
      const attempt = fetchMock.mock.calls.filter(
        ([callUrl]) => String(callUrl) === url
      ).length;
      return Promise.resolve(
        attempt === 1
          ? jsonResponse(401, { message: 'Invalid access token' })
          : jsonResponse(200, { url })
      );
    }) as unknown as typeof fetch);

    await Promise.all([
      httpClient.get('/transactions'),
      httpClient.get('/categories'),
    ]);

    const refreshCalls = fetchMock.mock.calls.filter(([url]) =>
      String(url).endsWith('/auth/refresh')
    );
    expect(refreshCalls).toHaveLength(1);
  });

  it('gives up and reports an auth failure when the refresh itself fails', async () => {
    const { httpClient, configureHttpClient, ApiError } = loadClient();
    const clientHooks = hooks();
    configureHttpClient(clientHooks);
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(401, { message: 'Invalid access token' })
      )
      .mockResolvedValueOnce(
        jsonResponse(401, { message: 'Invalid refresh token' })
      );

    const error = await httpClient
      .get('/transactions')
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(clientHooks.onAuthFailure).toHaveBeenCalledTimes(1);
    expect(clientHooks.onTokensRefreshed).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not try to refresh when there is no refresh token', async () => {
    const { httpClient, configureHttpClient } = loadClient();
    const clientHooks = hooks({ getRefreshToken: jest.fn(() => null) });
    configureHttpClient(clientHooks);
    fetchMock.mockResolvedValue(
      jsonResponse(401, { message: 'Missing access token' })
    );

    await expect(httpClient.get('/transactions')).rejects.toMatchObject({
      status: 401,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(clientHooks.onAuthFailure).toHaveBeenCalledTimes(1);
  });

  it('retries only once: a second 401 is surfaced', async () => {
    const { httpClient, configureHttpClient } = loadClient();
    configureHttpClient(hooks());
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(401, { message: 'Invalid access token' })
      )
      .mockResolvedValueOnce(jsonResponse(200, tokens))
      .mockResolvedValueOnce(
        jsonResponse(401, { message: 'Invalid access token' })
      );

    await expect(httpClient.get('/transactions')).rejects.toMatchObject({
      status: 401,
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('never refreshes for an unauthenticated request', async () => {
    const { httpClient, configureHttpClient } = loadClient();
    const clientHooks = hooks();
    configureHttpClient(clientHooks);
    fetchMock.mockResolvedValue(
      jsonResponse(401, { message: 'Invalid credentials' })
    );

    await expect(
      httpClient.post('/auth/login', {}, { auth: false })
    ).rejects.toMatchObject({ status: 401 });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(clientHooks.onAuthFailure).not.toHaveBeenCalled();
  });
});
