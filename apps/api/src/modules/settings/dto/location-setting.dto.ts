import { LOCATION_MODES, type LocationMode } from '@expense-tracker/types';
import {
  IsIn,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsNumber,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';

const isManual = (location: LocationSettingDto) => location.mode === 'manual';

// `auto` needs nothing else; `manual` needs the place's name and coordinates.
export class LocationSettingDto {
  @IsIn(LOCATION_MODES)
  mode!: LocationMode;

  @ValidateIf(isManual)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @ValidateIf(isManual)
  @IsNumber()
  @IsLatitude()
  lat?: number;

  @ValidateIf(isManual)
  @IsNumber()
  @IsLongitude()
  lon?: number;
}
