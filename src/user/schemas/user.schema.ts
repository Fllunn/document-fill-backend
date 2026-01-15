import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<UserClass>;

@Schema()
export class UserClass {
  @Prop({
    type: String,
    required: true,
    min: 2,
  })
  name: string;

  @Prop({
    type: String,
    required: true,
    unique: true
  })
  email: string;

  @Prop({
    type: String,
    required: true,
  })
  password: string;

  @Prop({
    type: Array,
    default: ['user'],
    required: false,
  })
  roles: string[];

  @Prop({
    type: Array,
    default: [],
    required: false
  })
  avatars: string[];

  @Prop({
    type: Number,
    default: 0,
    required: false
  })
  fileCount?: number;
}

export const UserSchema = SchemaFactory.createForClass(UserClass);