// DOCS: https://docs.nestjs.com/techniques/mongodb

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { Document, DocumentSchema } from './schemas/documents.schema';
import { Template, TemplateSchema } from 'src/templates/schemas/templates.schema';
import { RolesModule } from 'src/roles/roles.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Document.name,
        schema: DocumentSchema,
        collection: 'documents'
      },
      {
        name: Template.name,
        schema: TemplateSchema,
        collection: 'templates'
      }
    ]),
    RolesModule
  ],
  controllers: [DocumentsController],
  providers: [DocumentsService],
})
export class DocumentsModule {}