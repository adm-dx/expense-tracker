import { IQueryHandler, QueryHandler } from '@nestjs/cqrs';
import type { UserSettings } from '@expense-tracker/types';
import { GetUserSettingsQuery } from '../contracts';
import { SettingsService } from '../settings.service';

@QueryHandler(GetUserSettingsQuery)
export class GetUserSettingsHandler implements IQueryHandler<
  GetUserSettingsQuery,
  UserSettings
> {
  constructor(private readonly settingsService: SettingsService) {}

  execute(query: GetUserSettingsQuery): Promise<UserSettings> {
    return this.settingsService.get(query.userId);
  }
}
