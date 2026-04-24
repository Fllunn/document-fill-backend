import { Transform } from 'class-transformer';
import { IsBoolean } from 'class-validator';

export class CreateTemplateDto {
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  readonly isSystem!: boolean;
}
