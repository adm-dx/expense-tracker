import { Transform } from 'class-transformer';
import { IsLatitude, IsLongitude } from 'class-validator';

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
}
