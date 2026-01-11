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

  // GET /documents/:id - Get a specific document
  @Get(':id')
  @UseGuards(AuthGuard) // только авторизованные
  findOne(@Param('id') id: string, @Req() request: any) {
    return this.documentsService.findOne(id, request.user);
  }

  // GET /documents - Get all documents
  @Get()
  @UseGuards(AuthGuard) // только авторизованные
  findAll(@Req() request: any) {
    return this.documentsService.findAll(request.user);
  }

  // PATCH /documents/:id - Update a document
  @Patch(':id')
  @UseGuards(AuthGuard) // только авторизованные
  update(@Param('id') id: string, @Body() documentToEdit: IDocumentToEdit, @Req() request: any) {
    return this.documentsService.update(id, request.user, documentToEdit);
  }

  // DELETE /documents/:id - Delete a document
  @Delete(':id')
  @UseGuards(AuthGuard) // только авторизованные
  delete(@Param('id') id: string, @Req() request: any) {
    return this.documentsService.delete(id, request.user);
  }
}
