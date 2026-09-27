import { CURRENCIES, type Currency } from '@expense-tracker/types';

/** Narrows a select's string value to a known currency code. */
export function isCurrency(value: unknown): value is Currency {
  return (CURRENCIES as readonly unknown[]).includes(value);
}
