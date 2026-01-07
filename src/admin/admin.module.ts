import { Module } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import UserModel from 'src/user/models/user.model';

@Module({
  controllers: [AdminController],
  providers: [AdminService],
  imports: [UserModel]
})
export class AdminModule { }
