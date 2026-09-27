import { Module } from '@nestjs/common';
import { CqrsModule } from '@nestjs/cqrs';
import { CreateDefaultSettingsHandler } from './handlers/create-default-settings.handler';
import { GetUserSettingsHandler } from './handlers/get-user-settings.handler';
import { SettingsController } from './settings.controller';
import { SettingsRepository } from './settings.repository';
import { SettingsService } from './settings.service';

@Module({
  imports: [CqrsModule],
  controllers: [SettingsController],
  providers: [
    SettingsRepository,
    SettingsService,
    CreateDefaultSettingsHandler,
    GetUserSettingsHandler,
  ],
})
export class SettingsModule {}
