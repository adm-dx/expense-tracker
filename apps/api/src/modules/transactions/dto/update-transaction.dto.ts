import { TransactionType } from '../../../generated/prisma/client';
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
  ValidateIf,
} from 'class-validator';
import { DESCRIPTION_MAX_LENGTH, MAX_AMOUNT } from './create-transaction.dto';

// Fields use ValidateIf instead of IsOptional so an explicit null is rejected;
// only description may be null (clears it).
export class UpdateTransactionDto {
  @ValidateIf((_, value) => value !== undefined)
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  @Max(MAX_AMOUNT)
  amount?: number;

  @ValidateIf((_, value) => value !== undefined)
  @IsEnum(TransactionType)
  type?: TransactionType;

  @IsOptional()
  @IsString()
  @MaxLength(DESCRIPTION_MAX_LENGTH)
  description?: string | null;

  @ValidateIf((_, value) => value !== undefined)
  @IsISO8601({ strict: true })
  date?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @IsNotEmpty()
  categoryId?: string;
}
