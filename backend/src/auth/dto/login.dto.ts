import { Transform } from 'class-transformer';
import { IsString, Length, Matches } from 'class-validator';

export class LoginDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsString()
  @Length(1, 100)
  @Matches(/^[a-z0-9][a-z0-9._-]*$/)
  username!: string;

  @IsString()
  @Length(8, 128)
  password!: string;
}
