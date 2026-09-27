import { CURRENCIES, type Currency } from '@expense-tracker/types';
import { Prisma } from '@api/generated/prisma/client';
import type { ExchangeRatesSnapshot } from '@api/modules/exchange-rates/contracts';
import { ExchangeRatesProvider } from '@api/modules/exchange-rates/providers/exchange-rates.provider';

/**
 * Round numbers so expected conversions are easy to work out by hand. Every
 * other code in the catalog costs `OTHER_TEST_RATE` per euro.
 */
export const TEST_RATES = {
  EUR: '1',
  RSD: '100',
  HUF: '400',
  USD: '2',
} as const;
export const OTHER_TEST_RATE = '10';

function testRate(code: Currency): string {
  return (
    (TEST_RATES as Partial<Record<Currency, string>>)[code] ?? OTHER_TEST_RATE
  );
}
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
      base: 'EUR',
      date: new Date(TEST_RATES_DATE),
      rates: new Map(
        CURRENCIES.map((code) => [code, new Prisma.Decimal(testRate(code))])
      ),
    });
  }
}
