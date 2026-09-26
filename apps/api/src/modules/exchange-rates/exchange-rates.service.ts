import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { ExchangeRatesSnapshot } from './contracts';
import { ExchangeRatesProvider } from './providers/exchange-rates.provider';

/** How long to wait before asking a failing provider again. */
export const RETRY_AFTER_FAILURE_MS = 10 * 60 * 1000;

function utcDay(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

/**
 * Today's rates, fetched at most once per UTC day. When the provider is down,
 * the last good rates are served (their `date` says how old they are).
 */
@Injectable()
export class ExchangeRatesService {
  private readonly logger = new Logger(ExchangeRatesService.name);
  private cached: { day: string; snapshot: ExchangeRatesSnapshot } | null =
    null;
  private inFlight: Promise<ExchangeRatesSnapshot> | null = null;
  private lastFailureAt: number | null = null;

  constructor(private readonly provider: ExchangeRatesProvider) {}

  async getRates(): Promise<ExchangeRatesSnapshot> {
    const now = Date.now();
    if (this.cached?.day === utcDay(now)) {
      return this.cached.snapshot;
    }
    // Stale rates beat hammering a provider that has just failed.
    if (
      this.cached &&
      this.lastFailureAt !== null &&
      now - this.lastFailureAt < RETRY_AFTER_FAILURE_MS
    ) {
      return this.cached.snapshot;
    }
    // Concurrent callers share one request.
    this.inFlight ??= this.refresh().finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  private async refresh(): Promise<ExchangeRatesSnapshot> {
    try {
      const snapshot = await this.provider.fetchLatest();
      this.cached = { day: utcDay(Date.now()), snapshot };
      this.lastFailureAt = null;
      return snapshot;
    } catch (error) {
      this.lastFailureAt = Date.now();
      const reason = error instanceof Error ? error.message : String(error);
      if (this.cached) {
        this.logger.warn(
          `Serving exchange rates from ${this.cached.day}: ${reason}`
        );
        return this.cached.snapshot;
      }
      this.logger.error(`Exchange rates are unavailable: ${reason}`);
      throw new ServiceUnavailableException('Exchange rates are unavailable');
    }
  }
}
