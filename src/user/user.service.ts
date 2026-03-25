import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UserClass } from './schemas/user.schema';

@Injectable()
export class UserService {
  constructor(@InjectModel('User') private UserModel: Model<UserClass>) {}
}
