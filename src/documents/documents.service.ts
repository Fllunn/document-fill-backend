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
}
