import {
  COLOR_SCHEMES,
  CURRENCIES,
  THEMES,
  type ColorScheme,
  type Currency,
  type Theme,
} from '@expense-tracker/types';
import { Type } from 'class-transformer';
import { IsDefined, IsIn, IsObject, ValidateNested } from 'class-validator';
import { LocationSettingDto } from './location-setting.dto';

// `PUT /settings`: the whole document, every key required.
export class ReplaceSettingsDto {
  @IsIn(THEMES)
  theme!: Theme;

  @IsIn(COLOR_SCHEMES)
  colorScheme!: ColorScheme;

  @IsIn(CURRENCIES)
  currency!: Currency;

  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => LocationSettingDto)
  location!: LocationSettingDto;
}
