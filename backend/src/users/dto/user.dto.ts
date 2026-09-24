import { Transform } from 'class-transformer';
import {
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto.js';

/** Only these roles are managed through the API. Admin accounts come from the seed. */
export const MANAGED_ROLES = ['STUDENT', 'TEACHER'] as const;
export type ManagedRole = (typeof MANAGED_ROLES)[number];

const Trim = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );
const Lowercase = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  );
const Provided = () =>
  ValidateIf((_object: unknown, value: unknown) => value !== undefined);

export class ListUsersDto extends PaginationDto {
  @IsOptional()
  @IsIn(MANAGED_ROLES)
  role?: ManagedRole;

  @IsOptional()
  @Lowercase()
  @IsUUID()
  classId?: string;

  @IsOptional()
  @Trim()
  @IsString()
  @MaxLength(100)
  search?: string;
}

export class CreateUserDto {
  // Same rule as the CSV importer and the login form, so every account can sign in.
  @Lowercase()
  @IsString()
  @Matches(/^[a-z0-9][a-z0-9._-]{0,99}$/, {
    message:
      'username must start with a letter or digit and use only a-z, 0-9, dots, underscores or hyphens (max 100)',
  })
  username!: string;

  @Trim()
  @IsString()
  @Length(1, 200)
  name!: string;

  @IsIn(MANAGED_ROLES)
  role!: ManagedRole;

  /** Required for students, rejected for teachers (checked in the service). */
  @Provided()
  @Lowercase()
  @IsUUID()
  classId?: string;

  @IsString()
  @Length(8, 128)
  password!: string;
}

export class UpdateUserDto {
  @Provided()
  @Trim()
  @IsString()
  @Length(1, 200)
  name?: string;

  @Provided()
  @Lowercase()
  @IsUUID()
  classId?: string;
}

export class ResetPasswordDto {
  @IsString()
  @Length(8, 128)
  password!: string;
}
