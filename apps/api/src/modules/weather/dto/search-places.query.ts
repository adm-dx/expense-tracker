import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class SearchPlacesQuery {
  @Transform(trim)
  @IsString()
  @Length(2, 100)
  q!: string;
}
