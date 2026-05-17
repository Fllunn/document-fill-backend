import { IsObject } from 'class-validator';

export class UpdateDocumentDto {
  @IsObject()
  values: Record<string, any>;
}
