import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from 'src/auth/auth.guard';
import { DocumentsService } from './documents.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import { DocumentFormat, DocumentFormatDto } from './dto/document-format.dto';
import ApiError from 'src/exceptions/errors/api-error';
import { DOCUMENT_MAX_SIZE } from 'src/constants/app.constants';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function hasSvg(values: Record<string, any>): boolean {
  return Object.values(values).some((v) => {
    if (Array.isArray(v)) return v.some((item) => item && typeof item === 'object' && hasSvg(item));
    return v && typeof v === 'object' && v._type === 'image' && v.format === 'image/svg+xml';
  });
}

@ApiBearerAuth()
@ApiTags('Документы')
@Controller('documents')
export class DocumentsController {
  constructor(private readonly documentsService: DocumentsService) {}

  @Post()
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Создать документ',
    description: 'Генерирует документ .docx из шаблона',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['templateId', 'values'],
      properties: {
        templateId: {
          type: 'string',
          example: '6a098649e8940276ac104506',
          description: 'ID шаблона',
        },
        name: {
          type: 'string',
          example: 'Договор Иванов',
          description: 'Имя файла (без расширения)',
        },
        namePattern: {
          type: 'string',
          example: 'Договор {Компания}',
          description: 'Паттерн названия с переменными для сохранения, только для пользовательских шаблонов',
        },
        values: {
          type: 'object',
          example: { name: 'Иван Иванов', date: '10.02.2000', amount: '5000' },
          description: 'Значения переменных шаблона',
        },
      },
    },
  })
  @ApiQuery({ name: 'format', enum: DocumentFormat, required: false })
  @ApiResponse({
    status: 200,
    description: 'Готовый документ .docx',
  })
  async create(
    @Req() req: any,
    @Body() dto: CreateDocumentDto,
    @Query() { format = DocumentFormat.DOCX }: DocumentFormatDto,
  ): Promise<StreamableFile> {
    if (!req.user.roles.includes('admin') && hasSvg(dto.values))
      throw ApiError.BadRequest('Доступны только форматы PNG и JPG');
    const { buffer, name } = await this.documentsService.create(dto.templateId, dto.values, dto.name, format, dto.namePattern);
    return new StreamableFile(buffer, {
      type: format === DocumentFormat.PDF ? 'application/pdf' : DOCX_MIME,
      disposition: `attachment; filename*=UTF-8''${encodeURIComponent(name)}.${format}`,
    });
  }

  @Post('extract')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    fileFilter: (_req, file, cb) => {
      if (file.mimetype === DOCX_MIME) {
        cb(null, true);
      } else {
        cb(ApiError.BadRequest('Разрешены только файлы .docx'), false);
      }
    },
  }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Извлечь переменные из документа',
    description: 'Вернет имя и заполненные значения переменных из ранее сгенерированного .docx файла',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Ранее сгенерированный .docx файл',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Имя файла и значения переменных',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'Договор Иванов' },
        values: {
          type: 'object',
          example: { name: 'Иван Иванов', date: '10.02.2000', amount: '5000' },
        },
      },
    },
  })
  async extract(
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<{ values: Record<string, any>; name: string }> {
    if (!req.user.roles.includes('admin') && file.size > DOCUMENT_MAX_SIZE)
      throw ApiError.BadRequest('Файл слишком большой');
    return this.documentsService.extract(file.buffer);
  }

  @Post('update')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    limits: { fieldSize: 10 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (file.mimetype === DOCX_MIME) {
        cb(null, true);
      } else {
        cb(ApiError.BadRequest('Разрешены только файлы .docx'), false);
      }
    },
  }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Обновить документ',
    description: 'Обновляет значения переменных в ранее сгенерированном .docx файле и возвращает новый файл',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file', 'values'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'Ранее сгенерированный .docx файл',
        },
        name: {
          type: 'string',
          example: 'Договор Петров',
          description: 'Новое имя файла (без расширения)',
        },
        values: {
          type: 'object',
          example: '{"name":"Егор Егоров","date":"20.02.2001","amount":"10000"}',
          description: 'Новые значения переменных',
        },
      },
    },
  })
  @ApiQuery({ name: 'format', enum: DocumentFormat, required: false })
  @ApiResponse({
    status: 200,
    description: 'Новый .docx документ',
  })
  async update(
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File,
    @Query() { format = DocumentFormat.DOCX }: DocumentFormatDto,
    @Body('values') valuesRaw: string,
    @Body('name') name?: string,
  ): Promise<StreamableFile> {
    if (!req.user.roles.includes('admin') && file.size > DOCUMENT_MAX_SIZE)
      throw ApiError.BadRequest('Файл слишком большой');
    const values: Record<string, any> = JSON.parse(valuesRaw);
    if (!req.user.roles.includes('admin') && hasSvg(values))
      throw ApiError.BadRequest('Доступны только форматы PNG и JPG');
    const { buffer, name: docName } = await this.documentsService.update(file.buffer, values, name, format);
    return new StreamableFile(buffer, {
      type: format === DocumentFormat.PDF ? 'application/pdf' : DOCX_MIME,
      disposition: `attachment; filename*=UTF-8''${encodeURIComponent(docName)}.${format}`,
    });
  }
}
