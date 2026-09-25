import { IsString, Length } from 'class-validator';

export class ChangePasswordDto {
  @IsString()
  @Length(1, 128)
  currentPassword!: string;

  // Same rule as account creation and the importer.
  @IsString()
  @Length(8, 128)
  newPassword!: string;
}
