import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export const TAG_NAME_MAX_LENGTH = 50;

export class CreateTagDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(TAG_NAME_MAX_LENGTH)
  name!: string;
}
