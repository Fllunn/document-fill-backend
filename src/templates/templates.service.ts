// NestJS
import { Injectable } from '@nestjs/common';

// MongoDB
import { isValidObjectId, Model, Types } from 'mongoose';
import { InjectModel } from '@nestjs/mongoose';

// Schemas and Interfaces
import { Template } from './schemas/templates.schema';
import { User } from 'src/user/interfaces/user.interface';
import { ITemplate } from './interfaces/templates.interface';

// Services
import { RolesService } from 'src/roles/roles.service';
import { FilesService } from 'src/files/files.service';
import { UserService } from 'src/user/user.service';

// Errors
import ApiError from 'src/exceptions/errors/api-error';

// Other
import * as path from 'path';
import * as fs from 'fs';
import { UpdateTemplateDto } from './dto/update-template.dto';
import { TABLE_COUNT_LIMIT, TEMPLATE_FIELDS_LIMIT, TEMPLATE_MAX_SIZE, TOTAL_VALUES_MAX_LENGTH, VALUE_KEY_MAX_LENGTH } from 'src/constants/app.constants';

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
      .select('name storageType createdAt')
      .lean()
      .exec();

    return templates;
  }

  async findOne(id: string, user: any): Promise<Template> {
    if (!isValidObjectId(id)) {
      throw ApiError.BadRequest('Некорректный ID шаблона');
    }

    const template = await this.templateModel
      .findById(id)
      .select('name storageType userId')
      .exec();
    if (!template) {
      throw ApiError.NotFound();
    }

    if (template.storageType === 'user' && template.userId?.toString() !== user._id.toString()) {
      // Пользователь может получить только свои user шаблоны
      throw ApiError.AccessDenied();
    }

    const result: any = template.toObject();
    delete result.userId;
    return result;
  }

  async update(id: string, user: any, templateToEdit: UpdateTemplateDto, newFile?: Express.Multer.File): Promise<Template> {
    const template = await this.templateModel.findById(id).exec();
    
    if (!template) {
      throw ApiError.NotFound();
    }

    if (template.storageType === 'system' && !this.rolesService.isAdmin(user.roles)) {
      // Только админ может редактировать system шаблон
      throw ApiError.AccessDenied();
    }
    
    if (template.storageType === 'user' && template.userId?.toString() !== user._id.toString()) {
      // Пользователь может редактировать только свои user шаблоны
      throw ApiError.AccessDenied();
    }

    if (newFile) {
      const extractedVariables = await this.filesService.extractVariables(newFile);

      if (extractedVariables.length === 0) {
        throw ApiError.BadRequest('В шаблоне не найдено полей для заполнения. Они должны быть в формате {Имя}');
      }
      const tableNamesUpdate = new Set(extractedVariables.filter(v => v.includes('[]')).map(v => v.split('[]')[0]));

      const simpleFieldNamesUpdate = new Set(extractedVariables.filter(v => !v.includes('[]') && !v.includes('.')));

      for (const tableName of tableNamesUpdate) {
        if (simpleFieldNamesUpdate.has(tableName))
          throw ApiError.BadRequest(`Название таблицы "${tableName}" совпадает с названием другого поля. Пожалуйста, используйте разные названия`);
      }
      if (!this.rolesService.isAdmin(user.roles) && extractedVariables.length > TEMPLATE_FIELDS_LIMIT)
        throw ApiError.BadRequest(`Шаблон содержит более ${TEMPLATE_FIELDS_LIMIT} полей`);

      const tableCountUpdate = new Set(extractedVariables.filter(v => v.includes('[].')).map(v => v.split('[]')[0])).size;

      if (!this.rolesService.isAdmin(user.roles) && tableCountUpdate > TABLE_COUNT_LIMIT)
        throw ApiError.BadRequest(`Шаблон содержит более ${TABLE_COUNT_LIMIT} таблиц`);

      if (!this.rolesService.isAdmin(user.roles)) {
        for (const variable of extractedVariables) {
          const segments = variable.replace(/\[\]/g, '.').split('.').filter(Boolean);
          for (const segment of segments) {
            if (segment.length > VALUE_KEY_MAX_LENGTH)
              throw ApiError.BadRequest(`Название поля "${segment.slice(0, 50)}" превышает ${VALUE_KEY_MAX_LENGTH} символов`);
          }
        }
      }
      
      const textLengthUpdate = await this.filesService.extractTemplateTextLength(newFile.buffer);
      if (!this.rolesService.isAdmin(user.roles) && textLengthUpdate > TOTAL_VALUES_MAX_LENGTH)
        throw ApiError.BadRequest('Шаблон содержит слишком много текста');

      if (template.storageType === 'system') {
        await this.filesService.deleteSystemFile(template.filePath);
        template.filePath = this.filesService.saveSystemFile(newFile, this.filesService.generateFileName(newFile.originalname));
      } else {
        await this.filesService.deleteYCFile(template.filePath);
        template.filePath = await this.filesService.saveYCFileTemplate(newFile, this.filesService.generateFileName(newFile.originalname), user);
      }

      template.variables = extractedVariables;
      template.name = path.parse(newFile.originalname).name.replace(/\s+/g, '_');
    }

    const { file, ...templateFields } = templateToEdit;
    Object.assign(template, templateFields);

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

    if (template.storageType === 'user' && template.userId?.toString() !== user._id.toString()) {
      // Пользователь может удалить только свои user шаблоны
      throw ApiError.AccessDenied();
    }

    // remove template from storage
    if (template.storageType === 'system') {
      await this.filesService.deleteSystemFile(template.filePath);
    } else {
      await this.filesService.deleteYCFile(template.filePath);
    }

    await this.templateModel.findByIdAndDelete(id);

    if (template.storageType !== 'system' && !this.rolesService.isAdmin(user.roles)) {
      await this.userModel.findByIdAndUpdate(
        user._id,
        { $inc: { fileCount: -1 } },
        { new: true }
      );
    }

    return true;
  }

  // Получение переменных либо system шаблонов, либо только своих user шаблонов
  async getTemplateVariables(id: string, user: any): Promise<Record<string, string[]>> {
    const template = await this.templateModel
      .findById(id)
      .select('variables storageType userId')
      .lean()
      .exec();

    if (!template) {
      throw ApiError.NotFound();
    }

    if (template.storageType === 'user' && template.userId?.toString() !== user._id?.toString()) {
      throw ApiError.AccessDenied();
    }

    const grouped: Record<string, string[]> = {};
    
    template.variables.forEach((v: string) => {
      const firstDot = v.indexOf('.');
      
      let category: string;
      let name: string;
      
      if (firstDot === -1) {
        category = 'Разное';
        name = v;
      } else {
        category = v.slice(0, firstDot).trim();
        name = v.slice(firstDot + 1).trim();
      }

      if (!category) category = 'Разное';
      if (!name) return;

      if (!grouped[category]) {
        grouped[category] = [];
      }

      grouped[category].push(name);
    })

    return grouped;
  }

  async removeSavedName(id: string, pattern: string, user: any): Promise<boolean> {
    if (!isValidObjectId(id)) {
      throw ApiError.BadRequest('Некорректный ID шаблона');
    }

    const template = await this.templateModel
      .findById(id)
      .select('storageType userId')
      .lean()
      .exec();

    if (!template) {
      throw ApiError.NotFound();
    }

    if (template.storageType !== 'user' || template.userId?.toString() !== user._id.toString()) {
      throw ApiError.AccessDenied();
    }

    await this.templateModel.findByIdAndUpdate(
      id,
      { $pull: { savedNames: pattern } },
    ).lean().exec();

    return true;
  }

  async getSavedNames(id: string, user: any): Promise<string[]> {
    if (!isValidObjectId(id)) {
      throw ApiError.BadRequest('Некорректный ID шаблона');
    }

    const template = await this.templateModel
      .findById(id)
      .select('storageType userId savedNames')
      .lean()
      .exec();

    if (!template) {
      throw ApiError.NotFound();
    }

    if (template.storageType === 'system') {
      return [];
    }

    if (template.userId?.toString() !== user._id.toString()) {
      throw ApiError.AccessDenied();
    }

    return template.savedNames ?? [];
  }

  async downloadTemplate(id: string, user: any): Promise<{ buffer: Buffer; name: string }> {
    const template = await this.templateModel
      .findById(id)
      .select('name filePath storageType userId')
      .exec();

    if (!template) {
      throw ApiError.NotFound();
    }

    if (template.storageType === 'user' && template.userId?.toString() !== user._id.toString()) {
      throw ApiError.AccessDenied();
    }

    let buffer: Buffer;

    if (template.storageType === 'system') {
      const filePath = path.normalize(template.filePath);

      if (!fs.existsSync(filePath)) {
        throw ApiError.NotFound();
      }
      
      buffer = fs.readFileSync(filePath);
    } else {
      buffer = await this.filesService.getYCFileBuffer(template.filePath);
    }

    return { buffer, name: `${template.name}.docx` };
  }

  async createFromFile(file: Express.Multer.File, isSystem: boolean, user: any): Promise<Template> {
    if (!file || !file.buffer) {
      throw ApiError.BadRequest('Файл не был загружен');
    }

    if (!this.rolesService.isAdmin(user.roles) && file.size > TEMPLATE_MAX_SIZE) {
      throw ApiError.BadRequest('Размер файла не должен превышать 512 КБ');
    }

    if (isSystem && !this.rolesService.isAdmin(user.roles)) {
      // only admin can add system template
      throw ApiError.AccessDenied();
    }

    const userDB = await this.userModel.findById(user._id).select('fileCount').lean().exec();
    const fileCount = userDB?.fileCount || 0;

    if (!this.rolesService.isAdmin(user.roles) && !isSystem && fileCount >= 5) {
      throw ApiError.BadRequest('Превышен лимит количества загружаемых шаблонов (максимум 5)');
    }

    // base data in template
    const parsedFileName = path.parse(file.originalname);
    const originalName = parsedFileName.name.replace(/\s+/g, '_'); // replace spaces with _
    const extension = parsedFileName.ext.toLowerCase();

    if (extension !== '.docx') {
      throw ApiError.BadRequest('Поддерживаются только .docx файлы');
    }

    const variables = await this.filesService.extractVariables(file);
    if (variables.length === 0) {
      throw ApiError.BadRequest('В шаблоне не найдено полей для заполнения. Они должны быть в формате {Имя}');
    }
    const tableNames = new Set(variables.filter(v => v.includes('[]')).map(v => v.split('[]')[0]));
    const simpleFieldNames = new Set(variables.filter(v => !v.includes('[]') && !v.includes('.')));

    for (const tableName of tableNames) {
      if (simpleFieldNames.has(tableName))
        throw ApiError.BadRequest(`Название таблицы "${tableName}" совпадает с названием другого поля. Пожалуйста, используйте разные названия`);
    }
    
    if (!this.rolesService.isAdmin(user.roles) && variables.length > TEMPLATE_FIELDS_LIMIT)
      throw ApiError.BadRequest(`Шаблон содержит более ${TEMPLATE_FIELDS_LIMIT} полей`);
    const tableCount = new Set(variables.filter(v => v.includes('[].')).map(v => v.split('[]')[0])).size;
    if (!this.rolesService.isAdmin(user.roles) && tableCount > TABLE_COUNT_LIMIT)
      throw ApiError.BadRequest(`Шаблон содержит более ${TABLE_COUNT_LIMIT} таблиц`);
    if (!this.rolesService.isAdmin(user.roles)) {
      for (const variable of variables) {
        const segments = variable.replace(/\[\]/g, '.').split('.').filter(Boolean);
        for (const segment of segments) {
          if (segment.length > VALUE_KEY_MAX_LENGTH)
            throw ApiError.BadRequest(`Название поля "${segment.slice(0, 50)}" превышает ${VALUE_KEY_MAX_LENGTH} символов`);
        }
      }
    }
    const textLength = await this.filesService.extractTemplateTextLength(file.buffer);
    if (!this.rolesService.isAdmin(user.roles) && textLength > TOTAL_VALUES_MAX_LENGTH)
      throw ApiError.BadRequest('Шаблон содержит слишком много текста');

    const storageType: 'system' | 'user' = isSystem ? 'system' : 'user';
    const userId = isSystem ? null : user._id;

    const fileName = this.filesService.generateFileName(`${originalName}${extension}`);

    let filePath: string;

    if (isSystem) {
      filePath = this.filesService.saveSystemFile(file, fileName);
    } else {
      filePath = await this.filesService.saveYCFileTemplate(file, fileName, user);
    }

    // generate template document
    const template: ITemplate = {
      name: originalName,
      filePath,
      variables,
      storageType,
      userId,
    };

    const savedTemplate = await this.templateModel.create(template);

    if (!isSystem && !this.rolesService.isAdmin(user.roles)) {
      await this.userModel.findByIdAndUpdate(
        user._id,
        { $inc: { fileCount: 1 } },
        { new: true }
      );
    }

    return savedTemplate;
  }
}
