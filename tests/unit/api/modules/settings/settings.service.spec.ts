import {
  DEFAULT_USER_SETTINGS,
  type UserSettings,
} from '@expense-tracker/types';
import { plainToInstance } from 'class-transformer';
import { SettingsRepository } from '@api/modules/settings/settings.repository';
import { SettingsService } from '@api/modules/settings/settings.service';
import { UpdateSettingsDto } from '@api/modules/settings/dto/update-settings.dto';
import { ReplaceSettingsDto } from '@api/modules/settings/dto/replace-settings.dto';

const SAVED: UserSettings = {
  theme: 'dark',
  colorScheme: 'blue',
  currency: 'EUR',
  location: { mode: 'manual', name: 'Novi Sad, RS', lat: 45.25, lon: 19.84 },
};

function makeRow(settings: unknown) {
  return {
    userId: 'user-1',
    settings,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
  };
}

/** The DTO the validation pipe would hand the controller. */
function updateDto(body: object): UpdateSettingsDto {
  return plainToInstance(UpdateSettingsDto, body);
}

describe('SettingsService', () => {
  let repository: jest.Mocked<SettingsRepository>;
  let service: SettingsService;

  beforeEach(() => {
    repository = {
      findByUser: jest.fn(),
      upsert: jest
        .fn()
        .mockImplementation((_userId: string, settings: UserSettings) =>
          Promise.resolve(makeRow(settings))
        ),
      delete: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<SettingsRepository>;
    service = new SettingsService(repository);
  });

  describe('get', () => {
    it('returns the defaults for a user who never saved anything', async () => {
      repository.findByUser.mockResolvedValue(null);

      await expect(service.get('user-1')).resolves.toEqual(
        DEFAULT_USER_SETTINGS
      );
      expect(repository.findByUser).toHaveBeenCalledWith('user-1');
    });

    it('returns the saved settings', async () => {
      repository.findByUser.mockResolvedValue(makeRow(SAVED));

      await expect(service.get('user-1')).resolves.toEqual(SAVED);
    });
  });

  describe('update', () => {
    it('merges the given keys into the saved settings', async () => {
      repository.findByUser.mockResolvedValue(makeRow(SAVED));

      const result = await service.update(
        'user-1',
        updateDto({ theme: 'light' })
      );

      expect(result).toEqual({ ...SAVED, theme: 'light' });
      expect(repository.upsert).toHaveBeenCalledWith('user-1', {
        ...SAVED,
        theme: 'light',
      });
    });

    it('starts from the defaults when nothing is saved yet', async () => {
      repository.findByUser.mockResolvedValue(null);

      const result = await service.update(
        'user-1',
        updateDto({ currency: 'HUF' })
      );

      expect(result).toEqual({ ...DEFAULT_USER_SETTINGS, currency: 'HUF' });
    });

    it('replaces the location as a whole', async () => {
      repository.findByUser.mockResolvedValue(makeRow(SAVED));

      const result = await service.update(
        'user-1',
        updateDto({ location: { mode: 'auto' } })
      );

      expect(result.location).toEqual({ mode: 'auto' });
    });

    it('trims the place name and rounds its coordinates', async () => {
      repository.findByUser.mockResolvedValue(null);

      const result = await service.update(
        'user-1',
        updateDto({
          location: {
            mode: 'manual',
            name: '  Subotica, RS ',
            lat: 46.100472,
            lon: 19.667611,
          },
        })
      );

      expect(result.location).toEqual({
        mode: 'manual',
        name: 'Subotica, RS',
        lat: 46.1,
        lon: 19.67,
      });
    });

    it('drops fields an automatic location does not use', async () => {
      repository.findByUser.mockResolvedValue(null);

      const result = await service.update(
        'user-1',
        updateDto({ location: { mode: 'auto', name: 'Ignored', lat: 1 } })
      );

      expect(result.location).toEqual({ mode: 'auto' });
    });

    it('saves the current settings unchanged for an empty update', async () => {
      repository.findByUser.mockResolvedValue(makeRow(SAVED));

      await expect(service.update('user-1', updateDto({}))).resolves.toEqual(
        SAVED
      );
    });
  });

  describe('replace', () => {
    it('saves exactly the given settings', async () => {
      const dto = plainToInstance(ReplaceSettingsDto, SAVED);

      await expect(service.replace('user-1', dto)).resolves.toEqual(SAVED);
      expect(repository.findByUser).not.toHaveBeenCalled();
      expect(repository.upsert).toHaveBeenCalledWith('user-1', SAVED);
    });
  });

  describe('reset', () => {
    it('removes the saved settings and returns the defaults', async () => {
      await expect(service.reset('user-1')).resolves.toEqual(
        DEFAULT_USER_SETTINGS
      );
      expect(repository.delete).toHaveBeenCalledWith('user-1');
      expect(repository.upsert).not.toHaveBeenCalled();
    });
  });
});
