import { Model } from 'mongoose';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import ApiError from 'src/exceptions/errors/api-error';
import { RolesService } from 'src/roles/roles.service';
import * as fs from 'fs';
import * as path from 'path';
import { Types } from 'mongoose';
import { Express } from 'express';
import YaCloud from 'src/s3/bucket';
import JSZip from 'jszip';
import sizeOf from 'image-size';
import { ALLOWED_IMAGE_FORMATS, IMAGE_MAX_SIDE_PX, IMAGE_SINGLE_MAX_SIZE, IMAGE_TOTAL_MAX_SIZE, TEMPLATE_XML_MAX_UNCOMPRESSED } from 'src/constants/app.constants';

const {
  TemplateHandler,
  MissingCloseDelimiterError,
  MissingStartDelimiterError,
  UnclosedTagError,
  UnopenedTagError,
} = require('easy-template-x');


@Injectable()
export class FilesService {

  /**
   * generate unique file name
   * @param originalName
   * @returns uniqueID-originalname.docx
   */ 
  generateFileName(originalName: string): string {
    const nameResult = originalName.replace(/\s+/g, '_'); // replace spaces with _
    return `${new Types.ObjectId().toString()}-${nameResult}`; // 123456789abcdef-originalname.docx
  }

  /**
   * save file in local storage, only system file template
   * @param file 
   * @param fileName 
   * @returns path to saved file
   */
  saveSystemFile(file: Express.Multer.File, fileName: string): string {
    // path.join - to ensure correct path separators across OS
    // process.cwd() - current directory
    const systemDir = path.join(process.cwd(), 'storage', 'templates', 'system'); // storage/templates/system

    // fs - file system module
    // .existsSync - check if directory exists
    // .mkdirSync - create directory
    // { recursive: true } - create nested directories if they don't exist
    if (!fs.existsSync(systemDir)) {
      fs.mkdirSync(systemDir, { recursive: true });
    }

    const filePath = path.join(systemDir, fileName); // storage/templates/system/123456789abcdef-originalname.docx
    fs.writeFileSync(filePath, file.buffer); // save file to disk
    return filePath;
  }

  /**
   * delete file from local storage, only system file template
   * @param filePath 
   */
  async deleteSystemFile(filePath: string): Promise<void> {
    if (!filePath) {
      throw ApiError.BadRequest('Путь к файлу не указан');
    }

    const normalizedPath = path.normalize(filePath);

    if (!fs.existsSync(normalizedPath)) {
      throw ApiError.NotFound();
    }

    await fs.promises.unlink(normalizedPath);
  }

  /**
   * save in yandex cloud storage (templates)
   * @param file 
   * @param fileName 
   * @param user 
   * @returns file URL in yandex cloud storage
   */
  async saveYCFileTemplate(file: Express.Multer.File, fileName: string, user: any): Promise<string> {
    const path = `users/${user._id}/templates`;
    const uploadResult = await YaCloud.Upload({
      file,
      path,
      fileName,
    });

    // .Location - full URL file
    if (!uploadResult || !uploadResult.Location) {
      throw ApiError.Internal('Ошибка при загрузке файла в облачное хранилище');
    }

    // if (process.env.NODE_ENV === 'development') {
    //   console.log('YC Upload Result:', uploadResult);
    // }

    return `${path}/${fileName}`;
  }

  async saveYCFilePhoto(file: Express.Multer.File, fileName: string, user: any): Promise<string> {
    const path = `users/${user._id}/photos`;

    const uploadResult = await YaCloud.Upload({
      file,
      path,
      fileName,
    });

    if (!uploadResult || !uploadResult.Location) {
      throw ApiError.Internal('Ошибка при загрузке фотографии в облачное хранилище');
    }

    return `${path}/${fileName}`;
  }

  /**
   * save in yandex cloud storage (documents)
   * @param file 
   * @param fileName 
   * @param user 
   * @param folderPath 
   * @returns 
   */
  async saveYCFileDocument(file: Express.Multer.File, fileName: string, user: any, folderPath?: string): Promise<string> {
    let path = folderPath ? `users/${user._id}/documents/${folderPath}` : `users/${user._id}/documents`;

    const uploadResult = await YaCloud.Upload({
      file,
      path,
      fileName,
    })

    if (!uploadResult || !uploadResult.Location) {
      throw ApiError.Internal('Ошибка при загрузке файла в облачное хранилище');
    }

    path = this.normalizeYCFilePath(path);
    return `${path}/${fileName}`;
  }

