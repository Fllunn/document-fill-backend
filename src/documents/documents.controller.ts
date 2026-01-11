import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  UseGuards,
  Patch,
  Delete,
  Param,
} from '@nestjs/common';

import { DocumentsService } from './documents.service';
import { IDocumentToEdit } from './interfaces/IDocumentsToEdit';
import { IDocumentToCreate } from './interfaces/IDocumentsToCreate';
import { AuthGuard } from 'src/auth/auth.guard';

@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  // POST /documents - Create a new document
  @Post()
  @UseGuards(AuthGuard) // только авторизованные
  create(@Body() document: IDocumentToCreate, @Req() request: any) {
    // request.user содержит информацию о текущем пользователе из JWT
    return this.documentsService.create(document, request.user);
  }
}
