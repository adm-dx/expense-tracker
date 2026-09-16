import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { UsersRepository } from './users.repository';
import { UsersService } from './users.service';
import { UsersHandlers } from './handlers';

@Module({
  imports: [CqrsModule],
  providers: [UsersRepository, UsersService, ...UsersHandlers],
})
export class UsersModule {}
