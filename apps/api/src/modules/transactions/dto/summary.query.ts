import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { CURRENCIES, type Currency } from '@expense-tracker/types';

/** The period and currency of a summary; also the query of the report by tag. */
export class SummaryPeriodQuery {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(12)
  month?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1970)
  @Max(9999)
  year?: number;

  @IsOptional()
  @IsISO8601({ strict: true })
  dateFrom?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  dateTo?: string;

  /** Currency of the totals; defaults to EUR. */
  @IsOptional()
  @IsIn(CURRENCIES)
  currency?: Currency;
}

export class SummaryQuery extends SummaryPeriodQuery {
  /** Only transactions carrying this tag. */
  @IsOptional()
  @IsString()
  tagId?: string;
}
