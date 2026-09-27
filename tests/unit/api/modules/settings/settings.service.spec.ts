import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { CommandBus } from '@nestjs/cqrs';
import {
  DEFAULT_USER_SETTINGS,
  type UserSettings,
} from '@expense-tracker/types';
import { plainToInstance } from 'class-transformer';
import type { Prisma } from '@api/generated/prisma/client';
import { ConvertTransactionsCurrencyCommand } from '@api/modules/transactions/contracts';
import { SettingsRepository } from '@api/modules/settings/settings.repository';
import { SettingsService } from '@api/modules/settings/settings.service';
import { UpdateSettingsDto } from '@api/modules/settings/dto/update-settings.dto';
import { ReplaceSettingsDto } from '@api/modules/settings/dto/replace-settings.dto';

const SAVED: UserSettings = {
  theme: 'dark',
  colorScheme: 'blue',
  currency: 'EUR',
  currencies: ['RSD', 'EUR', 'USD'],
  location: { mode: 'manual', name: 'Novi Sad, RS', lat: 45.25, lon: 19.84 },
};

function makeRow(settings: unknown) {
  return {
    userId: 'user-1',
    settings: settings as Prisma.JsonValue,
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
  let commandBus: { execute: jest.Mock };
  let service: SettingsService;

  beforeEach(() => {
    repository = {
      findByUser: jest.fn(),
      upsert: jest
        .fn()
        .mockImplementation((_userId: string, settings: UserSettings) =>
          Promise.resolve(makeRow(settings))
        ),
      createIfMissing: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<SettingsRepository>;
    commandBus = { execute: jest.fn().mockResolvedValue({ converted: 0 }) };
    service = new SettingsService(
      repository,
      commandBus as unknown as CommandBus
    );
  });

  describe('get', () => {
    it('returns the defaults when the user has no row', async () => {
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

    it('rejects a display currency the user has not enabled', async () => {
      repository.findByUser.mockResolvedValue(makeRow(SAVED));

      await expect(
        service.update('user-1', updateDto({ currency: 'HUF' }))
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(repository.upsert).not.toHaveBeenCalled();
    });

    it('saves the current settings unchanged for an empty update', async () => {
      repository.findByUser.mockResolvedValue(makeRow(SAVED));

      await expect(service.update('user-1', updateDto({}))).resolves.toEqual(
        SAVED
      );
    });
  });

  describe('replace', () => {
    it('saves exactly the given settings, keeping the currencies', async () => {
      repository.findByUser.mockResolvedValue(makeRow(SAVED));
      const { currencies: _kept, ...body } = SAVED;
      const dto = plainToInstance(ReplaceSettingsDto, body);

      await expect(service.replace('user-1', dto)).resolves.toEqual(SAVED);
      expect(repository.upsert).toHaveBeenCalledWith('user-1', SAVED);
    });

    it('rejects a display currency the user has not enabled', async () => {
      repository.findByUser.mockResolvedValue(makeRow(SAVED));
      const { currencies: _kept, ...body } = SAVED;
      const dto = plainToInstance(ReplaceSettingsDto, {
        ...body,
        currency: 'HUF',
      });

      await expect(service.replace('user-1', dto)).rejects.toBeInstanceOf(
        BadRequestException
      );
    });
  });

  describe('reset', () => {
    it('stores the defaults and returns them', async () => {
      repository.findByUser.mockResolvedValue(null);

      await expect(service.reset('user-1')).resolves.toEqual(
        DEFAULT_USER_SETTINGS
      );
      expect(repository.upsert).toHaveBeenCalledWith(
        'user-1',
        DEFAULT_USER_SETTINGS
      );
    });

    it('keeps the enabled currencies', async () => {
      repository.findByUser.mockResolvedValue(makeRow(SAVED));

      await expect(service.reset('user-1')).resolves.toEqual({
        ...DEFAULT_USER_SETTINGS,
        currencies: SAVED.currencies,
      });
    });
  });

  describe('addCurrency', () => {
    it('appends the currency to the list', async () => {
      repository.findByUser.mockResolvedValue(makeRow(SAVED));

      const result = await service.addCurrency('user-1', 'GBP');

      expect(result.currencies).toEqual(['RSD', 'EUR', 'USD', 'GBP']);
      expect(repository.upsert).toHaveBeenCalledWith('user-1', {
        ...SAVED,
        currencies: ['RSD', 'EUR', 'USD', 'GBP'],
      });
    });

    it('changes nothing for a currency that is already enabled', async () => {
      repository.findByUser.mockResolvedValue(makeRow(SAVED));

      await expect(service.addCurrency('user-1', 'EUR')).resolves.toEqual(
        SAVED
      );
      expect(repository.upsert).not.toHaveBeenCalled();
    });
  });

  describe('removeCurrency', () => {
    it('converts the transactions to RSD, then drops the currency', async () => {
      repository.findByUser.mockResolvedValue(makeRow(SAVED));
      commandBus.execute.mockResolvedValue({ converted: 3 });

      const result = await service.removeCurrency('user-1', 'USD');

      expect(commandBus.execute).toHaveBeenCalledWith(
        new ConvertTransactionsCurrencyCommand('user-1', 'USD', 'RSD')
      );
      expect(result).toEqual({
        settings: { ...SAVED, currencies: ['RSD', 'EUR'] },
        convertedCount: 3,
      });
    });

    it('switches the display currency to RSD when it is the one removed', async () => {
      repository.findByUser.mockResolvedValue(makeRow(SAVED));

      const { settings } = await service.removeCurrency('user-1', 'EUR');

      expect(settings.currency).toBe('RSD');
      expect(settings.currencies).toEqual(['RSD', 'USD']);
    });

    it('keeps the currency when the conversion fails', async () => {
      repository.findByUser.mockResolvedValue(makeRow(SAVED));
      commandBus.execute.mockRejectedValue(new ServiceUnavailableException());

      await expect(
        service.removeCurrency('user-1', 'USD')
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
      expect(repository.upsert).not.toHaveBeenCalled();
    });

    it('refuses to remove RSD', async () => {
      await expect(
        service.removeCurrency('user-1', 'RSD')
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(commandBus.execute).not.toHaveBeenCalled();
    });

    it('answers 404 for a currency that is not enabled', async () => {
      repository.findByUser.mockResolvedValue(makeRow(SAVED));

      await expect(
        service.removeCurrency('user-1', 'GBP')
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(commandBus.execute).not.toHaveBeenCalled();
    });
  });

  describe('createDefaults', () => {
    it('stores the defaults without overwriting existing settings', async () => {
      await service.createDefaults('user-1');

      expect(repository.createIfMissing).toHaveBeenCalledWith(
        'user-1',
        DEFAULT_USER_SETTINGS
      );
      expect(repository.upsert).not.toHaveBeenCalled();
    });
  });
});
