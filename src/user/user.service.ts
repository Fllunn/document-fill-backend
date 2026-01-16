import { Injectable } from '@nestjs/common';
import { RolesService } from 'src/roles/roles.service';
import { User } from './interfaces/user.interface';
import ApiError from 'src/exceptions/errors/api-error';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UserClass } from './schemas/user.schema';

@Injectable()
export class UserService {
  constructor(
    @InjectModel('User') private UserModel: Model<UserClass>,
    private RolesService: RolesService
  ) {}

  async setUserTemplateCategories(user: any, categories: string[]) {
    if (!Array.isArray(categories)) {
      throw ApiError.BadRequest('Категории должны быть массивом строк');
    }

    if (!categories.every(cat => typeof cat === 'string')) {
      throw ApiError.BadRequest('Все категории должны быть строками');
    }

    const userDB = await this.UserModel.findById(user._id).exec();
    if (!userDB) {
      throw ApiError.BadRequest('Пользователь не найден');
    }

    userDB.templateCategories = categories;
    await userDB.save();

    const { templateCategories } = userDB.toObject();
    return { templateCategories };
  }

  async getUserTemplateCategories(user: any) {
    const userDB = await this.UserModel.findById(user._id).select('templateCategories').lean().exec();
    if (!userDB) {
      throw ApiError.BadRequest('Пользователь не найден');
    }

    return { templateCategories: userDB.templateCategories || [] };
  }

  async deleteUserTemplateCategories(user: any) {
    const userDB = await this.UserModel.findByIdAndUpdate(user._id, { templateCategories: [] }, { new: true }).lean().exec();
    if (!userDB) {
      throw ApiError.BadRequest('Пользователь не найден');
    }

    return { templateCategories: userDB.templateCategories || [] };
  }
}
