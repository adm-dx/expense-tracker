import { Type } from 'class-transformer';
import { IsInt, Max, Min } from 'class-validator';

export class SummaryQuery {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1970)
  @Max(9999)
  year!: number;
}
