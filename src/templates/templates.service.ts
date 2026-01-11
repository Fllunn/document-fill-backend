import { Model } from 'mongoose';
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Template } from './schemas/templates.schema';
import { CreateTemplateDto } from './dto/create-template.dto';

@Injectable()
export class TemplatesService {
  constructor(@InjectModel(Template.name) private templateModel: Model<Template>) {}

  async create(createTemplate: CreateTemplateDto): Promise<Template> {
    const createdTemplate = new this.templateModel(createTemplate);
    return createdTemplate.save();
  }

  async findAll(): Promise<Template[]> {
    return this.templateModel.find().exec();
  }
}
