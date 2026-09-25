import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsISO8601,
  IsString,
  IsUUID,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  NegativeMarking,
  QuizAudience,
  QuizLanguage,
} from '../../generated/prisma/enums.js';

const Provided = () =>
  ValidateIf((_object: unknown, value: unknown) => value !== undefined);
const Trim = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );
const decimalPattern = /^\d{1,8}(\.\d{1,4})?$/;

export class QuizOptionDto {
  @Trim()
  @IsString()
  @Length(1, 10_000)
  text!: string;

  @IsBoolean()
  isCorrect!: boolean;
}

export class QuizQuestionDto {
  @Trim()
  @IsString()
  @Length(1, 10_000)
  prompt!: string;

  @IsString()
  @Matches(decimalPattern, {
    message:
      'points must be a decimal string with up to 8 integer and 4 fractional digits',
  })
  points!: string;

  @IsArray()
  @ArrayMaxSize(4)
  @ValidateNested({ each: true })
  @Type(() => QuizOptionDto)
  options!: QuizOptionDto[];
}

/** Supplied fields replace their current value. Null is allowed only for description. */
export class SaveQuizDto {
  @Provided()
  @Trim()
  @IsString()
  @Length(1, 200)
  title?: string;

  @ValidateIf(
    (_object: unknown, value: unknown) => value !== undefined && value !== null,
  )
  @Trim()
  @IsString()
  @MaxLength(10_000)
  description?: string | null;

  @Provided()
  @IsEnum(QuizLanguage)
  language?: QuizLanguage;

  @Provided()
  @IsInt()
  @Min(1)
  @Max(1440)
  durationMinutes?: number;

  @Provided()
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(/T.+(?:Z|[+-]\d{2}:\d{2})$/, {
    message: 'opensAt must include a timezone',
  })
  opensAt?: string;

  @Provided()
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(/T.+(?:Z|[+-]\d{2}:\d{2})$/, {
    message: 'closesAt must include a timezone',
  })
  closesAt?: string;

  @Provided()
  @IsEnum(NegativeMarking)
  negativeMarking?: NegativeMarking;

  @Provided()
  @IsString()
  @Matches(decimalPattern)
  penaltyValue?: string;

  @Provided()
  @Transform(({ value }: { value: unknown }) =>
    Array.isArray(value)
      ? value.map((id: unknown) =>
          typeof id === 'string' ? id.toLowerCase() : id,
        )
      : value,
  )
  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  classIds?: string[];

  /** CLASSES: every student in classIds. STUDENTS: only the students in studentIds. */
  @Provided()
  @IsEnum(QuizAudience)
  audience?: QuizAudience;

  @Provided()
  @Transform(({ value }: { value: unknown }) =>
    Array.isArray(value)
      ? value.map((id: unknown) =>
          typeof id === 'string' ? id.toLowerCase() : id,
        )
      : value,
  )
  @IsArray()
  @ArrayMaxSize(500)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  studentIds?: string[];

  @Provided()
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => QuizQuestionDto)
  questions?: QuizQuestionDto[];

  @Provided()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toLowerCase() : value,
  )
  @IsUUID()
  teacherId?: string;
}
