import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetUserCredentialsByIdQuery, UserCredentials } from '../contracts';
import { UsersService } from '../users.service';

@QueryHandler(GetUserCredentialsByIdQuery)
export class GetUserCredentialsByIdHandler
  implements IQueryHandler<GetUserCredentialsByIdQuery, UserCredentials | null>
{
  constructor(private readonly usersService: UsersService) {}

  execute(query: GetUserCredentialsByIdQuery): Promise<UserCredentials | null> {
    return this.usersService.getCredentialsById(query.id);
  }
}
