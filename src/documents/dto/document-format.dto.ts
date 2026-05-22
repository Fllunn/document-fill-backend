import { IsEnum, IsOptional } from 'class-validator';

export enum DocumentFormat {
  DOCX = 'docx',
  PDF = 'pdf',
}

export class DocumentFormatDto {
  @IsOptional()
  @IsEnum(DocumentFormat)
  format?: DocumentFormat = DocumentFormat.DOCX;
}
