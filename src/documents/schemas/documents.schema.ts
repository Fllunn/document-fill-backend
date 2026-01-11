// DOCS: https://docs.nestjs.com/techniques/mongodb

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type DocDocument = HydratedDocument<Document>;


@Schema({ timestamps: true, collection: 'documents' })
export class Document {

  @Prop({ required: true })
  templateId: string;

  @Prop({ required: true })
  userId: string;

  @Prop({ required: true, type: Object })
  values: Record<string, any>;

  @Prop({
    type: {
      path: { type: String, required: true },
      size: { type: Number, required: true },
      mimeType: { type: String, required: true }
    },
    required: false
  })
  file?: {
    path: string;
    size: number;
    mimeType: string;
  };
}

export const DocumentSchema = SchemaFactory.createForClass(Document);