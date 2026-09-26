import type { Currency, Prisma } from '../../../generated/prisma/client';
import type { ExchangeRatesSnapshot } from './types';

/**
 * Converts through the snapshot's base currency. Not rounded: callers round
 * once, at the end, so a sum of conversions doesn't accumulate errors.
 */
export function convertAmount(
  amount: Prisma.Decimal,
  from: Currency,
  to: Currency,
  snapshot: ExchangeRatesSnapshot
): Prisma.Decimal {
  if (from === to) return amount;
  const fromRate = snapshot.rates.get(from);
  const toRate = snapshot.rates.get(to);
  if (!fromRate || !toRate) {
    throw new Error(`No exchange rate for ${fromRate ? to : from}`);
  }
  return amount.times(toRate).dividedBy(fromRate);
}
