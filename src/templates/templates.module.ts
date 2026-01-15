// DOCS: https://docs.nestjs.com/techniques/mongodb

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TemplatesController } from './templates.controller';
import { TemplatesService } from './templates.service';
import { Template, TemplateSchema } from './schemas/templates.schema';
import { RolesModule } from 'src/roles/roles.module';
import { TokenModule } from 'src/token/token.module';
import { UserClass, UserSchema } from 'src/user/schemas/user.schema';
import { AuthGuard } from 'src/auth/auth.guard';
import { FilesModule } from 'src/files/files.module';
import { UserModule } from 'src/user/user.module';
import { UserService } from 'src/user/user.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Template.name,
        schema: TemplateSchema,
        collection: 'templates'
      },
      {
        name: 'User',
        schema: UserSchema
      }
    ]),
    RolesModule,
    TokenModule,
    FilesModule,
    UserModule
  ],
  controllers: [TemplatesController],
  providers: [TemplatesService, AuthGuard],
})
export class TemplatesModule {}