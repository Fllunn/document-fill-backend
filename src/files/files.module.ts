// DOCS: https://docs.nestjs.com/techniques/mongodb

import { Module } from '@nestjs/common';
import { FilesService } from './files.service';

@Module({
  providers: [FilesService],
  exports: [FilesService]
})
export class FilesModule {}