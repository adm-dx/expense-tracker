import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import {
  RemoveTagFromTransactionsCommand,
  RemoveTagFromTransactionsResult,
} from '../contracts';
import { TransactionsRepository } from '../transactions.repository';

@CommandHandler(RemoveTagFromTransactionsCommand)
export class RemoveTagFromTransactionsHandler implements ICommandHandler<
  RemoveTagFromTransactionsCommand,
  RemoveTagFromTransactionsResult
> {
  constructor(
    private readonly transactionsRepository: TransactionsRepository
  ) {}

  async execute(
    command: RemoveTagFromTransactionsCommand
  ): Promise<RemoveTagFromTransactionsResult> {
    const updated = await this.transactionsRepository.removeTag(
      command.userId,
      command.tagId
    );
    return { updated };
  }
}
