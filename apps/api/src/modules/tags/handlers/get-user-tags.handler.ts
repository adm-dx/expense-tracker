import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import { GetUserTagsQuery, UserTag } from '../contracts';
import { TagsRepository } from '../tags.repository';

@QueryHandler(GetUserTagsQuery)
export class GetUserTagsHandler implements IQueryHandler<
  GetUserTagsQuery,
  UserTag[]
> {
  constructor(private readonly tagsRepository: TagsRepository) {}

  async execute(query: GetUserTagsQuery): Promise<UserTag[]> {
    const tags = await this.tagsRepository.findManyByUser(query.userId);
    return tags.map(({ id, name }) => ({ id, name }));
  }
}
