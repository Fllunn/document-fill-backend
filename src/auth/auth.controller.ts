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

// время жизни refresh токена 30 дней
const REFRESH_TOKEN_MAX_AGE = 30 * 24 * 60 * 60 * 1000
// время жизни access токена 7 дней
const ACCESS_TOKEN_MAX_AGE = 7 * 24 * 60 * 60 * 1000


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

  @Throttle(AUTH_THROTTLE_OPTIONS)
  @HttpCode(HttpStatus.CREATED)
  @Post('registration')
  async registration(
    @Res({ passthrough: true }) res: Response,
    @Body() user: UserFromClient,
  ) {
    // регистрация нового пользователя + генерация токенов
    const userData = await this.AuthService.registration(user)

    // в проде отправляем письмо с подтверждением регистрации
    if (process.env.NODE_ENV === 'production') {
      try {
        await this.mailService.sendUserConfirmation(user)
      } catch (error) {
        console.error('Ошибка при отправке письма с подтверждением регистрации:', error)
      }
    }

    // сохраняем refreshToken и accessToken в куки
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
      .json(userData.user)
  }

  @Throttle(AUTH_THROTTLE_OPTIONS)
  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(
    @Res({ passthrough: true }) res: Response,
    @Body('email') email: string,
    @Body('password') password: string,
  ) {
    // авторизация пользователя + генерация токенов
    const userData = await this.AuthService.login(email, password)

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
      .json(userData.user)
  }

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

  @Throttle(AUTH_THROTTLE_OPTIONS)
  @Post('reset-password')
  async resetPassword(
    @Res() res: Response,
    @Body('password') password: string,
    @Body('token') token: string,
    @Body('userId') userId: string,
  ) {
    const userData = await this.AuthService.resetPassword(password, token, userId)

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
      .json(userData.user)
  }

  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('update')
  async update(
    @Body('user') newUser: UserFromClient,
    @Req() req: RequestWithUser,
  ) {
    return await this.AuthService.update(newUser, req.user._id)
  }

  @HttpCode(HttpStatus.OK)
  @Post('send-reset-link')
  async sendResetLink(@Body('email') email: string) {
    return await this.AuthService.sendResetLink(email)
  }
}