  normalizeYCFilePath(filePath: string): string {
    return filePath
      .replace(/\\/g, '/') // replace backslashes with forward slashes
      .replace(/^\/+/, '') // remove leading slashes
      .replace(/\.\./g, '') // remove parent directory references
      .replace(/\/+/g, '/'); // replace multiple slashes with single slash
  }
  
  async deleteYCFile(filePath: string): Promise<void> {
    if (!filePath) {
      throw ApiError.BadRequest('Путь к файлу не указан');
    }

    await YaCloud.deleteFile(this.normalizeYCFilePath(filePath));
  }

  async getYCFileBuffer(filePath: string): Promise<Buffer> {
    if (!filePath) {
      throw ApiError.BadRequest('Путь к файлу не указан');
    }

    try {
      const presignedUrl = await YaCloud.generatePresignedUrl(this.normalizeYCFilePath(filePath));
      const response = await fetch(presignedUrl);

      if (!response.ok) {
        throw ApiError.Internal('Ошибка при получении файла из облачного хранилища');
      }

      return Buffer.from(await response.arrayBuffer());
    } catch (e) {
      if (e instanceof ApiError) throw e;
      throw ApiError.Internal('Ошибка при получении файла из облачного хранилища');
    }
  }

  private readonly templateHandler = new TemplateHandler();

  async extractVariables(file: Express.Multer.File): Promise<string[]> {
    if (!file?.buffer) {
      throw ApiError.BadRequest('Файл не был загружен');
    }

    try {
      const tags = await this.templateHandler.parseTags(file.buffer);

      const variables: string[] = [];
      const loopStack: string[] = [];
      const loopHasChildren = new Map<string, boolean>();

      for (const tag of tags) {
        const name = tag.name.trim();

        if (/\s/.test(name)) {
          throw ApiError.BadRequest(`Неверный синтаксис тега: "${tag.rawText}". Имя переменной не должно содержать пробелы`);
        }

        if (tag.disposition === 'Open') {
          if (loopStack.length > 0) {
            loopHasChildren.set(loopStack[loopStack.length - 1], true);
          }
          loopStack.push(name);
          loopHasChildren.set(name, false);
        } else if (tag.disposition === 'Close') {
          const closed = loopStack.pop();
          if (closed && !loopHasChildren.get(closed)) {
            const prefix = loopStack[loopStack.length - 1];
            variables.push(prefix ? `${prefix}[].${closed}` : closed);
          }
          if (closed) loopHasChildren.delete(closed);
        } else {
          const prefix = loopStack[loopStack.length - 1];
          variables.push(prefix ? `${prefix}[].${name}` : name);
          if (prefix) loopHasChildren.set(prefix, true);
        }
      }

      return Array.from(new Set(variables));
    } catch (error) {
      if (error instanceof ApiError) {
        throw error;
      }
      if (error instanceof MissingCloseDelimiterError) {
        throw ApiError.BadRequest(`Незакрытый тег: "${error.openDelimiterText}"`);
      }
      if (error instanceof MissingStartDelimiterError) {
        throw ApiError.BadRequest(`Открывающий тег отсутствует: "${error.closeDelimiterText}"`);
      }
      if (error instanceof UnclosedTagError) {
        throw ApiError.BadRequest(`Тег не закрыт: "#${error.tagName}"`);
      }
      if (error instanceof UnopenedTagError) {
        throw ApiError.BadRequest(`Тег не открыт: "/${error.tagName}"`);
      }
      throw ApiError.Internal('Ошибка при извлечении переменных из файла');
    }
  }

  async getTemplateBuffer(filePath: string): Promise<Buffer> {
    if (!filePath) {
      throw ApiError.BadRequest('Путь к файлу не указан');
    }

    if (filePath.startsWith('users/')) {
      const presignedUrl = await YaCloud.generatePresignedUrl(this.normalizeYCFilePath(filePath));
      try {
        const response = await fetch(presignedUrl);
        if (!response.ok) {
          throw ApiError.Internal('Ошибка при получении файла из облачного хранилища');
        }
        return Buffer.from(await response.arrayBuffer());
      } catch (error) {
        if (error instanceof ApiError) throw error;
        throw ApiError.Internal('Ошибка при получении файла из облачного хранилища');
      }
    }

    const pathLocal = path.isAbsolute(filePath)
      ? path.normalize(filePath)
      : path.join(process.cwd(), 'storage', 'templates', 'system', filePath);
    try {
      return fs.readFileSync(pathLocal);
    } catch {
      throw ApiError.NotFound();
    }
  }

