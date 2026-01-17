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
import { Delimiters, TemplateHandler } from 'easy-template-x';
import createReport, { listCommands } from 'docx-templates';


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

  /**
   * https://github.com/alonrbar/easy-template-x#listing-tags
   * extract variables from docx file
   * @param file 
   */
  async extractVariables(file: Express.Multer.File): Promise<string[]> {

    // if (process.env.NODE_ENV === 'development') {
    //   console.log('Extracting variables from file:', file.originalname);
    // }
    
    if (!file || !file.buffer) {
      throw ApiError.BadRequest('Файл не был загружен');
    }

    try {

      const arrayBuffer = new Uint8Array(file.buffer).buffer;

      const commands = await listCommands(arrayBuffer, ['{{', '}}']);

      const variables = commands
        .filter(cmd => cmd.type === 'INS' && typeof cmd.code === 'string')
        .map(cmd => cmd.code.replace(/\s*\.\s*/g, '.').trim());

      const uniqueVariables = Array.from(new Set(variables));

      if (process.env.NODE_ENV === 'development') {
        console.log('Extracted variables:', uniqueVariables);
      }
      
      return uniqueVariables;
    } catch (error) {
      console.error('Error extracting variables:', error);
      throw ApiError.Internal('Ошибка при извлечении переменных из файла');
    }
    
  }

  async fillTemplate(filePath: string, values: Record<string, any>): Promise<Buffer> {
    if (!filePath) {
      throw ApiError.BadRequest('Путь к файлу не указан');
    }

    let fileBuffer: Buffer;

    // if file is in YC
    if (filePath.startsWith('users/')) {
      const presignedUrl = await YaCloud.generatePresignedUrl(this.normalizeYCFilePath(filePath));

      const response = await fetch(presignedUrl);

      if (!response.ok) {
        throw ApiError.Internal('Ошибка при получении файла из облачного хранилища');
      }

      fileBuffer = Buffer.from(await response.arrayBuffer());
    } else {
      // local system file
      const pathLocal = path.join(process.cwd(), 'storage/templates/system', filePath);
      try {
        fileBuffer = fs.readFileSync(pathLocal);
      } catch (error) {
        throw ApiError.NotFound();
      }
    }

    const template = new TemplateHandler();
    const filledBuffer = await template.process(fileBuffer, values);
    return filledBuffer;
  }
}
