import { IsObject, IsString } from 'class-validator';

export class CreateDocumentDto {
  @IsString()
  templateId: string;

  @IsObject()
  values: Record<string, any>;
}