  private transformImageValues(
    values: Record<string, any>,
    state = { totalSize: 0 },
    singleMaxSize = IMAGE_SINGLE_MAX_SIZE,
  ): Record<string, any> {
    const result: Record<string, any> = {};

    for (const [key, value] of Object.entries(values)) {
      if (Array.isArray(value)) {
        result[key] = value.map((item) =>
          item && typeof item === 'object' ? this.transformImageValues(item, state, singleMaxSize) : item,
        );
      } else if (value && typeof value === 'object' && value._type === 'image') {
        if (!ALLOWED_IMAGE_FORMATS.includes(value.format)) {
          throw ApiError.BadRequest(
            `Недопустимый формат изображения "${key}". Разрешены: ${ALLOWED_IMAGE_FORMATS.join(', ')}`,
          );
        }
        const sizeBytes = Math.floor(value.source.length * 0.75);

        if (sizeBytes > singleMaxSize) {
          throw ApiError.BadRequest(
            `Размер изображения "${key}" превышает ${singleMaxSize / 1024} КБ`,
          );
        }

        state.totalSize += sizeBytes;

        if (state.totalSize > IMAGE_TOTAL_MAX_SIZE) {
          throw ApiError.BadRequest(
            `Суммарный размер изображений превышает ${IMAGE_TOTAL_MAX_SIZE / 1024 / 1024} МБ`,
          );
        }

        const sourceBuffer = Buffer.from(value.source, 'base64');
        const dims = this.calcImageDimensions(sourceBuffer);
        result[key] = { ...value, source: sourceBuffer, ...dims };
      } else {
        result[key] = value;
      }
    }

    return result;
  }

  private calcImageDimensions(buffer: Buffer): { width: number; height: number } {
    try {
      const info = sizeOf(buffer);
      const origW = info.width ?? IMAGE_MAX_SIDE_PX;
      const origH = info.height ?? IMAGE_MAX_SIDE_PX;
      const maxSide = Math.max(origW, origH);
      if (maxSide <= IMAGE_MAX_SIDE_PX) {
        return { width: origW, height: origH };
      }
      const scale = IMAGE_MAX_SIDE_PX / maxSide;
      return {
        width: Math.round(origW * scale),
        height: Math.round(origH * scale),
      };
    } catch {
      return { width: IMAGE_MAX_SIDE_PX, height: IMAGE_MAX_SIDE_PX };
    }
  }

  async extractTemplateTextLength(buffer: Buffer): Promise<number> {
    const zip = await JSZip.loadAsync(buffer);
    const docXml = zip.file('word/document.xml');

    if (!docXml) return 0;

    const uncompressedSize = (docXml as any)._data?.uncompressedSize ?? 0;

    if (uncompressedSize > TEMPLATE_XML_MAX_UNCOMPRESSED)
      throw ApiError.BadRequest('Шаблон содержит слишком большой документ внутри архива');
    
    const xml = await docXml.async('string');
    return xml.replace(/<[^>]+>/g, '').length;
  }

  async fillTemplateFromBuffer(templateBuffer: Buffer, values: Record<string, any>, imageMaxSize?: number): Promise<Buffer> {
    const transformed = this.transformImageValues(values, undefined, imageMaxSize);
    const result = await this.templateHandler.process(templateBuffer, transformed);
    return Buffer.from(result);
  }

  async fillTemplate(filePath: string, values: Record<string, any>): Promise<Buffer> {
    const fileBuffer = await this.getTemplateBuffer(filePath);
    return this.fillTemplateFromBuffer(fileBuffer, values);
  }

