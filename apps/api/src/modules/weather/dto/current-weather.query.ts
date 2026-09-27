import { Transform } from 'class-transformer';
import { IsIn, IsLatitude, IsLongitude, IsOptional } from 'class-validator';

// Unlike `@Type(() => Number)`, keeps `?lat=` from turning into 0 (the equator).
const toNumber = ({ value }: { value: unknown }) =>
  typeof value === 'string' && value.trim() !== '' ? Number(value) : value;

export class CurrentWeatherQuery {
  @Transform(toNumber)
  @IsLatitude()
  lat!: number;

  @Transform(toNumber)
  @IsLongitude()
  lon!: number;

  /** `1`: skip the weather cache if it's older than `MIN_REFRESH_INTERVAL_MS`. */
  @IsOptional()
  @IsIn(['1'])
  refresh?: '1';
}
