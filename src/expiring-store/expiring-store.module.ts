import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ExpiringKey, ExpiringKeySchema } from './expiring-key.schema';
import { ExpiringStoreService } from './expiring-store.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: ExpiringKey.name, schema: ExpiringKeySchema }]),
  ],
  providers: [ExpiringStoreService],
  exports: [ExpiringStoreService],
})
export class ExpiringStoreModule {}
