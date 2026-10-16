import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { GetUserTagsHandler } from './handlers/get-user-tags.handler';
import { TagsController } from './tags.controller';
import { TagsRepository } from './tags.repository';
import { TagsService } from './tags.service';

@Module({
  imports: [CqrsModule],
  controllers: [TagsController],
  providers: [TagsRepository, TagsService, GetUserTagsHandler],
})
export class TagsModule {}
