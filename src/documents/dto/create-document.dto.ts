import { IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class CreateDocumentDto {
  @IsString()
  templateId: string;

  @IsOptional()
  @IsString()
  @MaxLength(150, { message: 'Название документа не должно превышать 150 символов' })
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150, { message: 'Название шаблона названия не должно превышать 150 символов' })
  namePattern?: string;

  @IsObject()
  values: Record<string, any>;
}
