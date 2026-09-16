import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { CategoriesController } from './categories.controller';
import { CategoriesRepository } from './categories.repository';
import { CategoriesService } from './categories.service';
import { CreateDefaultCategoriesHandler } from './handlers/create-default-categories.handler';

@Module({
  imports: [CqrsModule],
  controllers: [CategoriesController],
  providers: [
    CategoriesRepository,
    CategoriesService,
    CreateDefaultCategoriesHandler,
  ],
})
export class CategoriesModule {}
