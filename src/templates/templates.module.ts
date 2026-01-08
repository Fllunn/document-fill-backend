import { Module } from '@nestjs/common';
import { TemplatesController } from './templates.controller';
import { TokenModule } from 'src/token/token.module';
import UserModel from 'src/user/models/user.model';
import { AuthGuard } from 'src/auth/auth.guard';

@Module({
  imports: [TokenModule, UserModel],
  controllers: [TemplatesController],
  providers: [AuthGuard],
})
export class TemplatesModule { }
