import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { AuthModule } from 'src/auth/auth.module';
import UserModel from 'src/user/models/user.model';

@Module({
  imports: [UserModel, AuthModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
