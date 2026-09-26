import type { Currency, Prisma } from '../../../generated/prisma/client';

/** One `base` unit costs `rates.get(code)` of each supported currency. */
export interface ExchangeRatesSnapshot {
  base: Currency;
  /** When the provider last updated these rates. */
  date: Date;
  rates: ReadonlyMap<Currency, Prisma.Decimal>;
}
