import { IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export const HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{6}$/;
export const ICON_KEY_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*$/;

export class CreateCategoryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name!: string;

  @IsString()
  @Matches(HEX_COLOR_PATTERN, {
    message: 'color must be a hex color like #A1B2C3',
  })
  color!: string;

  @IsString()
  @MaxLength(50)
  @Matches(ICON_KEY_PATTERN, { message: 'icon must be a kebab-case icon key' })
  icon!: string;
}
