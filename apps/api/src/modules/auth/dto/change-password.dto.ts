import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(72)
  currentPassword!: string;

  // Same rules as on registration; bcrypt ignores anything past 72 bytes.
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  newPassword!: string;
}