  // нужно для добавления поддержки svg
  private static readonly TRANSPARENT_1X1_PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQAABjE+ibYAAAAASUVORK5CYII=',
    'base64',
  );

  async addSvgOoxmlExtension(buffer: Buffer): Promise<Buffer> {
    const zip = await JSZip.loadAsync(buffer);

    const relsFile = zip.file('word/_rels/document.xml.rels');
    if (!relsFile) return buffer;
    let relsXml = await relsFile.async('string');

    // собираем rId для SVG
    const svgRids: string[] = [];
    const relPat = /<Relationship[^>]+Id="([^"]+)"[^>]+Target="[^"]*\.svg"[^>]*\/?>/g;
    let m: RegExpExecArray | null;
    while ((m = relPat.exec(relsXml)) !== null) svgRids.push(m[1]);
    if (svgRids.length === 0) return buffer;

    // следующий rId
    const ridNums = [...relsXml.matchAll(/Id="rId(\d+)"/g)].map(x => parseInt(x[1]));
    let nextRid = ridNums.length ? Math.max(...ridNums) + 1 : 1;

    // следующий номер media
    const mediaNums: number[] = [];
    zip.forEach(p => { const mm = p.match(/word\/media\/\D*(\d+)\./); if (mm) mediaNums.push(parseInt(mm[1])); });
    let nextMedia = mediaNums.length ? Math.max(...mediaNums) + 1 : 1;

    const toPngRid: Record<string, string> = {};
    for (const svgRid of svgRids) {
      const pngRid = `rId${nextRid++}`;
      const pngName = `image${nextMedia++}.png`;
      zip.file(`word/media/${pngName}`, FilesService.TRANSPARENT_1X1_PNG);
      relsXml = relsXml.replace(
        '</Relationships>',
        `<Relationship Id="${pngRid}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${pngName}"/></Relationships>`,
      );
      toPngRid[svgRid] = pngRid;
    }
    zip.file('word/_rels/document.xml.rels', relsXml);

    const ctFile = zip.file('[Content_Types].xml');
    if (ctFile) {
      let ctXml = await ctFile.async('string');
      if (!ctXml.includes('Extension="png"') && !ctXml.includes('image/png')) {
        ctXml = ctXml.replace('</Types>', '<Default Extension="png" ContentType="image/png"/></Types>');
        zip.file('[Content_Types].xml', ctXml);
      }
    }

    const docFile = zip.file('word/document.xml');
    if (!docFile) return buffer;
    let docXml = await docFile.async('string');

    // удаляю любой xmlns:asvg который ранее добавил в w:document, теперь будет inline
    docXml = docXml.replace(/ xmlns:asvg="http:\/\/schemas\.microsoft\.com\/office\/drawing\/2016\/SVG\/main"/, '');

    for (const [svgRid, pngRid] of Object.entries(toPngRid)) {
      const esvg = svgRid.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      // меняем a:blip r:embed с SVG на PNG, применяется только к <a:blip, не к <pic:pic
      docXml = docXml.replace(
        new RegExp(`(<a:blip\\b[^>]*)r:embed="${esvg}"`, 'g'),
        `$1r:embed="${pngRid}"`,
      );

      const epng = pngRid.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      // удаление <a:clrChange> из blip SVG-изображения
      // в шаблоне есть PNG фотка с прозрачностью (clrChange: цвет #1B1B1B на alpha 0)
      // чтобы не было видно. easy-template-x сохраняет этот эффект при замене картинки.
      // libreoffice не может применить цветовой фильтр к SVG без растеризации
      // поэтому SVG конвертируется в PNG низкого качества. удаление clrChange решает проблему
      docXml = docXml.replace(
        new RegExp(`(<a:blip\\b[^>]*r:embed="${epng}"[^>]*>)([\\s\\S]*?)(</a:blip>)`, 'g'),
        (_, open, content, close) => open + content.replace(/<a:clrChange>[\s\S]*?<\/a:clrChange>/g, '') + close,
      );

      const svgExt = `<a:ext uri="{96DAC541-7B7A-43D3-8B79-37D633B846F1}"><asvg:svgBlip xmlns:asvg="http://schemas.microsoft.com/office/drawing/2016/SVG/main" r:embed="${svgRid}"/></a:ext>`;

      // blip (с pngRid) уже имеет <a:extLst>
      const withExtLst = new RegExp(
        `(<a:blip\\b[^>]*r:embed="${epng}"[^>]*>[\\s\\S]*?)(</a:extLst>\\s*</a:blip>)`,
        'g',
      );
      if (withExtLst.test(docXml)) {
        withExtLst.lastIndex = 0;
        docXml = docXml.replace(withExtLst, `$1${svgExt}$2`);
        continue;
      }

      // открытый blip без extLst
      const withoutExtLst = new RegExp(
        `(<a:blip\\b[^>]*r:embed="${epng}"[^>]*>[\\s\\S]*?)(</a:blip>)`,
        'g',
      );
      if (withoutExtLst.test(docXml)) {
        withoutExtLst.lastIndex = 0;
        docXml = docXml.replace(withoutExtLst, `$1<a:extLst>${svgExt}</a:extLst>$2`);
        continue;
      }

      // самозакрывающийся blip
      docXml = docXml.replace(
        new RegExp(`(<a:blip\\b[^>]*r:embed="${epng}"[^>]*)\\/>`, 'g'),
        `$1><a:extLst>${svgExt}</a:extLst></a:blip>`,
      );
    }

    zip.file('word/document.xml', docXml);
    return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  }
}
