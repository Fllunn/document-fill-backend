import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { isValidObjectId, Model } from 'mongoose';
import { UserClass } from 'src/user/schemas/user.schema';
import { RolesService } from 'src/roles/roles.service';
import ApiError from 'src/exceptions/errors/api-error';

@Injectable()
export class AdminService {
  constructor(
    @InjectModel('User') private UserModel: Model<UserClass>,
    private rolesService: RolesService,
  ) {}

  async getAllUsers(user: any, page: number, limit: number) {
    if (!this.rolesService.isAdmin(user.roles))
      throw ApiError.AccessDenied();

    const safeLimit = Math.min(limit, 100);
    const skip = (page - 1) * safeLimit;
    const [users, total] = await Promise.all([
      this.UserModel.find().select('-password').skip(skip).limit(safeLimit).lean(),
      this.UserModel.countDocuments(),
    ]);

    return { users, total, page, limit: safeLimit };
  }

  async deleteUser(admin: any, targetId: string) {
    if (!this.rolesService.isAdmin(admin.roles))
      throw ApiError.AccessDenied();

    if (!isValidObjectId(targetId))
      throw ApiError.BadRequest('Некорректный ID пользователя');

    if (admin._id.toString() === targetId)
      throw ApiError.BadRequest('Нельзя удалить свой аккаунт');

    const deleted = await this.UserModel.findByIdAndDelete(targetId).lean();

    if (!deleted)
      throw ApiError.BadRequest('Пользователь не найден');

    return { success: true };
  }
}
