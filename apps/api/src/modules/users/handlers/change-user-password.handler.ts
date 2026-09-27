import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { ChangeUserPasswordCommand } from '../contracts';
import { UsersService } from '../users.service';

@CommandHandler(ChangeUserPasswordCommand)
export class ChangeUserPasswordHandler
  implements ICommandHandler<ChangeUserPasswordCommand, void>
{
  constructor(private readonly usersService: UsersService) {}

  execute(command: ChangeUserPasswordCommand): Promise<void> {
    return this.usersService.changePassword(
      command.userId,
      command.passwordHash,
    );
  }
}
