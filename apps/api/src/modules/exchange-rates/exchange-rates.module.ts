import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ExchangeRatesController } from './exchange-rates.controller';
import { ExchangeRatesService } from './exchange-rates.service';
import { GetExchangeRatesHandler } from './handlers/get-exchange-rates.handler';
import { ExchangeRatesProvider } from './providers/exchange-rates.provider';
import { OpenErApiProvider } from './providers/open-er-api.provider';

@Module({
  imports: [CqrsModule],
  controllers: [ExchangeRatesController],
  providers: [
    { provide: ExchangeRatesProvider, useClass: OpenErApiProvider },
    ExchangeRatesService,
    GetExchangeRatesHandler,
  ],
})
export class ExchangeRatesModule {}
