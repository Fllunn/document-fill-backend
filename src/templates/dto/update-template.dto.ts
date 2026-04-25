import { Transform } from 'class-transformer';
import { Allow, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateTemplateDto {
  @IsOptional()
  @Transform(({ value }) => typeof value === 'string' ? value.trim().replace(/\.docx$/i, '') : value)
  @IsString()
  @MaxLength(255)
  readonly name?: string;

  @Allow()
  @IsOptional()
  readonly file?: unknown;
}
