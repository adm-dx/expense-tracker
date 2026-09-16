import { EventsHandler, IEventHandler } from '@nestjs/cqrs';
import { UserLoggedInEvent } from '../../auth/contracts';
import { UsersService } from '../users.service';

@EventsHandler(UserLoggedInEvent)
export class UserLoggedInHandler implements IEventHandler<UserLoggedInEvent> {
  constructor(private readonly usersService: UsersService) {}

  async handle(event: UserLoggedInEvent): Promise<void> {
    await this.usersService.markLoggedIn(event.userId);
  }
}
