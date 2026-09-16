import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';
import { HEX_COLOR_PATTERN, ICON_KEY_PATTERN } from './create-category.dto';

export class UpdateCategoryDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name?: string;

  @IsOptional()
  @IsString()
  @Matches(HEX_COLOR_PATTERN, {
    message: 'color must be a hex color like #A1B2C3',
  })
  color?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  @Matches(ICON_KEY_PATTERN, { message: 'icon must be a kebab-case icon key' })
  icon?: string;
}
