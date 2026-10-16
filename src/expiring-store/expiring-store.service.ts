import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ExpiringKey } from './expiring-key.schema';

/**
 * Хранилище ключей со сроком жизни в Mongo (вместо Redis).
 * TTL-индекс удаляет записи с задержкой до минуты, поэтому срок дополнительно проверяется при чтении.
 */
@Injectable()
export class ExpiringStoreService {
  constructor(
    @InjectModel(ExpiringKey.name) private readonly model: Model<ExpiringKey>,
  ) {}

  private notExpired(key: string) {
    return { _id: key, expiresAt: { $gt: new Date() } };
  }

  async set(key: string, value: string, ttlSeconds: number): Promise<void> {
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    await this.model.updateOne({ _id: key }, { value, expiresAt }, { upsert: true }).exec();
  }

  async get(key: string): Promise<string | null> {
    const doc = await this.model.findOne(this.notExpired(key)).lean().exec();
    return doc?.value ?? null;
  }

  // атомарно прочитать и удалить (одноразовые коды)
  async take(key: string): Promise<string | null> {
    const doc = await this.model.findOneAndDelete(this.notExpired(key)).lean().exec();
    return doc?.value ?? null;
  }

  async exists(key: string): Promise<boolean> {
    return !!(await this.model.exists(this.notExpired(key)).exec());
  }

  async del(key: string): Promise<number> {
    const result = await this.model.deleteOne({ _id: key }).exec();
    return result.deletedCount;
  }
}
