import type { Currency } from '@expense-tracker/types';

export interface ConvertTransactionsCurrencyResult {
  /** How many transactions were converted. */
  converted: number;
}

/**
 * Converts every transaction of the user in `from` to `to` at today's rates
 * (amount and currency, rounded to cents). Asks for rates only when there is
 * something to convert; answers 503 when there are none.
 */
export class ConvertTransactionsCurrencyCommand {
  constructor(
    public readonly userId: string,
    public readonly from: Currency,
    public readonly to: Currency
  ) {}
}
