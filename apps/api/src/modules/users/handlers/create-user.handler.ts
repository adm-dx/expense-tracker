import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CreateUserCommand, PublicUser } from '../contracts';
import { UsersService } from '../users.service';

@CommandHandler(CreateUserCommand)
export class CreateUserHandler
  implements ICommandHandler<CreateUserCommand, PublicUser>
{
  constructor(private readonly usersService: UsersService) {}

  execute(command: CreateUserCommand): Promise<PublicUser> {
    return this.usersService.create({
      name: command.name,
      email: command.email,
      passwordHash: command.passwordHash,
    });
  }
}
