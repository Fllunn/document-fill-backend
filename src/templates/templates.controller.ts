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
  findAll(@Req() request: any) {
    return this.templatesService.findAll(request.user);
  }

  // GET /templates/:id - Get a specific template
  @Get(':id')
  @UseGuards(AuthGuard) // только авторизованные
  findOne(@Param('id') id: string, @Req() request: any) {
    return this.templatesService.findOne(id, request.user);
  }

  // DELETE /templates/:id - Delete a template
  @Delete(':id')
  @UseGuards(AuthGuard) // только авторизованные
  delete(@Param('id') id: string, @Req() request: any) {
    return this.templatesService.delete(id, request.user);
  }

  // PATCH /templates/:id - Update a template
  @Patch(':id')
  @UseGuards(AuthGuard) // только авторизованные
  update(@Param('id') id: string, @Body() templateToEdit: ITemplateToEdit, @Req() request: any) {
    return this.templatesService.update(id, request.user, templateToEdit);
  }

  // GET /templates/:id/variables - Get variables of a template
  @Get(':id/variables')
  @UseGuards(AuthGuard) // только авторизованные
  getTemplateVariables(@Param('id') id: string, @Req() request: any) {
    return this.templatesService.getTemplateVariables(id, request.user);
  }

  @Post()
  @UseGuards(AuthGuard) // только авторизованные
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
  createFromFile(@UploadedFile() file: Express.Multer.File, @Req() request: any) {
    if (!file) {
      throw ApiError.BadRequest('Файл не был загружен');
    }

    return this.templatesService.createFromFile(file, request.user);
  }
}
