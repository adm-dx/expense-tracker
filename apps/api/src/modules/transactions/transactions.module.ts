import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { ConvertTransactionsCurrencyHandler } from './handlers/convert-transactions-currency.handler';
import { CountTransactionsByTagHandler } from './handlers/count-transactions-by-tag.handler';
import { RemoveTagFromTransactionsHandler } from './handlers/remove-tag-from-transactions.handler';
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
    RemoveTagFromTransactionsHandler,
    CountTransactionsByTagHandler,
  ],
})
export class TransactionsModule {}
