import { Model } from 'mongoose';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Template } from './schemas/templates.schema';
import { ITemplateToEdit } from './interfaces/ITemplatesToEdit';
import ApiError from 'src/exceptions/errors/api-error';
import { RolesService } from 'src/roles/roles.service';

@Injectable()
export class TemplatesService {
  constructor(
    @InjectModel(Template.name) private templateModel: Model<Template>,
    private rolesService: RolesService,
  ) {}

  async create(template: ITemplate, user: any): Promise<Template> {
    // Только админ может добавть system шаблон
    // Через RolesService проверяем, что у пользователя есть роль admin
    if (template.storageType === 'system' && !this.rolesService.isAdmin(user.roles)) {
      throw ApiError.AccessDenied();
    }

    // Для user шаблонов автоматически устанавливаем userId, для system по умолчанию null
    if (template.storageType === 'user') {
      template.userId = user._id;
    }

    const createdTemplate = new this.templateModel(template);
    const savedTemplate = await createdTemplate.save();

    const result: any = savedTemplate.toObject();
    delete result.userId; // Не возвращаем userId
    delete result.filePath; // Не возвращаем filePath

    return result;
  }

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

  async update(id: string, user: any, templateToEdit: ITemplateToEdit): Promise<ITemplateToEdit> {
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

    Object.assign(template, templateToEdit); // обноввляем поля шаблона
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

    await template.deleteOne();;
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
      // Пользователь может получить переменные только своих user шаблонов
      throw ApiError.AccessDenied();
    }

    return template.variables;
  }
}
