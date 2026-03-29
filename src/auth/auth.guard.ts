import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import ApiError from 'src/exceptions/errors/api-error';
import { TokenService } from 'src/token/token.service';
import * as cookie from 'cookie';

// mongodb
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { UserClass } from 'src/user/schemas/user.schema';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly tokenService: TokenService,
    @InjectModel('User') private UserModel: Model<UserClass>,
  ) { }

  /**
   * Проверка авторизации пользователя
   * @param context объект, содержащий информацию о текущем запросе
   * @returns 
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    // context.switchToHttp() - переключаемся на HTTP
    // getRequest() - получаем объект запроса
    const request = context.switchToHttp().getRequest()

    // cookie - строка вида "token=123, refreshToken=456"
    // cookie.parse() - превращаем строку в объект { token: '123', refreshToken: '456' }
    const cookies = cookie.parse(request.headers.cookie || '');

    // достаём access token из куки
    const accessToken = cookies.token;

    if (!accessToken)
      throw ApiError.UnauthorizedError()

    const userData = this.tokenService.validateAccessToken(accessToken)

    if (!userData?._id)
      throw ApiError.UnauthorizedError()

    const dbUser = await this.UserModel.findById(userData._id).lean()

    if (!dbUser)
      throw ApiError.UnauthorizedError()

    if (userData.password !== dbUser.password)
      throw ApiError.AccessDenied('Пароль пользователя изменился, пожалуйста, войдите в аккаунт заново')

    request.user = {
      _id: dbUser._id,
      name: dbUser.name,
      email: dbUser.email,
      roles: dbUser.roles,
    }

    return true
  }
}