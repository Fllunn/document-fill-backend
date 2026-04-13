import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import mongoose, { HydratedDocument } from 'mongoose';
import { NAME_USER_MAX_LEN, NAME_USER_MIN_LEN } from '../constants/user.constants';

export type UserDocument = HydratedDocument<UserClass>;

@Schema({ timestamps: true })
export class UserClass {
  @Prop({
    type: String,
    required: true,
    min: NAME_USER_MIN_LEN,
    max: NAME_USER_MAX_LEN
  })
  name!: string;

  @Prop({
    type: String,
    required: true,
    unique: true
  })
  email!: string;

  @Prop({
    type: String,
    required: true,
  })
  password!: string;

  @Prop({
    type: Array,
    default: ['user'],
    required: false,
  })
  roles!: string[];

  @Prop({
    type: Number,
    default: 0,
    required: false
  })
  fileCount?: number;

  @Prop({
    type: Array,
    required: true,
  })
  authMethods!: string[];
}

export const UserSchema = SchemaFactory.createForClass(UserClass);
