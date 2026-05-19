import { Model } from 'mongoose';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import JSZip from 'jszip';
import * as zlib from 'zlib';
import { promisify } from 'util';
import { Template } from 'src/templates/schemas/templates.schema';
import { FilesService } from 'src/files/files.service';
import { CryptoService } from './crypto.service';
import { IDocumentMeta } from './interfaces/IDocumentMeta';
import ApiError from 'src/exceptions/errors/api-error';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

@Injectable()
export class DocumentsService {
  constructor(
    @InjectModel(Template.name) private templateModel: Model<Template>,
    private filesService: FilesService,
    private cryptoService: CryptoService,
  ) {}

  async create(templateId: string, values: Record<string, any>, name?: string): Promise<{ buffer: Buffer; name: string }> {
    const template = await this.templateModel.findById(templateId).lean().exec();
    if (!template) {
      throw ApiError.NotFound('Шаблон не найден');
    }

    const templateBuffer = await this.filesService.getTemplateBuffer(template.filePath);
    const filledBuffer = await this.filesService.fillTemplateFromBuffer(templateBuffer, values);

    const docName = name ?? 'document';
    const compressedTemplate = await gzip(templateBuffer);
    const meta: IDocumentMeta = { templateBase64: compressedTemplate.toString('base64'), values, name: docName };

    return { buffer: await this.embedMeta(filledBuffer, this.cryptoService.encrypt(JSON.stringify(meta))), name: docName };
  }

  async extract(fileBuffer: Buffer): Promise<{ values: Record<string, any>; name: string }> {
    const encryptedMeta = await this.readMeta(fileBuffer);
    const meta: IDocumentMeta = JSON.parse(this.cryptoService.decrypt(encryptedMeta));
    return { values: meta.values, name: meta.name };
  }

  async update(fileBuffer: Buffer, values: Record<string, any>, name?: string): Promise<{ buffer: Buffer; name: string }> {
    const encryptedMeta = await this.readMeta(fileBuffer);
    const meta: IDocumentMeta = JSON.parse(this.cryptoService.decrypt(encryptedMeta));

    const templateBuffer = await gunzip(Buffer.from(meta.templateBase64, 'base64'));
    const filledBuffer = await this.filesService.fillTemplateFromBuffer(templateBuffer, values);

    const docName = name ?? meta.name ?? 'document';
    const newMeta: IDocumentMeta = { templateBase64: meta.templateBase64, values, name: docName };

    return { buffer: await this.embedMeta(filledBuffer, this.cryptoService.encrypt(JSON.stringify(newMeta))), name: docName };
  }

  private async embedMeta(docxBuffer: Buffer, encryptedMeta: string): Promise<Buffer> {
    // открываем .docx как zip
    const zip = await JSZip.loadAsync(docxBuffer);

    // добавляем [Content_Types].xml чтобы ворд не ругался на сломанный файл
    const contentTypesFile = zip.file('[Content_Types].xml');
    if (contentTypesFile) {
      let contentTypes = await contentTypesFile.async('string');
      if (!contentTypes.includes('Extension="dat"')) {
        contentTypes = contentTypes.replace(
          '</Types>',
          '<Default Extension="dat" ContentType="application/octet-stream"/></Types>',
        );
        zip.file('[Content_Types].xml', contentTypes);
      }
    }

    // добавляем метаданные в файл app_meta.dat внутри архива
    zip.file('app_meta.dat', encryptedMeta, { compression: 'DEFLATE' });
    return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  }

  private async readMeta(docxBuffer: Buffer): Promise<string> {
    const zip = await JSZip.loadAsync(docxBuffer);
    const metaFile = zip.file('app_meta.dat');

    if (!metaFile) {
      throw ApiError.BadRequest('Данный файл был сгенерирован не через наш сервис или был поврежден');
    }

    return metaFile.async('string');
  }
}
