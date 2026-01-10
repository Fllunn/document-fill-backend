import { Module } from '@nestjs/common';
import { TemplatesController } from './templates.controller';
import { TemplatesService } from './templates.service';
import TemplatesModel from './models/templates.model';
import { TokenModule } from 'src/token/token.module';
import UserModel from 'src/user/models/user.model';

@Module({
  imports: [TemplatesModel, TokenModule, UserModel],
  controllers: [TemplatesController],
  providers: [TemplatesService],
})
export class TemplatesModule {}