import { IsString, IsArray, IsEnum, IsOptional } from 'class-validator';

export class CreateTemplateDto {
  @IsString()
  name: string;

  @IsString()
  filePath: string;

  @IsArray()
  @IsString({ each: true })
  variables: string[];

  @IsEnum(['system', 'user'])
  storageType: 'system' | 'user';

  @IsOptional()
  @IsString()
  userId?: string | null;

  @IsString()
  mimeType: string;
}
