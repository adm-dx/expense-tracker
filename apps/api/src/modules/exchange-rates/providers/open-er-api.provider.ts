import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CURRENCIES,
  DEFAULT_CURRENCY,
  type Currency,
} from '@expense-tracker/types';
import { Prisma } from '../../../generated/prisma/client';
import type { ExchangeRatesSnapshot } from '../contracts';
import { ExchangeRatesProvider } from './exchange-rates.provider';

export const DEFAULT_EXCHANGE_RATES_URL = 'https://open.er-api.com/v6';
const BASE: Currency = 'EUR';
// Without these nothing converts: every other code is optional.
const REQUIRED: readonly Currency[] = [...new Set([BASE, DEFAULT_CURRENCY])];
const TIMEOUT_MS = 5000;

interface OpenErApiResponse {
  result?: string;
  time_last_update_unix?: number;
  rates?: Record<string, number>;
}

/**
 * ExchangeRate-API open access (https://www.exchangerate-api.com/docs/free):
 * no key, updated once a day, attribution required in the UI.
 */
@Injectable()
export class OpenErApiProvider extends ExchangeRatesProvider {
  private readonly logger = new Logger(OpenErApiProvider.name);
  private readonly baseUrl: string;

  constructor(configService: ConfigService) {
    super();
    this.baseUrl =
      configService.get<string>('EXCHANGE_RATES_URL') ??
      DEFAULT_EXCHANGE_RATES_URL;
  }

  async fetchLatest(): Promise<ExchangeRatesSnapshot> {
    const response = await fetch(`${this.baseUrl}/latest/${BASE}`, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      throw new Error(`Exchange rates request failed: HTTP ${response.status}`);
    }
    const body = (await response.json()) as OpenErApiResponse;
    if (body.result !== 'success' || !body.rates) {
      throw new Error(
        `Exchange rates request failed: ${body.result ?? 'no result'}`
      );
    }

    const rates = new Map<Currency, Prisma.Decimal>();
    const missing: Currency[] = [];
    for (const code of CURRENCIES) {
      const rate = body.rates[code];
      if (typeof rate === 'number' && rate > 0) {
        rates.set(code, new Prisma.Decimal(String(rate)));
      } else if (REQUIRED.includes(code)) {
        throw new Error(`Exchange rates response has no rate for ${code}`);
      } else {
        missing.push(code);
      }
    }
    if (missing.length > 0) {
      this.logger.warn(`No exchange rate for ${missing.join(', ')}`);
    }

    const updatedAt = body.time_last_update_unix;
    return {
      base: BASE,
      date: updatedAt ? new Date(updatedAt * 1000) : new Date(),
      rates,
    };
  }
}
