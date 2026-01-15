// NestJS
import { Injectable } from '@nestjs/common';

// MongoDB
import { Model, Types } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';

// Schemas and Interfaces
import { Template } from './schemas/templates.schema';
import { User } from 'src/user/interfaces/user.interface';
import { ITemplate } from './interfaces/templates.interface';
import { ITemplateToEdit } from './interfaces/ITemplatesToEdit';

// Services
import { RolesService } from 'src/roles/roles.service';
import { FilesService } from 'src/files/files.service';
import { UserService } from 'src/user/user.service';

// Errors
import ApiError from 'src/exceptions/errors/api-error';

// Other
import * as path from 'path';

@Injectable()
export class TemplatesService {
  constructor(
    @InjectModel(Template.name)
    private templateModel: Model<Template>,
    @InjectModel('User')
    private userModel: Model<User>,
    private filesService: FilesService,
    private rolesService: RolesService,
    private userService: UserService,
  ) {}

  // async create(template: ITemplate, user: any): Promise<Template> {
  //   // Только админ может добавть system шаблон
  //   // Через RolesService проверяем, что у пользователя есть роль admin
  //   if (template.storageType === 'system' && !this.rolesService.isAdmin(user.roles)) {
  //     throw ApiError.AccessDenied();
  //   }

  //   // Для user шаблонов автоматически устанавливаем userId, для system по умолчанию null
  //   if (template.storageType === 'user') {
  //     template.userId = user._id;
  //   }

  //   const createdTemplate = new this.templateModel(template);
  //   const savedTemplate = await createdTemplate.save();

  //   const result: any = savedTemplate.toObject();
  //   delete result.userId; // Не возвращаем userId
  //   delete result.filePath; // Не возвращаем filePath

  //   return result;
  // }

  async findAll(user: any): Promise<Template[]> {
    const templates = await this.templateModel
      .find({
        $or: [
          { storageType: 'system' },
          { storageType: 'user', userId: user._id },
        ]
      })
      .select('name variables storageType mimeType')
      // .lean для возврата JS объектов вместо Mongoose документов (работает быстрее)
      .lean()
      .exec();

    return templates;
  }

  async findOne(id: string, user: any): Promise<Template> {
    const template = await this.templateModel
      .findById(id)
      .select('name variables storageType userId mimeType')
      .exec();
    if (!template) {
      throw ApiError.NotFound();
    }

    if (template.storageType === 'user' && template.userId?.toString() !== user._id) {
      // Пользователь может получить только свои user шаблоны
      throw ApiError.AccessDenied();
    }

    const result: any = template.toObject();
    delete result.userId;
    return result;
  }

  async update(id: string, user: any, templateToEdit: ITemplateToEdit, newFile?: Express.Multer.File): Promise<ITemplateToEdit> {
    const template = await this.templateModel.findById(id).exec();
    
    if (!template) {
      throw ApiError.NotFound();
    }

    if (template.storageType === 'system' && !this.rolesService.isAdmin(user.roles)) {
      // Только админ может редактировать system шаблон
      throw ApiError.AccessDenied();
    }
    
    if (template.storageType === 'user' && template.userId?.toString() !== user._id) {
      // Пользователь может редактировать только свои user шаблоны
      throw ApiError.AccessDenied();
    }

    if (newFile) {
      if (template.storageType === 'system') {
        await this.filesService.deleteSystemFile(template.filePath);
        template.filePath = this.filesService.saveSystemFile(newFile, this.filesService.generateFileName(newFile.originalname));
      } else {
        await this.filesService.deleteYCFile(template.filePath);
        template.filePath = await this.filesService.saveYCFileTemplate(newFile, this.filesService.generateFileName(newFile.originalname), user);
      }
      
      template.variables = await this.filesService.extractVariables(newFile);
      template.mimeType = newFile.mimetype;
      template.name = newFile.originalname.replace(/\s+/g, '_'); // replace spaces with _
    }

    Object.assign(template, templateToEdit);

    const updatedTemplate = await template.save();
    const result: any = updatedTemplate.toObject();
    delete result.userId;
    delete result.filePath;

    return result;
  }

  async delete(id: string, user: any): Promise<boolean> {

    // Находим шаблон по id
    const template = await this.templateModel.findById(id).exec();
    // Проверяем, что шаблон существует
    if (!template) {
      throw ApiError.NotFound();
    }
    
    if (template.storageType === 'system' && !this.rolesService.isAdmin(user.roles)) {
      // Только админ может удалить system шаблон
      throw ApiError.AccessDenied();
    }

    if (template.storageType === 'user' && template.userId?.toString() !== user._id) {
      // Пользователь может удалить только свои user шаблоны
      throw ApiError.AccessDenied();
    }

    // remove template from storage
    if (template.storageType === 'system') {
      await this.filesService.deleteSystemFile(template.filePath);
    } else {
      await this.filesService.deleteYCFile(template.filePath);
    }

    return true;
  }

  // Получение переменных либо system шаблонов, либо только своих user шаблонов
  async getTemplateVariables(id: string, user: any): Promise<string[]> {
    const template = await this.templateModel
      .findById(id)
      .select('variables storageType userId')
      .exec();

    if (!template) {
      throw ApiError.NotFound();
    }

    if (template.storageType === 'user' && template.userId?.toString() !== user._id) {
      throw ApiError.AccessDenied();
    }

    return template.variables;
  }

  async createFromFile(file: Express.Multer.File, isSystem: boolean, user: any): Promise<Template> {
    if (!file || !file.buffer) {
      throw ApiError.BadRequest('Файл не был загружен');
    }

    if (!this.rolesService.isAdmin(user.roles) && file.size > 512 * 1024) {
      throw ApiError.BadRequest('Размер файла не должен превышать 512 КБ');
    }

    if (isSystem && !this.rolesService.isAdmin(user.roles)) {
      // only admin can add system template
      throw ApiError.AccessDenied();
    }

    const userDB = await this.userModel.findById(user._id).select('fileCount').lean().exec();
    const fileCount = userDB?.fileCount || 0;

    if (!isSystem && fileCount >= 5) {
      throw ApiError.BadRequest('Превышен лимит количества загружаемых шаблонов (максимум 5)');
    }

    // base data in template
    const originalName = file.originalname.replace(/\s+/g, '_'); // replace spaces with _

    const extension = path.extname(originalName).toLowerCase();
    if (extension !== '.docx') {
      throw ApiError.BadRequest('Поддерживаются только .docx файлы');
    }

    const mimeType = file.mimetype;
    const storageType: 'system' | 'user' = isSystem ? 'system' : 'user';
    const userId = isSystem ? null : user._id;

    const fileName = this.filesService.generateFileName(originalName); 

    let filePath: string;

    if (isSystem) {
      filePath = this.filesService.saveSystemFile(file, fileName);
    } else {
      filePath = await this.filesService.saveYCFileTemplate(file, fileName, user);
    }

    const variables = await this.filesService.extractVariables(file);

    // generate template document
    const template: ITemplate = {
      name: originalName,
      filePath,
      variables,
      storageType,
      userId,
      mimeType,
    };

    const savedTemplate = await this.templateModel.create(template);

    if (!isSystem) {
      await this.userModel.findByIdAndUpdate(
        user._id,
        { $inc: { fileCount: 1 } },
        { new: true }
      );
    }

    return savedTemplate;
  }
}
