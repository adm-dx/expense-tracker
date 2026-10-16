import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import {
  CountTransactionsByTagQuery,
  TransactionCountByTag,
} from '../contracts';
import { TransactionsRepository } from '../transactions.repository';

@QueryHandler(CountTransactionsByTagQuery)
export class CountTransactionsByTagHandler implements IQueryHandler<
  CountTransactionsByTagQuery,
  TransactionCountByTag
> {
  constructor(
    private readonly transactionsRepository: TransactionsRepository
  ) {}

  execute(query: CountTransactionsByTagQuery): Promise<TransactionCountByTag> {
    return this.transactionsRepository.countByTag(query.userId);
  }
}
