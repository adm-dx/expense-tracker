import {
  COLOR_SCHEMES,
  CURRENCIES,
  THEMES,
  type ColorScheme,
  type Currency,
  type Theme,
} from '@expense-tracker/types';
import { Type } from 'class-transformer';
import { IsIn, IsObject, IsOptional, ValidateNested } from 'class-validator';
import { LocationSettingDto } from './location-setting.dto';

// `PATCH /settings`: any subset of keys; `location` is replaced as a whole.
export class UpdateSettingsDto {
  @IsOptional()
  @IsIn(THEMES)
  theme?: Theme;

  @IsOptional()
  @IsIn(COLOR_SCHEMES)
  colorScheme?: ColorScheme;

  @IsOptional()
  @IsIn(CURRENCIES)
  currency?: Currency;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => LocationSettingDto)
  location?: LocationSettingDto;
}
