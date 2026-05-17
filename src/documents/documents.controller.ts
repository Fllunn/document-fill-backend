import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
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
  ApiProduces,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from 'src/auth/auth.guard';
import { DocumentsService } from './documents.service';
import { CreateDocumentDto } from './dto/create-document.dto';
import ApiError from 'src/exceptions/errors/api-error';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

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
        values: {
          type: 'object',
          example: { name: 'Иван Иванов', date: '10.02.2000', amount: '5000' },
          description: 'Значения переменных шаблона',
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Готовый документ .docx',
  })
  async create(@Body() dto: CreateDocumentDto): Promise<StreamableFile> {
    const { buffer, name } = await this.documentsService.create(dto.templateId, dto.values, dto.name);
    return new StreamableFile(buffer, {
      type: DOCX_MIME,
      disposition: `attachment; filename*=UTF-8''${encodeURIComponent(name)}.docx`,
    });
  }

  @Post('extract')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    limits: { fileSize: 512 * 1024 },
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
    @UploadedFile() file: Express.Multer.File,
  ): Promise<{ values: Record<string, any>; name: string }> {
    return this.documentsService.extract(file.buffer);
  }

  @Post('update')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    limits: { fileSize: 512 * 1024 },
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
  @ApiResponse({
    status: 200,
    description: 'Новый .docx документ',
  })
  async update(
    @UploadedFile() file: Express.Multer.File,
    @Body('values') valuesRaw: string,
    @Body('name') name?: string,
  ): Promise<StreamableFile> {
    const values: Record<string, any> = JSON.parse(valuesRaw);
    const { buffer, name: docName } = await this.documentsService.update(file.buffer, values, name);
    return new StreamableFile(buffer, {
      type: DOCX_MIME,
      disposition: `attachment; filename*=UTF-8''${encodeURIComponent(docName)}.docx`,
    });
  }
}
