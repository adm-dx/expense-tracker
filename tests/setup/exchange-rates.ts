import { Currency, Prisma } from '@api/generated/prisma/client';
import type { ExchangeRatesSnapshot } from '@api/modules/exchange-rates/contracts';
import { ExchangeRatesProvider } from '@api/modules/exchange-rates/providers/exchange-rates.provider';

/** Round numbers so expected conversions are easy to work out by hand. */
export const TEST_RATES = { EUR: '1', RSD: '100', HUF: '400' } as const;
export const TEST_RATES_DATE = '2026-09-26T00:00:00.000Z';

/**
 * Stands in for the real provider in integration and e2e tests: no network,
 * fixed rates, and a switch to simulate an outage.
 */
export class FakeExchangeRatesProvider extends ExchangeRatesProvider {
  failing = false;
  calls = 0;

  fetchLatest(): Promise<ExchangeRatesSnapshot> {
    this.calls += 1;
    if (this.failing) {
      return Promise.reject(new Error('Simulated provider outage'));
    }
    return Promise.resolve({
      base: Currency.EUR,
      date: new Date(TEST_RATES_DATE),
      rates: new Map(
        Object.entries(TEST_RATES).map(([code, rate]) => [
          code as Currency,
          new Prisma.Decimal(rate),
        ])
      ),
    });
  }
}
