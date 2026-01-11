// DOCS: https://docs.nestjs.com/techniques/mongodb

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type TemplateDocument = HydratedDocument<Template>;


@Schema({ timestamps: true, collection: 'templates' })
export class Template {

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  filePath: string;

  @Prop({ type: [String], default: [] })
  variables: string[];

  @Prop({ required: true, enum: ['system', 'user'] })
  storageType: string;

  @Prop({ type: String, default: null })
  userId: string | null;

  @Prop({ required: true })
  mimeType: string;
}

export const TemplateSchema = SchemaFactory.createForClass(Template);