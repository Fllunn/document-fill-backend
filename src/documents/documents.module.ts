import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { CryptoService } from './crypto.service';
import { Template, TemplateSchema } from 'src/templates/schemas/templates.schema';
import { TokenModule } from 'src/token/token.module';
import { FilesModule } from 'src/files/files.module';
import UserModel from 'src/user/models/user.model';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Template.name,
        schema: TemplateSchema,
        collection: 'templates',
      },
    ]),
    TokenModule,
    FilesModule,
    UserModel,
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService, CryptoService],
})
export class DocumentsModule {}