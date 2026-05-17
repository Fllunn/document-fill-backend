import { IsObject, IsOptional, IsString } from 'class-validator';

export class CreateDocumentDto {
  @IsString()
  templateId: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsObject()
  values: Record<string, any>;
}
