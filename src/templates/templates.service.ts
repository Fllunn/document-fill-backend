import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { TemplatesClass, TemplatesDocument } from './schemas/templates.schema';
import ApiError from 'src/exceptions/errors/api-error';
import { ITemplatesToEdit } from './interfaces/ITemplatesToEdit';
import YaCloud from 'src/s3/bucket';

@Injectable()
export class TemplatesService {
  constructor(
    @InjectModel('Templates') private TemplatesModel: Model<TemplatesClass>,
  ) {}

  async create(
    templateData: any,
    file: Express.Multer.File,
    userId: string,
    userRoles: string[],
  ): Promise<TemplatesDocument> {
    // Проверка что только админы могут создавать системные шаблоны
    if (templateData.storageType === 'system') {
      if (!userRoles || !userRoles.includes('admin')) {
        throw ApiError.AccessDenied();
      }
      // Для системных шаблонов filePath указывается вручную админом
      if (!templateData.filePath) {
        throw ApiError.BadRequest('Для системных шаблонов необходимо указать filePath');
      }
    }

    // Для пользовательских шаблонов обязателен файл
    if (templateData.storageType === 'user') {
      if (!file) {
        throw ApiError.BadRequest('Необходимо загрузить файл шаблона');
      }
    }

    // Проверка лимита для обычных пользователей
    if (!userRoles || !userRoles.includes('admin')) {
      const userTemplatesCount = await this.TemplatesModel.countDocuments({
        userId: userId,
        storageType: 'user',
      });

      if (userTemplatesCount >= 5) {
        throw ApiError.BadRequest(
          'Достигнут лимит шаблонов. Максимум 5 шаблонов для пользователя',
        );
      }
    }

    // Загрузка файла в Yandex Cloud для пользовательских шаблонов
    if (templateData.storageType === 'user' && file) {
      const fileName = `${Date.now()}_${file.originalname}`;
      const path = `templates/${userId}`;

      const uploadResult = await YaCloud.Upload({
        file: file,
        path: path,
        fileName: fileName,
      });

      // Путь генерируется на бекенде, игнорируем то что пришло от клиента
      templateData.filePath = uploadResult.Key;
    }

    const template = await this.TemplatesModel.create(templateData);
    return template;
  }

  async deleteById(_id: string, userId: string, userRoles: string[]): Promise<TemplatesDocument> {
    const template = await this.TemplatesModel.findById(_id);
    if (!template) {
      throw ApiError.BadRequest('Шаблон не найден');
    }

    // Обычный пользователь может удалить только свой шаблон
    if (!userRoles || !userRoles.includes('admin')) {
      if (template.userId?.toString() !== userId.toString()) {
        throw ApiError.AccessDenied();
      }
    }

    // Удаление файла из Yandex Cloud для пользовательских шаблонов
    if (template.storageType === 'user') {
      // TODO: добавить метод Delete в YaCloud для удаления файла
      // await YaCloud.Delete({ key: template.filePath });
    }

    await this.TemplatesModel.findByIdAndDelete(_id);
    return template;
  }

  async editById(updates: ITemplatesToEdit, _id: string, userId: string, userRoles: string[]): Promise<TemplatesDocument> {
    const template = await this.TemplatesModel.findById(_id);
    if (!template) {
      throw ApiError.BadRequest('Шаблон не найден');
    }

    // Обычный пользователь может редактировать только свой шаблон
    if (!userRoles || !userRoles.includes('admin')) {
      if (template.userId?.toString() !== userId.toString()) {
        throw ApiError.AccessDenied();
      }
    }

    const updatedTemplate = await this.TemplatesModel.findByIdAndUpdate(
      _id,
      updates,
      { new: true },
    );
    if (!updatedTemplate) {
      throw ApiError.BadRequest('Ошибка при обновлении шаблона');
    }
    return updatedTemplate;
  }

  async getAllTemplates(userId: string, userRoles: string[],): Promise<TemplatesDocument[]> {
    // admin видит все шаблоны
    if (userRoles && userRoles.includes('admin')) {
      return await this.TemplatesModel.find();
    }

    // user видит системные + свои
    const templates = await this.TemplatesModel.find({
      $or: [{ storageType: 'system' }, { userId: userId, storageType: 'user' }],
    });

    return templates;
  }

  async getUserTemplatesCount(userId: string): Promise<number> {
    return await this.TemplatesModel.countDocuments({
      userId: userId,
      storageType: 'user',
    });
  }
}
