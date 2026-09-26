import { ConfigService } from '@nestjs/config';
import { Currency } from '@api/generated/prisma/client';
import {
  DEFAULT_EXCHANGE_RATES_URL,
  OpenErApiProvider,
} from '@api/modules/exchange-rates/providers/open-er-api.provider';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const SUCCESS = {
  result: 'success',
  time_last_update_unix: 1790380952,
  rates: { EUR: 1, RSD: 117.479499, HUF: 364.893326, USD: 1.17 },
};

describe('OpenErApiProvider', () => {
  let fetchMock: jest.SpiedFunction<typeof fetch>;

  function makeProvider(url?: string) {
    const config = { get: jest.fn().mockReturnValue(url) };
    return new OpenErApiProvider(config as unknown as ConfigService);
  }

  beforeEach(() => {
    fetchMock = jest.spyOn(global, 'fetch');
  });

  afterEach(() => {
    fetchMock.mockRestore();
  });

  it('requests EUR-based rates and keeps only the supported currencies', async () => {
    fetchMock.mockResolvedValue(jsonResponse(SUCCESS));

    const snapshot = await makeProvider().fetchLatest();

    expect(fetchMock).toHaveBeenCalledWith(
      `${DEFAULT_EXCHANGE_RATES_URL}/latest/EUR`,
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    expect(snapshot.base).toBe(Currency.EUR);
    expect(snapshot.date).toEqual(new Date(1790380952 * 1000));
    expect([...snapshot.rates.keys()].sort()).toEqual(['EUR', 'HUF', 'RSD']);
    expect(snapshot.rates.get(Currency.RSD)?.toString()).toBe('117.479499');
  });

  it('uses EXCHANGE_RATES_URL when it is set', async () => {
    fetchMock.mockResolvedValue(jsonResponse(SUCCESS));

    await makeProvider('http://rates.test/v6').fetchLatest();

    expect(fetchMock).toHaveBeenCalledWith(
      'http://rates.test/v6/latest/EUR',
      expect.anything()
    );
  });

  it('rejects an error result', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ result: 'error', 'error-type': 'unsupported-code' })
    );

    await expect(makeProvider().fetchLatest()).rejects.toThrow(
      'Exchange rates request failed: error'
    );
  });

  it('rejects a response without one of the currencies', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ ...SUCCESS, rates: { EUR: 1, HUF: 364.89 } })
    );

    await expect(makeProvider().fetchLatest()).rejects.toThrow(
      'no rate for RSD'
    );
  });

  it('rejects a non-2xx response', async () => {
    fetchMock.mockResolvedValue(jsonResponse({}, 503));

    await expect(makeProvider().fetchLatest()).rejects.toThrow('HTTP 503');
  });

  it('passes a network failure or timeout through', async () => {
    fetchMock.mockRejectedValue(
      new DOMException('The operation was aborted', 'TimeoutError')
    );

    await expect(makeProvider().fetchLatest()).rejects.toThrow('aborted');
  });
});
