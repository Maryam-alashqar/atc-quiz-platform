import { Type } from 'class-transformer';
import { IsEnum, IsInt, Max, Min, ValidateIf } from 'class-validator';
import { QuizStatus } from '../../generated/prisma/enums.js';

export class ListQuizzesDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  page = 1;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;

  @ValidateIf((_object: unknown, value: unknown) => value !== undefined)
  @IsEnum(QuizStatus)
  status?: QuizStatus;
}
