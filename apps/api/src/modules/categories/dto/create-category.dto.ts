import { CATEGORY_ICONS, type CategoryIcon } from '@expense-tracker/types';
import {
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

export const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;

export class CreateCategoryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name!: string;

  // Categories are told apart by icon; the color is picked by the server if omitted.
  @IsOptional()
  @IsString()
  @Matches(HEX_COLOR_PATTERN, {
    message: 'color must be a hex color like #A1B2C3',
  })
  color?: string;

  @IsIn(CATEGORY_ICONS, { message: 'icon must be one of the category icons' })
  icon!: CategoryIcon;
}
