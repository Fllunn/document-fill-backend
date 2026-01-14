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
  UseInterceptors,
  UseFilters,
} from '@nestjs/common';

import { TemplatesService } from './templates.service';
import { ITemplate } from './interfaces/templates.interface';
import { ITemplateToEdit } from './interfaces/ITemplatesToEdit';
import { AuthGuard } from 'src/auth/auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadedFile } from '@nestjs/common/decorators';
import ApiError from 'src/exceptions/errors/api-error';
import { MulterExceptionFilter } from 'src/exceptions/filters/multer-exception.filter';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiOkResponse } from '@nestjs/swagger';


@ApiBearerAuth() // Swwagger autorization Bearer token
@Controller('templates')
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}

  // // POST /templates - Create a new template
  // @Post()
  // @UseGuards(AuthGuard) // только авторизованные
  // create(@Body() template: ITemplate, @Req() request: any) {
  //   // request.user содержит информацию о текущем пользователе из JWT
  //   return this.templatesService.create(template, request.user);
  // }
  
  // GET /templates - Get all templates
  @Get()
  @UseGuards(AuthGuard) // только авторизованные
  @ApiOperation({
    summary: 'Get all templates',
    description: 'Return all system templates and user templates owned by the current user',
  })
  findAll(@Req() request: any) {
    return this.templatesService.findAll(request.user);
  }

  // GET /templates/:id - Get a specific template
  @Get(':id')
  @UseGuards(AuthGuard) // только авторизованные
  @ApiOperation({
    summary: 'Get a specific template',
    description: 'User can access system templates and their own user templates',
  })
  findOne(@Param('id') id: string, @Req() request: any) {
    return this.templatesService.findOne(id, request.user);
  }

  // DELETE /templates/:id - Delete a template
  @Delete(':id')
  @UseGuards(AuthGuard) // только авторизованные
  @ApiOperation({
    summary: 'Delete a specific template',
    description: 'Only admin can delete system templates<br><br>User templates can be deleted by their owners',
  })
  delete(@Param('id') id: string, @Req() request: any) {
    return this.templatesService.delete(id, request.user);
  }

  // PATCH /templates/:id - Update a template
  @Patch(':id')
  @UseGuards(AuthGuard) // только авторизованные
  @ApiOperation({
    summary: 'Update a specific template',
    description: 'Only admin can update system templates<br><br>User templates can be updated by their owners',
  })
  update(@Param('id') id: string, @Body() templateToEdit: ITemplateToEdit, @Req() request: any) {
    return this.templatesService.update(id, request.user, templateToEdit);
  }

  // GET /templates/:id/variables - Get variables of a template
  @Get(':id/variables')
  @UseGuards(AuthGuard) // только авторизованные
  @ApiOperation({
    summary: 'Get variables of a specific template',
    description: 'User can access variables of system templates and their own user templates',
  })
  getTemplateVariables(@Param('id') id: string, @Req() request: any) {
    return this.templatesService.getTemplateVariables(id, request.user);
  }

  @Post()
  @UseGuards(AuthGuard) // только авторизованные
  @ApiOperation({
    summary: 'Create a new template from a file',
    description: 'User can create new templates by uploading .docx or .doc files<br><br>Maximum file size is 512 KB<br><br>Only admin can create system templates',
  })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 512 * 1024 }, // 512 KB
      fileFilter: (req, file, cb) => {
        if (
          file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || // .docx
          file.mimetype === 'application/msword' // .doc
        ) {
          cb(null, true);
        } else {
          cb(new Error('INVALID_FILE_TYPE'), false);
        }
      },
    }),
  )
  @UseFilters(MulterExceptionFilter)
  createFromFile(@UploadedFile() file: Express.Multer.File, @Body('isSystem') isSystem: string, @Req() request: any) {
    if (!file) {
      throw ApiError.BadRequest('Файл не был загружен');
    }

    return this.templatesService.createFromFile(file, isSystem === 'true', request.user);
  }
}
