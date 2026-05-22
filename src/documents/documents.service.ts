import { Model } from 'mongoose';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import JSZip from 'jszip';
import * as zlib from 'zlib';
import { promisify } from 'util';
import { createWorkerConverter } from '@matbee/libreoffice-converter/server';
import { Template } from 'src/templates/schemas/templates.schema';
import { FilesService } from 'src/files/files.service';
import { CryptoService } from './crypto.service';
import { IDocumentMeta } from './interfaces/IDocumentMeta';
import ApiError from 'src/exceptions/errors/api-error';
import { SAVED_NAMES_LIMIT } from 'src/constants/app.constants';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

@Injectable()
export class DocumentsService implements OnModuleInit, OnModuleDestroy {
  private converter: Awaited<ReturnType<typeof createWorkerConverter>>;

  constructor(
    @InjectModel(Template.name) private templateModel: Model<Template>,
    private filesService: FilesService,
    private cryptoService: CryptoService,
  ) {}

  async onModuleInit(): Promise<void> {
    this.converter = await createWorkerConverter();
  }

  async onModuleDestroy(): Promise<void> {
    await this.converter.destroy();
  }

  async create(templateId: string, values: Record<string, any>, name?: string, format: 'docx' | 'pdf' = 'docx', namePattern?: string): Promise<{ buffer: Buffer; name: string }> {
    const template = await this.templateModel.findById(templateId).lean().exec();
    if (!template) {
      throw ApiError.NotFound('Шаблон не найден');
    }

    const templateBuffer = await this.filesService.getTemplateBuffer(template.filePath);
    const processedValues = format === 'pdf' ? values : this.stripImageValues(values);
    const filledBuffer = await this.filesService.fillTemplateFromBuffer(templateBuffer, processedValues);

    const docName = name ?? 'document';
    const compressedTemplate = await gzip(templateBuffer);
    const meta: IDocumentMeta = { templateBase64: compressedTemplate.toString('base64'), values: this.stripImageValues(values), name: docName };

    const docxBuffer = await this.embedMeta(filledBuffer, this.cryptoService.encrypt(JSON.stringify(meta)));
    const buffer = format === 'pdf' ? await this.convertToPdf(filledBuffer) : docxBuffer;

    if (namePattern && template.storageType === 'user') {
      const savedNames: string[] = template.savedNames ?? [];
      if (!savedNames.includes(namePattern) && savedNames.length < SAVED_NAMES_LIMIT) {
        await this.templateModel.findByIdAndUpdate(
          templateId,
          { $push: { savedNames: namePattern } },
        ).lean().exec();
      }
    }

    return { buffer, name: docName };
  }

  async extract(fileBuffer: Buffer): Promise<{ values: Record<string, any>; name: string }> {
    const encryptedMeta = await this.readMeta(fileBuffer);
    const meta: IDocumentMeta = JSON.parse(this.cryptoService.decrypt(encryptedMeta));
    return { values: meta.values, name: meta.name };
  }

  async update(fileBuffer: Buffer, values: Record<string, any>, name?: string, format: 'docx' | 'pdf' = 'docx'): Promise<{ buffer: Buffer; name: string }> {
    const encryptedMeta = await this.readMeta(fileBuffer);
    const meta: IDocumentMeta = JSON.parse(this.cryptoService.decrypt(encryptedMeta));

    const templateBuffer = await gunzip(Buffer.from(meta.templateBase64, 'base64'));
    const processedValues = format === 'pdf' ? values : this.stripImageValues(values);
    const filledBuffer = await this.filesService.fillTemplateFromBuffer(templateBuffer, processedValues);

    const docName = name ?? meta.name ?? 'document';
    const newMeta: IDocumentMeta = { templateBase64: meta.templateBase64, values: this.stripImageValues(values), name: docName };

    const docxBuffer = await this.embedMeta(filledBuffer, this.cryptoService.encrypt(JSON.stringify(newMeta)));
    const buffer = format === 'pdf' ? await this.convertToPdf(filledBuffer) : docxBuffer;

    return { buffer, name: docName };
  }

