import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { TAG_NAME_MAX_LENGTH } from './create-tag.dto';

export class UpdateTagDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(TAG_NAME_MAX_LENGTH)
  name?: string;
}
