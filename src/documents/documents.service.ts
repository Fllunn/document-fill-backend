import { Model } from 'mongoose';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Document } from './schemas/documents.schema';
import { IDocumentToEdit } from './interfaces/IDocumentsToEdit';
import { IDocumentToCreate } from './interfaces/IDocumentsToCreate';
import ApiError from 'src/exceptions/errors/api-error';
import { RolesService } from 'src/roles/roles.service';
import { Template } from 'src/templates/schemas/templates.schema';

@Injectable()
export class DocumentsService {
  constructor(
    @InjectModel(Document.name) private documentModel: Model<Document>,
    @InjectModel(Template.name) private templateModel: Model<Template>,
    private rolesService: RolesService,
  ) {}

  async create(document: IDocumentToCreate, user: any): Promise<Document> {
    const template = await this.templateModel.findById(document.templateId).exec();
    
    if (!template) {
      throw ApiError.NotFound('Шаблон не найден');
    }

    const createdDocument = new this.documentModel({
      templateId: document.templateId,
      userId: user._id,
      values: document.values,
    });

    const savedDocument = await createdDocument.save();
    const result: any = savedDocument.toObject();
    delete result.userId;

    return result;
  }

  async findOne(id: string, user: any): Promise<Document> {
    const document = await this.documentModel.findById(id).exec();
    
    if (!document) {
      throw ApiError.NotFound();
    }

    if (document.userId.toString() !== user._id.toString() && !this.rolesService.isAdmin(user.roles)) {
      throw ApiError.AccessDenied();
    }

    const result: any = document.toObject();
    delete result.userId;

    return result;
  }

  async findAll(user: any): Promise<Document[]> {
    const documents = await this.documentModel
      .find({
        $or: [
          { userId: user._id },
        ]
      })
      .select('-userId')
      // .lean для возврата JS объектов вместо Mongoose документов (работает быстрее)0
      .lean()
      .exec();

    return documents;
  }

  async update(id: string, user: any, documentToEdit: IDocumentToEdit): Promise<Document> {
    const document = await this.documentModel.findById(id).exec();
    
    if (!document) {
      throw ApiError.NotFound();
    }

    if (document.userId.toString() !== user._id.toString() && !this.rolesService.isAdmin(user.roles)) {
      throw ApiError.AccessDenied();
    }

    Object.assign(document, documentToEdit);

    const updatedDocument = await document.save();
    const result: any = updatedDocument.toObject();
    delete result.userId;
    return result;
  }

  async delete(id: string, user: any): Promise<boolean> {
    const document = await this.documentModel.findById(id).exec();
    
    if (!document) {
      throw ApiError.NotFound();
    }

    if (document.userId.toString() !== user._id.toString() && !this.rolesService.isAdmin(user.roles)) {
      throw ApiError.AccessDenied();
    }

    await this.documentModel.deleteOne({ _id: id }).exec();

    return true;
  }
}
