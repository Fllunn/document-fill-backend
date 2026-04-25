import { IsOptional, IsString, MaxLength } from 'class-validator';

export class CreatePhotoDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  readonly name?: string;
}
