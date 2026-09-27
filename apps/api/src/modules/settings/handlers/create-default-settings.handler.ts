import { CommandHandler, ICommandHandler } from '@nestjs/cqrs';
import { CreateDefaultSettingsCommand } from '../contracts';
import { SettingsService } from '../settings.service';

@CommandHandler(CreateDefaultSettingsCommand)
export class CreateDefaultSettingsHandler
  implements ICommandHandler<CreateDefaultSettingsCommand, void>
{
  constructor(private readonly settingsService: SettingsService) {}

  execute(command: CreateDefaultSettingsCommand): Promise<void> {
    return this.settingsService.createDefaults(command.userId);
  }
}
