import { Controller, Get } from '@nestjs/common';
import type { Currency } from '@expense-tracker/types';
import { ExchangeRatesService } from './exchange-rates.service';

export interface PublicExchangeRates {
  base: Currency;
  date: Date;
  rates: Partial<Record<Currency, string>>;
}

@Controller('exchange-rates')
export class ExchangeRatesController {
  constructor(private readonly exchangeRatesService: ExchangeRatesService) {}

  @Get()
  async get(): Promise<PublicExchangeRates> {
    const snapshot = await this.exchangeRatesService.getRates();
    const rates: Partial<Record<Currency, string>> = {};
    for (const [code, rate] of snapshot.rates) {
      rates[code] = rate.toString();
    }
    return { base: snapshot.base, date: snapshot.date, rates };
  }
}
