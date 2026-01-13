import { Model } from 'mongoose';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Document } from './schemas/documents.schema';
import { IDocumentToEdit } from './interfaces/IDocumentsToEdit';
import { IDocumentToCreate } from './interfaces/IDocumentsToCreate';
import ApiError from 'src/exceptions/errors/api-error';
import { RolesService } from 'src/roles/roles.service';
import { Template } from 'src/templates/schemas/templates.schema';
import { FilesService } from 'src/files/files.service';
import { Types } from 'mongoose';


@Injectable()
export class DocumentsService {
  constructor(
    @InjectModel(Document.name) private documentModel: Model<Document>,
    @InjectModel(Template.name) private templateModel: Model<Template>,
    private filesService: FilesService,
    private rolesService: RolesService,
  ) {}

  async create(document: IDocumentToCreate, user: any, folderPath?: string): Promise<Document> {
    const template = await this.templateModel.findById(document.templateId).exec();
    
    if (!template) {
      throw ApiError.NotFound('Шаблон не найден');
    }

    const fileName = `${new Types.ObjectId().toString()}-${template.name}`;

    const documentBuffer = await this.filesService.fillTemplate(template.filePath, document.values);

    const filePath = await this.filesService.saveYCFileDocument(
      { buffer: documentBuffer } as Express.Multer.File,
      fileName,
      user,
      folderPath
    )

    const createdDocument = new this.documentModel({
      templateId: document.templateId,
      userId: user._id,
      values: document.values,
      file: {
        path: this.filesService.normalizeYCFilePath(filePath),
        size: documentBuffer.byteLength,
        mimeType: fileName.endsWith('.pdf') ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      }
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

  async update(id: string, user: any, documentToEdit: IDocumentToEdit, folderPath?: string): Promise<Document> {
    const document = await this.documentModel.findById(id).exec();
    
    if (!document) {
      throw ApiError.NotFound();
    }

    if (document.userId.toString() !== user._id.toString() && !this.rolesService.isAdmin(user.roles)) {
      throw ApiError.AccessDenied();
    }

    // if values updated
    if (documentToEdit.values) {
      const template = await this.templateModel.findById(document.templateId).exec();
      if (!template) throw ApiError.NotFound();

      const documentBuffer = await this.filesService.fillTemplate(template.filePath, documentToEdit.values);
      
      // delete old file
      if (document.file?.path){
        await this.filesService.deleteYCFile(document.file.path);
      }

      const fileName = `${new Types.ObjectId().toString()}-${template.name}`;
      const newFilePath = await this.filesService.saveYCFileDocument(
        { buffer: documentBuffer } as Express.Multer.File,
        fileName,
        user,
        folderPath
      );

      document.file = {
        path: this.filesService.normalizeYCFilePath(newFilePath),
        size: documentBuffer.byteLength,
        mimeType: fileName.endsWith('.pdf') ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      }
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

    if (document.file?.path) {
      await this.filesService.deleteYCFile(document.file.path);
    }
    await this.documentModel.deleteOne({ _id: id }).exec();

    return true;
  }
}
