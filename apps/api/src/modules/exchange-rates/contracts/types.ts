import type { Currency } from '@expense-tracker/types';
import type { Prisma } from '../../../generated/prisma/client';

/**
 * One `base` unit costs `rates.get(code)` of each currency. Always has the
 * base (EUR, also the default currency); any other code the provider didn't
 * publish is missing.
 */
export interface ExchangeRatesSnapshot {
  base: Currency;
  /** When the provider last updated these rates. */
  date: Date;
  rates: ReadonlyMap<Currency, Prisma.Decimal>;
}
