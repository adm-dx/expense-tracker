import { ServiceUnavailableException } from '@nestjs/common';
import { Currency, Prisma } from '@api/generated/prisma/client';
import {
  convertAmount,
  ExchangeRatesSnapshot,
} from '@api/modules/exchange-rates/contracts';
import {
  ExchangeRatesService,
  RETRY_AFTER_FAILURE_MS,
} from '@api/modules/exchange-rates/exchange-rates.service';
import { ExchangeRatesProvider } from '@api/modules/exchange-rates/providers/exchange-rates.provider';

function makeSnapshot(rsd = '117.5'): ExchangeRatesSnapshot {
  return {
    base: Currency.EUR,
    date: new Date('2026-09-26T00:00:00.000Z'),
    rates: new Map([
      [Currency.EUR, new Prisma.Decimal('1')],
      [Currency.RSD, new Prisma.Decimal(rsd)],
      [Currency.HUF, new Prisma.Decimal('400')],
    ]),
  };
}

describe('ExchangeRatesService', () => {
  let provider: { fetchLatest: jest.Mock };
  let service: ExchangeRatesService;

  beforeEach(() => {
    jest.useFakeTimers({ now: new Date('2026-09-26T10:00:00.000Z') });
    provider = { fetchLatest: jest.fn().mockResolvedValue(makeSnapshot()) };
    service = new ExchangeRatesService(
      provider as unknown as ExchangeRatesProvider
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('fetches once per UTC day', async () => {
    await service.getRates();
    jest.setSystemTime(new Date('2026-09-26T23:59:59.000Z'));
    await service.getRates();

    expect(provider.fetchLatest).toHaveBeenCalledTimes(1);
  });

  it('fetches again on the next UTC day', async () => {
    await service.getRates();
    provider.fetchLatest.mockResolvedValue(makeSnapshot('118'));
    jest.setSystemTime(new Date('2026-09-27T00:00:01.000Z'));

    const rates = await service.getRates();

    expect(provider.fetchLatest).toHaveBeenCalledTimes(2);
    expect(rates.rates.get(Currency.RSD)?.toString()).toBe('118');
  });

  it('shares one request between concurrent callers', async () => {
    const [first, second] = await Promise.all([
      service.getRates(),
      service.getRates(),
    ]);

    expect(provider.fetchLatest).toHaveBeenCalledTimes(1);
    expect(first).toBe(second);
  });

  it('throws ServiceUnavailableException when nothing was ever fetched', async () => {
    provider.fetchLatest.mockRejectedValue(new Error('network down'));

    await expect(service.getRates()).rejects.toBeInstanceOf(
      ServiceUnavailableException
    );
  });

  it('retries after a failure with an empty cache', async () => {
    provider.fetchLatest.mockRejectedValueOnce(new Error('network down'));
    await expect(service.getRates()).rejects.toBeInstanceOf(
      ServiceUnavailableException
    );

    await expect(service.getRates()).resolves.toEqual(makeSnapshot());
  });

  it("serves yesterday's rates when today's fetch fails", async () => {
    const yesterday = await service.getRates();
    provider.fetchLatest.mockRejectedValue(new Error('network down'));
    jest.setSystemTime(new Date('2026-09-27T08:00:00.000Z'));

    await expect(service.getRates()).resolves.toBe(yesterday);
  });

  it('waits before asking a failing provider again', async () => {
    await service.getRates();
    provider.fetchLatest.mockRejectedValue(new Error('network down'));
    jest.setSystemTime(new Date('2026-09-27T08:00:00.000Z'));
    await service.getRates();
    expect(provider.fetchLatest).toHaveBeenCalledTimes(2);

    await service.getRates();
    expect(provider.fetchLatest).toHaveBeenCalledTimes(2);

    jest.advanceTimersByTime(RETRY_AFTER_FAILURE_MS);
    provider.fetchLatest.mockResolvedValue(makeSnapshot('118'));
    const rates = await service.getRates();
    expect(provider.fetchLatest).toHaveBeenCalledTimes(3);
    expect(rates.rates.get(Currency.RSD)?.toString()).toBe('118');
  });
});

describe('convertAmount', () => {
  const snapshot = makeSnapshot();

  it('returns the amount unchanged for the same currency', () => {
    const amount = new Prisma.Decimal('12.34');
    expect(convertAmount(amount, Currency.HUF, Currency.HUF, snapshot)).toBe(
      amount
    );
  });

  it('converts from the base currency', () => {
    expect(
      convertAmount(
        new Prisma.Decimal('10'),
        Currency.EUR,
        Currency.RSD,
        snapshot
      ).toString()
    ).toBe('1175');
  });

  it('converts between two non-base currencies through the base', () => {
    expect(
      convertAmount(
        new Prisma.Decimal('400'),
        Currency.HUF,
        Currency.RSD,
        snapshot
      ).toString()
    ).toBe('117.5');
  });

  it('does not round', () => {
    expect(
      convertAmount(
        new Prisma.Decimal('1'),
        Currency.RSD,
        Currency.EUR,
        snapshot
      ).toFixed(6)
    ).toBe('0.008511');
  });
});
