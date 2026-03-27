import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import { TokenType } from '../interfaces/token.interface';

export type TokenDocument = HydratedDocument<TokenClass>

@Schema()
export class TokenClass {
  @Prop({ 
    type: String, 
    required: true 
  })
  token!: string;

  @Prop({
    type: String,
    required: true,
    enum: Object.values(TokenType)
  })
  type!: TokenType;

  @Prop({
    type: Date,
    required: true
  })
  expiresIn!: Date;
}

export const TokenSchema = SchemaFactory.createForClass(TokenClass)
