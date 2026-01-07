import { Controller, Post, Body } from '@nestjs/common';
import { AdminService } from './admin.service';


// all about MongoDB
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UserClass } from 'src/user/schemas/user.schema';
import ApiError from 'src/exceptions/errors/api-error';

@Controller('admin')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    @InjectModel('User') private UserModel: Model<UserClass>,
  ) { }
}
