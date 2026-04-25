import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { FilesModule } from 'src/files/files.module';
import { RolesModule } from 'src/roles/roles.module';
import { TokenModule } from 'src/token/token.module';
import UserModel from 'src/user/models/user.model';

import { PhotosService } from './photos.service';
import { Photo, PhotoSchema } from './schemas/photos.schema';
import { PhotosController } from './photos.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Photo.name,
        schema: PhotoSchema,
        collection: 'photos',
      },
    ]),
    FilesModule,
    RolesModule,
    TokenModule,
    UserModel,
  ],
  controllers: [PhotosController],
  providers: [PhotosService],
  exports: [PhotosService],
})
export class PhotosModule {}
