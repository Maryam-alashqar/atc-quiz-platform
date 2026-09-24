import { Transform } from 'class-transformer';
import { IsUUID, ValidateIf } from 'class-validator';

const NormalizeId = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toLowerCase() : value,
  );

export class SaveAnswerDto {
  @NormalizeId()
  @IsUUID()
  questionId!: string;

  @NormalizeId()
  @ValidateIf((_object: unknown, value: unknown) => value !== null)
  @IsUUID()
  optionId!: string | null;
}
