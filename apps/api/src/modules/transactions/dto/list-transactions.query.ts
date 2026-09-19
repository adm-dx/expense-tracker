import { TransactionType } from '@prisma/client';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export const TRANSACTION_PAGE_SIZES = [10, 20, 50] as const;
export const DEFAULT_TRANSACTION_PAGE_SIZE = 10;
// `skip` is a 32-bit Int in Prisma: page * pageSize must stay below 2^31.
export const MAX_TRANSACTION_PAGE = 1_000_000;

export class ListTransactionsQuery {
  @IsOptional()
  @IsISO8601({ strict: true })
  dateFrom?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  dateTo?: string;

  @IsOptional()
  @IsEnum(TransactionType)
  type?: TransactionType;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_TRANSACTION_PAGE)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsIn(TRANSACTION_PAGE_SIZES)
  pageSize?: number;
}
