import { ServiceUnavailableException } from '@nestjs/common';
import type { Currency } from '@expense-tracker/types';
import type { Prisma } from '../../../generated/prisma/client';
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
  // The provider can stop publishing a code; that is its outage, not a bug.
  if (!fromRate || !toRate) {
    throw new ServiceUnavailableException(
      `No exchange rate for ${fromRate ? to : from}`
    );
  }
  return amount.times(toRate).dividedBy(fromRate);
}
