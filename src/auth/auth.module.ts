import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TokenModule } from 'src/token/token.module';

import { JwtModule } from '@nestjs/jwt';
import { RolesService } from 'src/roles/roles.service';
import { MongooseModule } from '@nestjs/mongoose';

// mongodb
import UserModel from 'src/user/models/user.model';
import { AuthGuard } from './auth.guard';
import { Template, TemplateSchema } from 'src/templates/schemas/templates.schema';
import { Photo, PhotoSchema } from 'src/photos/schemas/photos.schema';
import { FilesModule } from 'src/files/files.module';

@Module({
  imports: [
    TokenModule,
    JwtModule,
    UserModel,
    FilesModule,
    MongooseModule.forFeature([
      { name: Template.name, schema: TemplateSchema, collection: 'templates' },
      { name: Photo.name, schema: PhotoSchema, collection: 'photos' },
    ]),
  ],
  controllers: [AuthController],
  providers: [AuthService, RolesService, AuthGuard],
  exports: [TokenModule, AuthGuard]
})
export class AuthModule { }
