import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import * as cookie from 'cookie';

import { TokenService } from 'src/token/token.service';
// mongodb
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { UserClass } from 'src/user/schemas/user.schema';

import ApiError from 'src/exceptions/errors/api-error';

@Injectable()
export class TeacherAuthGuard implements CanActivate {
  constructor(
    private readonly tokenService: TokenService,
    @InjectModel('User') private UserModel: Model<UserClass>,
  ) { }

  async canActivate(
    context: ExecutionContext,
  ): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const cookies = cookie.parse(request.headers.cookie || '');
    const accessToken = cookies.token;
    if (!accessToken) {
      throw ApiError.AccessDenied()
    }

    // с помощью access token'а получаем _id пользователя 
    let userData = this.tokenService.validateAccessToken(accessToken);
    if (userData?._id) {
      let user = await this.UserModel.findById(userData._id)
      // если роль нашлась, то пускаем пользователя
      if (user?.roles.indexOf('teacher') != -1) return true
    }
    throw ApiError.AccessDenied()
  }
}