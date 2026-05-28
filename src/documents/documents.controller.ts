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
import { DOCUMENT_MAX_SIZE, DOCUMENT_MAX_SIZE_CEILING, GENERATED_DOCUMENT_MAX_SIZE, PDF_CONVERSION_TIMEOUT_MS, TABLE_COLS_LIMIT, TABLE_COUNT_LIMIT, TABLE_ROWS_LIMIT, TOTAL_VALUES_MAX_LENGTH, VALUE_KEY_MAX_LENGTH, VALUE_STRING_MAX_LENGTH } from 'src/constants/app.constants';

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function hasSvg(values: Record<string, any>): boolean {
  return Object.values(values).some((v) => {
    if (Array.isArray(v)) return v.some((item) => item && typeof item === 'object' && hasSvg(item));
    return v && typeof v === 'object' && v._type === 'image' && v.format === 'image/svg+xml';
  });
}

function countTotalChars(values: Record<string, any>): number {
  let total = 0;

  for (const value of Object.values(values)) {
    if (typeof value === 'string') {
      total += value.length;
    } else if (Array.isArray(value)) {
      for (const item of value) {
        if (item && typeof item === 'object') total += countTotalChars(item);
      }
    } else if (value && typeof value === 'object' && value._type !== 'image') {
      total += countTotalChars(value);
    }
  }
  
  return total;
}

function validateValues(values: Record<string, any>, state = { tableCount: 0 }): void {
  for (const [key, value] of Object.entries(values)) {
    if (key.length > VALUE_KEY_MAX_LENGTH)
      throw ApiError.BadRequest(`Название поля "${key.slice(0, 50)}" превышает ${VALUE_KEY_MAX_LENGTH} символов`);

    if (Array.isArray(value)) {
      state.tableCount++;
      if (state.tableCount > TABLE_COUNT_LIMIT)
        throw ApiError.BadRequest(`Превышено максимальное количество таблиц (${TABLE_COUNT_LIMIT})`);
      if (value.length > TABLE_ROWS_LIMIT)
        throw ApiError.BadRequest(`Таблица "${key}" содержит более ${TABLE_ROWS_LIMIT} строк`);
      for (const row of value) {
        if (row && typeof row === 'object') {
          if (Object.keys(row).length > TABLE_COLS_LIMIT)
            throw ApiError.BadRequest(`Таблица "${key}" содержит более ${TABLE_COLS_LIMIT} столбцов`);
          validateValues(row, state);
        }
      }
    } else if (typeof value === 'string' && value.length > VALUE_STRING_MAX_LENGTH) {
      throw ApiError.BadRequest(`Значение поля "${key}" превышает ${VALUE_STRING_MAX_LENGTH} символов`);
    } else if (value && typeof value === 'object' && value._type !== 'image') {
      validateValues(value, state);
    }
  }
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
    const isAdmin = req.user.roles.includes('admin');
    if (!isAdmin && hasSvg(dto.values))
      throw ApiError.BadRequest('Доступны только форматы PNG и JPG');
    if (!isAdmin) validateValues(dto.values);
    if (dto.rawValues && !isAdmin) validateValues(dto.rawValues);
    const totalChars = countTotalChars(dto.values) + (dto.rawValues ? countTotalChars(dto.rawValues) : 0);
    if (!isAdmin && totalChars > TOTAL_VALUES_MAX_LENGTH)
      throw ApiError.BadRequest('Слишком много данных для генерации документа. Пожалуйста, попробуйте уменьшить длину текстовых значений или количество изображений');
    const maxSize = isAdmin ? undefined : GENERATED_DOCUMENT_MAX_SIZE;
    const pdfTimeout = isAdmin ? undefined : PDF_CONVERSION_TIMEOUT_MS;
    const { buffer, name } = await this.documentsService.create(dto.templateId, dto.values, dto.name, format, dto.namePattern, maxSize, pdfTimeout, dto.rawValues, isAdmin);
    if (!isAdmin && buffer.length > GENERATED_DOCUMENT_MAX_SIZE)
      throw ApiError.BadRequest('Сгенерированный документ превышает допустимый размер 1 МБ');
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
    limits: { fileSize: DOCUMENT_MAX_SIZE_CEILING },
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
    description: 'Имя файла, вычисленные значения и формулы)',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', example: 'Договор Иванов' },
        values: { type: 'object', example: { name: 'Иван', amount: '3000' } },
        rawValues: { type: 'object', nullable: true, example: { amount: 'sum({price1};{price2})' } },
      },
    },
  })
  async extract(
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File,
  ): Promise<{ values: Record<string, any>; rawValues: Record<string, any> | null; name: string }> {
    if (!req.user.roles.includes('admin') && file.size > DOCUMENT_MAX_SIZE)
      throw ApiError.BadRequest('Файл слишком большой');
    return this.documentsService.extract(file.buffer);
  }

  @Post('update')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
    limits: { fieldSize: 10 * 1024 * 1024, fileSize: DOCUMENT_MAX_SIZE_CEILING },
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
    @Body('rawValues') rawValuesRaw?: string,
  ): Promise<StreamableFile> {
    const isAdmin = req.user.roles.includes('admin');
    if (!isAdmin && file.size > DOCUMENT_MAX_SIZE)
      throw ApiError.BadRequest('Файл слишком большой');
    let values: Record<string, any>;
    try {
      values = JSON.parse(valuesRaw);
    } catch {
      throw ApiError.BadRequest('Некорректный формат данных');
    }
    let rawValues: Record<string, any> | undefined;
    
    if (rawValuesRaw) {
      try {
        rawValues = JSON.parse(rawValuesRaw);
      } catch {
        throw ApiError.BadRequest('Некорректный формат данных');
      }
    }

    if (!isAdmin && hasSvg(values))
      throw ApiError.BadRequest('Доступны только форматы PNG и JPG');
    if (!isAdmin) validateValues(values);
    if (rawValues && !isAdmin) validateValues(rawValues);
    const totalChars = countTotalChars(values) + (rawValues ? countTotalChars(rawValues) : 0);

    if (!isAdmin && totalChars > TOTAL_VALUES_MAX_LENGTH)
      throw ApiError.BadRequest('Слишком много данных для генерации документа. Пожалуйста, попробуйте уменьшить длину текстовых значений или количество изображений');
    const maxSize = isAdmin ? undefined : GENERATED_DOCUMENT_MAX_SIZE;
    const pdfTimeout = isAdmin ? undefined : PDF_CONVERSION_TIMEOUT_MS;
    const { buffer, name: docName } = await this.documentsService.update(file.buffer, values, name, format, maxSize, pdfTimeout, rawValues, isAdmin);

    if (!isAdmin && buffer.length > GENERATED_DOCUMENT_MAX_SIZE)
      throw ApiError.BadRequest('Сгенерированный документ превышает допустимый размер 1 МБ. Пожалуйста, попробуйте уменьшить количество или размер изображений в документе');
    return new StreamableFile(buffer, {
      type: format === DocumentFormat.PDF ? 'application/pdf' : DOCX_MIME,
      disposition: `attachment; filename*=UTF-8''${encodeURIComponent(docName)}.${format}`,
    });
  }
}
