import { CreateDefaultSettingsCommand } from '@api/modules/settings/contracts';
import { CreateDefaultSettingsHandler } from '@api/modules/settings/handlers/create-default-settings.handler';
import { SettingsService } from '@api/modules/settings/settings.service';

describe('CreateDefaultSettingsHandler', () => {
  it('delegates to SettingsService.createDefaults', async () => {
    const settingsService = {
      createDefaults: jest.fn().mockResolvedValue(undefined),
    } as unknown as SettingsService;
    const handler = new CreateDefaultSettingsHandler(settingsService);

    await handler.execute(new CreateDefaultSettingsCommand('user-1'));

    expect(settingsService.createDefaults).toHaveBeenCalledWith('user-1');
  });
});
