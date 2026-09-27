import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CommandBus } from '@nestjs/cqrs';
import {
  DEFAULT_CURRENCY,
  DEFAULT_USER_SETTINGS,
  type Currency,
  type LocationSetting,
  type RemoveCurrencyResult,
  type UserSettings,
} from '@expense-tracker/types';
import {
  ConvertTransactionsCurrencyCommand,
  type ConvertTransactionsCurrencyResult,
} from '../transactions/contracts';
import { SettingsRepository } from './settings.repository';
import { LocationSettingDto } from './dto/location-setting.dto';
import { ReplaceSettingsDto } from './dto/replace-settings.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
import { roundCoordinate, sanitizeSettings } from './lib/sanitize-settings';

/**
 * Per-user settings, stored as one JSON document. Every user gets a row with
 * the defaults on registration (existing users by a migration); a missing
 * row still reads as the defaults, should that step ever have failed.
 */
@Injectable()
export class SettingsService {
  constructor(
    private readonly settingsRepository: SettingsRepository,
    private readonly commandBus: CommandBus
  ) {}

  async get(userId: string): Promise<UserSettings> {
    const row = await this.settingsRepository.findByUser(userId);
    return sanitizeSettings(row?.settings);
  }

  /** On registration: the defaults, unless the user already has settings. */
  createDefaults(userId: string): Promise<void> {
    return this.settingsRepository.createIfMissing(
      userId,
      DEFAULT_USER_SETTINGS
    );
  }

  /** Everything but `currencies`, which only its own endpoints change. */
  async replace(
    userId: string,
    dto: ReplaceSettingsDto
  ): Promise<UserSettings> {
    const { currencies } = await this.get(userId);
    this.assertEnabled(currencies, dto.currency);
    return this.save(userId, {
      theme: dto.theme,
      colorScheme: dto.colorScheme,
      currency: dto.currency,
      currencies,
      location: this.toLocation(dto.location),
    });
  }

  /**
   * Merges the given keys into the saved settings. Two concurrent updates of
   * different keys can overwrite each other: the last one wins.
   */
  async update(userId: string, dto: UpdateSettingsDto): Promise<UserSettings> {
    const next = await this.get(userId);
    // Key by key: the DTO instance has every property, the unset ones undefined.
    if (dto.theme !== undefined) next.theme = dto.theme;
    if (dto.colorScheme !== undefined) next.colorScheme = dto.colorScheme;
    if (dto.currency !== undefined) {
      this.assertEnabled(next.currencies, dto.currency);
      next.currency = dto.currency;
    }
    if (dto.location !== undefined) {
      next.location = this.toLocation(dto.location);
    }
    return this.save(userId, next);
  }

  /**
   * Back to the defaults, stored like any other settings. The enabled
   * currencies stay: dropping one would leave its transactions unconverted.
   */
  async reset(userId: string): Promise<UserSettings> {
    const { currencies } = await this.get(userId);
    return this.save(userId, { ...DEFAULT_USER_SETTINGS, currencies });
  }

  async addCurrency(userId: string, code: Currency): Promise<UserSettings> {
    const current = await this.get(userId);
    if (current.currencies.includes(code)) return current;
    return this.save(userId, {
      ...current,
      currencies: [...current.currencies, code],
    });
  }

  /**
   * Converts the currency's transactions to RSD at today's rates, then
   * disables it; the display currency falls back to RSD if it was this one.
   * Converting first means a rates outage (503) leaves everything as it was.
   */
  async removeCurrency(
    userId: string,
    code: Currency
  ): Promise<RemoveCurrencyResult> {
    if (code === DEFAULT_CURRENCY) {
      throw new BadRequestException(`${DEFAULT_CURRENCY} can't be removed`);
    }
    const current = await this.get(userId);
    if (!current.currencies.includes(code)) {
      throw new NotFoundException(`${code} is not one of your currencies`);
    }

    const { converted } = await this.commandBus.execute<
      ConvertTransactionsCurrencyCommand,
      ConvertTransactionsCurrencyResult
    >(new ConvertTransactionsCurrencyCommand(userId, code, DEFAULT_CURRENCY));

    const settings = await this.save(userId, {
      ...current,
      currencies: current.currencies.filter((currency) => currency !== code),
      currency: current.currency === code ? DEFAULT_CURRENCY : current.currency,
    });
    return { settings, convertedCount: converted };
  }

  private async save(
    userId: string,
    settings: UserSettings
  ): Promise<UserSettings> {
    const row = await this.settingsRepository.upsert(userId, settings);
    return sanitizeSettings(row.settings);
  }

  private assertEnabled(currencies: Currency[], currency: Currency): void {
    if (!currencies.includes(currency)) {
      throw new BadRequestException(
        `${currency} is not one of your currencies; add it first`
      );
    }
  }

  /** The validation pipe guarantees a manual location has all its fields. */
  private toLocation(dto: LocationSettingDto): LocationSetting {
    if (
      dto.mode === 'manual' &&
      dto.name !== undefined &&
      dto.lat !== undefined &&
      dto.lon !== undefined
    ) {
      return {
        mode: 'manual',
        name: dto.name.trim(),
        lat: roundCoordinate(dto.lat),
        lon: roundCoordinate(dto.lon),
      };
    }
    return { mode: 'auto' };
  }
}
