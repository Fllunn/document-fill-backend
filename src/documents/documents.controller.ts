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
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiOkResponse } from '@nestjs/swagger';


@ApiBearerAuth() // Swwagger autorization Bearer token
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  // POST /documents - Create a new document
  @Post()
  @UseGuards(AuthGuard) // только авторизованные
  @ApiOperation({
    summary: 'Create a new document',
    description: 'User can create new documents based on owned templates and system templates',
  })
  create(@Body() document: IDocumentToCreate, @Req() request: any) {
    // request.user содержит информацию о текущем пользователе из JWT
    return this.documentsService.create(document, request.user);
  }

  // GET /documents/:id - Get a specific document
  @Get(':id')
  @UseGuards(AuthGuard) // только авторизованные
  @ApiOperation({
    summary: 'Get a specific document',
    description: 'User can access their own documents<br><br>Admins can access any document',
  })
  findOne(@Param('id') id: string, @Req() request: any) {
    return this.documentsService.findOne(id, request.user);
  }

  // GET /documents - Get all documents
  @Get()
  @UseGuards(AuthGuard) // только авторизованные
  @ApiOperation({
    summary: 'Get all documents',
    description: 'User can access their own documents<br><br>Admins dont have special access to all documents',
  })
  findAll(@Req() request: any) {
    return this.documentsService.findAll(request.user);
  }

  // PATCH /documents/:id - Update a document
  @Patch(':id')
  @UseGuards(AuthGuard) // только авторизованные
  @ApiOperation({
    summary: 'Update a specific document',
    description: 'User can update their own documents<br><br>Admins can update any document',
  })
  update(@Param('id') id: string, @Body() documentToEdit: IDocumentToEdit, @Req() request: any) {
    return this.documentsService.update(id, request.user, documentToEdit);
  }

  // DELETE /documents/:id - Delete a document
  @Delete(':id')
  @UseGuards(AuthGuard) // только авторизованные
  @ApiOperation({
    summary: 'Delete a specific document',
    description: 'User can delete their own documents<br><br>Admins can delete any document',
  })
  delete(@Param('id') id: string, @Req() request: any) {
    return this.documentsService.delete(id, request.user);
  }
}
