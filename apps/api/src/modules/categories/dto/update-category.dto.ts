import { CATEGORY_ICONS, type CategoryIcon } from '@expense-tracker/types';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

// Only the name and the icon can be changed.
export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name?: string;

  @IsOptional()
  @IsIn(CATEGORY_ICONS, { message: 'icon must be one of the category icons' })
  icon?: CategoryIcon;
}
