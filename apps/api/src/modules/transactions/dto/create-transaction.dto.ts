import { TransactionType } from '@prisma/client';
import {
  IsEnum,
  IsISO8601,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Max,
  MaxLength,
} from 'class-validator';

// Upper bound of the Decimal(12, 2) column.
export const MAX_AMOUNT = 9_999_999_999.99;
export const DESCRIPTION_MAX_LENGTH = 255;

export class CreateTransactionDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Max(MAX_AMOUNT)
  amount!: number;

  @IsEnum(TransactionType)
  type!: TransactionType;

  @IsOptional()
  @IsString()
  @MaxLength(DESCRIPTION_MAX_LENGTH)
  description?: string;

  @IsISO8601({ strict: true })
  date!: string;

  @IsString()
  @IsNotEmpty()
  categoryId!: string;
}