  private async convertToPdf(docxBuffer: Buffer): Promise<Buffer> {
    const result = await this.converter.convert(docxBuffer, { outputFormat: 'pdf' });
    return Buffer.from(result.data);
  }

  private async embedMeta(docxBuffer: Buffer, encryptedMeta: string): Promise<Buffer> {
    const zip = await JSZip.loadAsync(docxBuffer);

    // docProps/custom.xml
    const customPropsPath = 'docProps/custom.xml';
    const existingCustomFile = zip.file(customPropsPath);

    if (existingCustomFile) {
      let xml = await existingCustomFile.async('string');
      if (xml.includes('name="AppMeta"')) {
        xml = xml.replace(
          /(<property[^>]*name="AppMeta"[^>]*>)<vt:lpwstr>[\s\S]*?<\/vt:lpwstr>/,
          `$1<vt:lpwstr>${encryptedMeta}</vt:lpwstr>`,
        );
      } else {
        const pids = [...xml.matchAll(/pid="(\d+)"/g)].map(m => parseInt(m[1]));
        const nextPid = pids.length > 0 ? Math.max(...pids) + 1 : 2;
        xml = xml.replace(
          '</Properties>',
          `<property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="${nextPid}" name="AppMeta"><vt:lpwstr>${encryptedMeta}</vt:lpwstr></property></Properties>`,
        );
      }
      zip.file(customPropsPath, xml);
    } else {
      zip.file(
        customPropsPath,
        `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="2" name="AppMeta"><vt:lpwstr>${encryptedMeta}</vt:lpwstr></property></Properties>`,
      );
    }

    // регистрируем content type для custom properties
    const contentTypesFile = zip.file('[Content_Types].xml');
    if (contentTypesFile) {
      let contentTypes = await contentTypesFile.async('string');
      if (!contentTypes.includes('custom-properties+xml')) {
        contentTypes = contentTypes.replace(
          '</Types>',
          '<Override PartName="/docProps/custom.xml" ContentType="application/vnd.openxmlformats-officedocument.custom-properties+xml"/></Types>',
        );
        zip.file('[Content_Types].xml', contentTypes);
      }
    }

    // добавляем relationship для custom properties в _rels/.rels
    const relsFile = zip.file('_rels/.rels');
    if (relsFile) {
      let rels = await relsFile.async('string');
      if (!rels.includes('custom-properties')) {
        const existingIds = [...rels.matchAll(/Id="rId(\d+)"/g)].map(m => parseInt(m[1]));
        const nextId = existingIds.length > 0 ? Math.max(...existingIds) + 1 : 1;
        rels = rels.replace(
          '</Relationships>',
          `<Relationship Id="rId${nextId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/custom-properties" Target="docProps/custom.xml"/></Relationships>`,
        );
        zip.file('_rels/.rels', rels);
      }
    }

    return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  }

  private stripImageValues(values: Record<string, any>): Record<string, any> {
    const result: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(values)) {
      if (Array.isArray(value)) {
        result[key] = value.map((item) =>
          item && typeof item === 'object' ? this.stripImageValues(item) : item,
        );
      } else if (value && typeof value === 'object' && value._type === 'image') {
        result[key] = null;
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  private async readMeta(docxBuffer: Buffer): Promise<string> {
    const zip = await JSZip.loadAsync(docxBuffer);
    const customPropsFile = zip.file('docProps/custom.xml');

    if (!customPropsFile) {
      throw ApiError.BadRequest('Данный файл был сгенерирован не через наш сервис или был поврежден');
    }

    const xml = await customPropsFile.async('string');
    const match = xml.match(/<property[^>]*name="AppMeta"[^>]*>[\s\S]*?<vt:lpwstr>([\s\S]*?)<\/vt:lpwstr>/);

    if (!match) {
      throw ApiError.BadRequest('Данный файл был сгенерирован не через наш сервис или был поврежден');
    }

    return match[1];
  }
}
