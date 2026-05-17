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
    const buffer = await this.documentsService.create(dto.templateId, dto.values);
    return new StreamableFile(buffer, {
      type: DOCX_MIME,
      disposition: 'attachment; filename="document.docx"',
    });
  }

  @Post('extract')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Извлечь переменные из документа',
    description: 'Вернет заполненные значения переменных из ранее сгенерированного .docx файла',
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
    description: 'Поля и значения в документе',
    schema: {
      type: 'object',
      properties: {
        values: {
          type: 'object',
          example: { name: 'Иван Иванов', date: '10.02.2000', amount: '5000' },
          description: 'Заполненные значения переменных',
        },
      },
    },
  })
  async extract(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<{ values: Record<string, any> }> {
    return this.documentsService.extract(file.buffer);
  }

  @Post('update')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  @ApiConsumes('multipart/form-data')
  @ApiOperation({
    summary: 'Обновить документ',
    description: 'Обновляет значения переменных в ранее сгенерированном .docx файле и возвращает новый файл с новыми значениями',
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
  ): Promise<StreamableFile> {
    const values: Record<string, any> = JSON.parse(valuesRaw);
    const buffer = await this.documentsService.update(file.buffer, values);
    return new StreamableFile(buffer, {
      type: DOCX_MIME,
      disposition: 'attachment; filename="document.docx"',
    });
  }
}
