import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UseGuards
} from '@nestjs/common'

import { RegisterDto } from './dto/register.dto'
import { LoginDto } from './dto/login.dto'
import { ChangePasswordDto } from './dto/change-password.dto'
import { UpdateUserDto } from './dto/update-user.dto'

import { CookieOptions, Request, Response } from 'express';
import RequestWithUser from 'src/types/request-with-user.type';
import { UserFromClient } from 'src/user/interfaces/user-from-client.interface';
import { AuthGuard } from './auth.guard';
import { AuthService } from './auth.service';
import { MailService } from 'src/mail/mail.service';
import { Throttle } from '@nestjs/throttler';

// all about MongoDB
import { InjectModel } from '@nestjs/mongoose';
import mongoose, { Model, Types } from 'mongoose';
import { UserClass } from 'src/user/schemas/user.schema';

import {
  ApiBody,
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger'

import { REFRESH_TOKEN_TTL_SECONDS, ACCESS_TOKEN_TTL_SECONDS } from 'src/token/constants/token.constants';

// стандартные настройки для Throttle
const AUTH_THROTTLE_OPTIONS = {
  default: {
    ttl: 60000,
    limit: 5,
    blockDuration: 5 * 60000,
  },
}

// для refresh больше попыток, т.к. он может вызываться часто
const REFRESH_THROTTLE_OPTIONS = {
  default: {
    ttl: 60000,
    limit: 30,
    blockDuration: 5 * 60000,
  },
}

// время жизни токенов в МС для куки
const REFRESH_TOKEN_MAX_AGE = REFRESH_TOKEN_TTL_SECONDS * 1000
const ACCESS_TOKEN_MAX_AGE = ACCESS_TOKEN_TTL_SECONDS * 1000


@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly AuthService: AuthService,
    private readonly mailService: MailService,
    @InjectModel('User') private readonly UserModel: Model<UserClass>,
  ) {}


  private getBaseCookieOptions(): CookieOptions {
    const options: CookieOptions = {
      httpOnly: true,
      secure: process.env.HTTPS === 'true',
      path: '/',
    }

    if (process.env.DOMAIN) {
      options.domain = process.env.DOMAIN
    }

    return options
  }

  /**
   ** httpOnly: true, куки не будут доступны на фронтенде
   ** secure: env.HTTPS === 'true', куки будут передаваться только по HTTPS
   ** domain: env.DOMAIN, куки будут доступны только на этом домене
   * @param maxAge время жизни токена
   * @returns
   */
  private getCookieOptions(maxAge: number): CookieOptions {
    return {
      ...this.getBaseCookieOptions(),
      maxAge,
    }
  }

  /**
   * Очистка куки
   * @param res
   */
  private clearAuthCookies(res: Response): void {
    const cookieOptions = this.getBaseCookieOptions()

    res.clearCookie('refreshToken', cookieOptions).clearCookie('token', cookieOptions)
  }

  @ApiOperation({
    summary: 'Регистрация пользователя по почте и паролю',
    description: 'Создает пользователя, выдает access и refresh токены в куки, возвращает данные пользователя',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['email', 'name', 'password'],
      properties: {
        email: { type: 'string', example: 'example@gmail.com' },
        name: { type: 'string', example: 'Игорь' },
        password: { type: 'string', example: '12345678' },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Пользователь успешно зарегистрирован',
  })
  @Throttle(AUTH_THROTTLE_OPTIONS)
  @HttpCode(HttpStatus.CREATED)
  @Post('register')
  async registerByEmail(
    @Res({ passthrough: true }) res: Response,
    @Body() dto: RegisterDto,
  ) {
    const userData = await this.AuthService.registerByEmail(dto.email, dto.name, dto.password)

    res
    .cookie(
      'refreshToken',
      userData.refreshToken,
      this.getCookieOptions(REFRESH_TOKEN_MAX_AGE),
    )
    .cookie(
      'token',
      userData.accessToken,
      this.getCookieOptions(ACCESS_TOKEN_MAX_AGE),
    )

    return userData.user
  }


  @ApiOperation({
    summary: 'Вход по почте и паролю',
    description: 'Проверяет почту и пароль, выдает access и refresh токены в куки, возвращает данные пользователя',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['email', 'password'],
      properties: {
        email: { type: 'string', example: 'example@gmail.com' },
        password: { type: 'string', example: '12345678' },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Пользователь успешно вошел',
  })
  @Throttle(AUTH_THROTTLE_OPTIONS)
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async loginByPassword(
    @Res({ passthrough: true }) res: Response,
    @Body() dto: LoginDto,
  ) {
    const userData = await this.AuthService.loginByPassword(dto.email, dto.password)

    res
    .cookie(
      'refreshToken',
      userData.refreshToken,
      this.getCookieOptions(REFRESH_TOKEN_MAX_AGE),
    )
    .cookie(
      'token',
      userData.accessToken,
      this.getCookieOptions(ACCESS_TOKEN_MAX_AGE),
    )

    return userData.user
  }


  @ApiOperation({
    summary: 'Смена пароля',
    description: 'Проверяет старый пароль, если он верный, то меняет на новый, выдает новые access и refresh токены в куки, возвращает данные пользователя',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['oldPassword', 'newPassword'],
      properties: {
        oldPassword: { type: 'string', example: '12345678' },
        newPassword: { type: 'string', example: '87654321' },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Пароль успешно изменен',
  })
  @Throttle(AUTH_THROTTLE_OPTIONS)
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('password/change')
  async changePassword(
    @Res({ passthrough: true }) res: Response,
    @Body() dto: ChangePasswordDto,
    @Req() req: RequestWithUser,
  ) {
    const userData = await this.AuthService.changePassword(req.user._id, dto.oldPassword, dto.newPassword)

    res
    .cookie(
      'refreshToken',
      userData.refreshToken,
      this.getCookieOptions(REFRESH_TOKEN_MAX_AGE),
    )
    .cookie(
      'token',
      userData.accessToken,
      this.getCookieOptions(ACCESS_TOKEN_MAX_AGE),
    )

    return userData.user
  }


  @ApiOperation({
    summary: 'Обновление access токена',
    description: 'Проверяет refresh токен из куки, если он правильный, то выдает новый access токен в куки',
  })
  @ApiCookieAuth('refreshToken')
  @ApiResponse({
    status: 200,
    description: 'Access токен успешно обновлен',
  })
  @Throttle(REFRESH_THROTTLE_OPTIONS)
  @HttpCode(HttpStatus.OK)
  @Get('refresh')
  async refresh(
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const { refreshToken } = req.cookies
    const userData = await this.AuthService.refresh(refreshToken)

    res
      .cookie(
        'token',
        userData.accessToken,
        this.getCookieOptions(ACCESS_TOKEN_MAX_AGE),
      )
      .json(userData.user)
  }


  @ApiOperation({
    summary: 'Выход из аккаунта',
    description: 'Удаляет refresh токен из redis и очищает куки',
  })
  @ApiCookieAuth('refreshToken')
  @ApiResponse({
    status: 200,
    description: 'Пользователь успешно вышел',
  })
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  async logout(
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const { refreshToken } = req.cookies

    await this.AuthService.logout(refreshToken)
    this.clearAuthCookies(res)
    res.send()
  }


  @ApiOperation({
    summary: 'Обновление данных пользователя',
    description: 'Обновляет данные пользователя, возвращает обновленные данные',
  })
  @ApiCookieAuth('token')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['user'],
      properties: {
        user: {
          type: 'object',
          required: ['name', 'email'],
          properties: {
            name: { type: 'string', example: 'Игорь' },
            email: { type: 'string', example: 'example@gmail.com' },
          },
        },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: 'Данные пользователя успешно обновлены'
  })
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('update')
  async update(
    @Body() dto: UpdateUserDto,
    @Req() req: RequestWithUser,
  ) {
    return await this.AuthService.update(dto, req.user._id)
  }
}
