import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetUserByIdQuery, PublicUser } from '../contracts';
import { UsersService } from '../users.service';

@QueryHandler(GetUserByIdQuery)
export class GetUserByIdHandler
  implements IQueryHandler<GetUserByIdQuery, PublicUser | null>
{
  constructor(private readonly usersService: UsersService) {}

  execute(query: GetUserByIdQuery): Promise<PublicUser | null> {
    return this.usersService.findById(query.id);
  }
}
