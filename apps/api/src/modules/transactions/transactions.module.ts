import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ConvertTransactionsCurrencyHandler } from './handlers/convert-transactions-currency.handler';
import { TransactionsController } from './transactions.controller';
import { TransactionsRepository } from './transactions.repository';
import { TransactionsService } from './transactions.service';

@Module({
  imports: [CqrsModule],
  controllers: [TransactionsController],
  providers: [
    TransactionsRepository,
    TransactionsService,
    ConvertTransactionsCurrencyHandler,
  ],
})
export class TransactionsModule {}
