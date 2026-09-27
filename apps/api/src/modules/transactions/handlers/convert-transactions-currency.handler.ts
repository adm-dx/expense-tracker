import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import {
  ConvertTransactionsCurrencyCommand,
  ConvertTransactionsCurrencyResult,
} from '../contracts';
import { TransactionsService } from '../transactions.service';

@CommandHandler(ConvertTransactionsCurrencyCommand)
export class ConvertTransactionsCurrencyHandler implements ICommandHandler<
  ConvertTransactionsCurrencyCommand,
  ConvertTransactionsCurrencyResult
> {
  constructor(private readonly transactionsService: TransactionsService) {}

  async execute(
    command: ConvertTransactionsCurrencyCommand
  ): Promise<ConvertTransactionsCurrencyResult> {
    const converted = await this.transactionsService.convertCurrency(
      command.userId,
      command.from,
      command.to
    );
    return { converted };
  }
}
