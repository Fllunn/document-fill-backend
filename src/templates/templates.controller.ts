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
} from '@nestjs/common';

import { TemplatesService } from './templates.service';
import { ITemplate } from './interfaces/templates.interface';
import { AuthGuard } from 'src/auth/auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { UploadedFile } from '@nestjs/common/decorators';
import ApiError from 'src/exceptions/errors/api-error';
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiOkResponse, ApiConsumes, ApiBody } from '@nestjs/swagger';

import { CreateTemplateDto } from './dto/create-template.dto'
import { UpdateTemplateDto } from './dto/update-template.dto'


@ApiBearerAuth() // Swwagger autorization Bearer token
@Controller('templates')
export class TemplatesController {
  constructor(private readonly templatesService: TemplatesService) {}
  
  @ApiOperation({
    summary: 'Получение списка шаблонов',
    description: 'Возвращает все системные шаблоны и шаблоны пользователя',
  })
  @ApiResponse({
    status: 200,
    description: 'Список шаблонов успешно получен',
  })
  @Get()
  @UseGuards(AuthGuard) // только авторизованные
  findAll(@Req() request: any) {
    return this.templatesService.findAll(request.user);
  }

  @Get(':id')
  @UseGuards(AuthGuard) // только авторизованные
  @ApiOperation({
    summary: 'Получение шаблона по ID',
    description: 'Возвращает системный шаблон или шаблон, принадлежащий пользователю',
  })
  @ApiParam({
    name: 'id',
    type: 'string',
    required: true,
    description: 'ID шаблона',
    example: '64b8f0c2e1b2c3d4e5f67890',
  })
  @ApiResponse({
    status: 200,
    description: 'Шаблон успешно получен',
    schema: {
      type: 'object',
      properties: {
        _id: { type: 'string', example: '65f1a7c3e4b0a2d9f8c12345' },
        name: { type: 'string', example: 'contract.docx' },
        storageType: { type: 'string', example: 'user' },
      },
    },
  })
  findOne(@Param('id') id: string, @Req() request: any) {
    return this.templatesService.findOne(id, request.user);
  }

  @Delete(':id')
  @UseGuards(AuthGuard) // только авторизованные
  @ApiOperation({
    summary: 'Delete a specific template',
    description: 'Only admin can delete system templates<br><br>User templates can be deleted by their owners',
  })
  delete(@Param('id') id: string, @Req() request: any) {
    return this.templatesService.delete(id, request.user);
  }

  @Patch(':id')
  @UseGuards(AuthGuard) // только авторизованные
  @ApiOperation({
    summary: 'Update a specific template',
    description: 'Only admin can update system templates<br><br>User templates can be updated by their owners',
  })
  update(
    @Param('id') id: string,
    @Body() dto: UpdateTemplateDto,
    @Req() request: any) {
    return this.templatesService.update(id, request.user, dto);
  }

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
    summary: 'Создать новый шаблон из файла',
    description: 'Создает новый шаблон из файла .docx<br><br>Для обычного пользователя максимальный размер файла 512 КБ<br><br>Системные шаблоны может создавать только администратор',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'isSystem'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Файл шаблона в формате .docx',
        },
        isSystem: {
          type: 'boolean',
          example: false,
          description: 'Создать системный шаблон. Доступно только администратору',
        },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      fileFilter: (req, file, cb) => {
        if (
          file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' // .docx
        ) {
          cb(null, true);
        } else {
          cb(ApiError.BadRequest('Разрешены только файлы .docx'), false);
        }
      },
    }),
  )
  createFromFile(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreateTemplateDto,
    @Req() request: any) {
    if (!file) {
      throw ApiError.BadRequest('Файл не был загружен');
    }

    file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');

    // if (process.env.NODE_ENV === 'development') {
    //   console.log(file, isSystem)
    // }

    return this.templatesService.createFromFile(file, dto.isSystem, request.user);
  }
}
