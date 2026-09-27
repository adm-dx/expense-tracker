import { Injectable } from '@nestjs/common';
import {
  DEFAULT_USER_SETTINGS,
  type LocationSetting,
  type UserSettings,
} from '@expense-tracker/types';
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
  constructor(private readonly settingsRepository: SettingsRepository) {}

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

  replace(userId: string, dto: ReplaceSettingsDto): Promise<UserSettings> {
    return this.save(userId, {
      theme: dto.theme,
      colorScheme: dto.colorScheme,
      currency: dto.currency,
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
    if (dto.currency !== undefined) next.currency = dto.currency;
    if (dto.location !== undefined) {
      next.location = this.toLocation(dto.location);
    }
    return this.save(userId, next);
  }

  /** Back to the defaults, stored like any other settings. */
  reset(userId: string): Promise<UserSettings> {
    return this.save(userId, DEFAULT_USER_SETTINGS);
  }

  private async save(
    userId: string,
    settings: UserSettings
  ): Promise<UserSettings> {
    const row = await this.settingsRepository.upsert(userId, settings);
    return sanitizeSettings(row.settings);
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
