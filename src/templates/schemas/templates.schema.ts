import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';

export type TemplatesDocument = HydratedDocument<TemplatesClass>;
@Schema({ _id: false })
class ITemplates {
  @Prop({
    type: String,
    required: true,
  })
  name: string;

  @Prop({
    type: String,
    required: true,
  })
  filePath: string;

  @Prop({
    type: Array,
    required: true,
  })
  variables: string[];

  @Prop({
    type: String,
    enum: ['system', 'user'],
    required: true,
  })
  storageType: 'system' | 'user';

  @Prop({
    type: String,
    required: false,
  })
  userId: string | null;

  @Prop({
    type: String,
    required: true,
  })
  mimeType: string;
}

@Schema()
export class TemplatesClass {
  @Prop({
    type: String,
    required: true,
  })
  name: string;

  @Prop({
    type: String,
    required: true,
  })
  filePath: string;

  @Prop({
    type: Array,
    default: [],
    required: true,
  })
  variables: string[];

  @Prop({
    type: String,
    required: true,
  })
  storageType: 'system' | 'user';

  @Prop({
    type: String,
    default: null,
    required: false,
  })
  userId: string | null;

  @Prop({
    type: String,
    required: true,
  })
  mimeType: string;
}

export const TemplatesSchema = SchemaFactory.createForClass(TemplatesClass);