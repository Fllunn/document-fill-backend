import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type ExpiringKeyDocument = HydratedDocument<ExpiringKey>;

// ключ со сроком жизни (замена Redis SET ... EX)
@Schema({ collection: 'expiring_keys', versionKey: false })
export class ExpiringKey {
  @Prop({ type: String, required: true })
  _id!: string;

  @Prop({ type: String, required: true })
  value!: string;

  // TTL-индекс: Mongo сама удаляет просроченные записи (проверка раз в ~60 секунд)
  @Prop({ type: Date, required: true, index: { expires: 0 } })
  expiresAt!: Date;
}

export const ExpiringKeySchema = SchemaFactory.createForClass(ExpiringKey);
