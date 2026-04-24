import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateTemplateDto {
  @IsOptional()
  @Transform(({ value }) => value.trim())
  @IsString()
  @MaxLength(255)
  readonly name?: string;
}
