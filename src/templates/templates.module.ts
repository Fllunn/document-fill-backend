// DOCS: https://docs.nestjs.com/techniques/mongodb

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TemplatesController } from './templates.controller';
import { TemplatesService } from './templates.service';
import { Template, TemplateSchema } from './schemas/templates.schema';
import { RolesModule } from 'src/roles/roles.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: Template.name,
        schema: TemplateSchema,
        collection: 'templates'
      }
    ]),
    RolesModule
  ],
  controllers: [TemplatesController],
  providers: [TemplatesService],
})
export class TemplatesModule {}