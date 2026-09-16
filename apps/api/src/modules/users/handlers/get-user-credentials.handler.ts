import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetUserCredentialsQuery, UserCredentials } from '../contracts';
import { UsersService } from '../users.service';

@QueryHandler(GetUserCredentialsQuery)
export class GetUserCredentialsHandler
  implements IQueryHandler<GetUserCredentialsQuery, UserCredentials | null>
{
  constructor(private readonly usersService: UsersService) {}

  execute(query: GetUserCredentialsQuery): Promise<UserCredentials | null> {
    return this.usersService.getCredentials(query.email);
  }
}
