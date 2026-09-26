import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { ExchangeRatesSnapshot, GetExchangeRatesQuery } from '../contracts';
import { ExchangeRatesService } from '../exchange-rates.service';

@QueryHandler(GetExchangeRatesQuery)
export class GetExchangeRatesHandler implements IQueryHandler<
  GetExchangeRatesQuery,
  ExchangeRatesSnapshot
> {
  constructor(private readonly exchangeRatesService: ExchangeRatesService) {}

  execute(): Promise<ExchangeRatesSnapshot> {
    return this.exchangeRatesService.getRates();
  }
}
