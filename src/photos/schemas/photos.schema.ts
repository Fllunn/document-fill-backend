import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type PhotoDocument = HydratedDocument<Photo>;

@Schema({ timestamps: true, collection: 'photos' })
export class Photo {
  @Prop({ required: true })
  userId: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  originalName: string;

  @Prop({ required: true })
  filePath: string;

  @Prop({ required: true })
  size: number;

  @Prop({ required: true })
  mimeType: string;
}

export const PhotoSchema = SchemaFactory.createForClass(Photo);
