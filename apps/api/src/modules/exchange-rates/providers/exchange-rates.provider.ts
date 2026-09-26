import type { ExchangeRatesSnapshot } from '../contracts';

/**
 * Where the rates come from. An abstract class so it doubles as the DI token:
 * swap the source (or fake it in tests) by providing another implementation.
 */
export abstract class ExchangeRatesProvider {
  /** Latest rates for every supported currency; throws if any is missing. */
  abstract fetchLatest(): Promise<ExchangeRatesSnapshot>;
}
