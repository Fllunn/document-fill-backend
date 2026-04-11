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

import { ApiBody, ApiOperation } from '@nestjs/swagger';

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
  @Post('register/email')
  @ApiOperation({
    summary: 'Регистрация с помощью почты',
    description: '',

  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        email: { type: 'string', example: 'user@example.com' },
      },
    },
  })
  async registerByEmail(
    @Body('email') email: string
  ) {
    return await this.AuthService.registerByEmail(email)
  }

  @Throttle(AUTH_THROTTLE_OPTIONS)
  @HttpCode(HttpStatus.CREATED)
  @Post('register/email/confirm')
  async registerByEmailConfirm(
    @Body('tempUserId') tempUserId: string,
    @Body('code') code: string,
  ) {
    return await this.AuthService.registerByEmailConfirm(tempUserId, code)
  }

  @Throttle(AUTH_THROTTLE_OPTIONS)
  @HttpCode(HttpStatus.CREATED)
  @Post('register/profile')
  async registerProfile(
    @Res({ passthrough: true }) res: Response,
    @Body('tempUserId') tempUserId: string,
    @Body('name') name: string,
  ) {
    const userData = await this.AuthService.registerProfile(tempUserId, name)

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

  @Throttle(AUTH_THROTTLE_OPTIONS)
  @HttpCode(HttpStatus.OK)
  @Post('login/email')
  async loginByEmail(
    @Body('email') email: string
  ) {
    return await this.AuthService.loginByEmail(email)
  }

  @Throttle(AUTH_THROTTLE_OPTIONS)
  @HttpCode(HttpStatus.OK)
  @Post('login/email/confirm')
  async loginByEmailConfirm(
    @Res({ passthrough: true }) res: Response,
    @Body('loginTempId') loginTempId: string,
    @Body('code') code: string,
  ) {
    const userData = await this.AuthService.loginByEmailConfirm(loginTempId, code)

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

  @Throttle(AUTH_THROTTLE_OPTIONS)
  @HttpCode(HttpStatus.OK)
  @Post('login/password')
  async loginByPassword(
    @Res({ passthrough: true }) res: Response,
    @Body('email') email: string,
    @Body('password') password: string,
  ) {
    const userData = await this.AuthService.loginByPassword(email, password)
    
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

  @Throttle(AUTH_THROTTLE_OPTIONS)
  @HttpCode(HttpStatus.OK)
  @Post('password/set/request-code')
  async requestSetPasswordCode(
    @Body('userId') userId: string
  ) {
    return await this.AuthService.requestSetPasswordCode(userId)
  }

  @Throttle(AUTH_THROTTLE_OPTIONS)
  @HttpCode(HttpStatus.OK)
  @Post('password/set')
  async setPassword(
    @Res({ passthrough: true }) res: Response,
    @Body('userId') userId: string,
    @Body('code') code: string,
    @Body('password') password: string,
  ) {
    const userData = await this.AuthService.setPassword(userId, code, password)

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

  @Throttle(AUTH_THROTTLE_OPTIONS)
  @HttpCode(HttpStatus.OK)
  @Post('password/change/request-code')
  async requestChangePasswordCode(
    @Body('userId') userId: string
  ) {
    return await this.AuthService.requestChangePasswordCode(userId)
  }

  @Throttle(AUTH_THROTTLE_OPTIONS)
  @HttpCode(HttpStatus.OK)
  @Post('password/change')
  async changePassword(
    @Res({ passthrough: true }) res: Response,
    @Body('userId') userId: string,
    @Body('code') code: string,
    @Body('newPassword') newPassword: string,
  ) {
    const userData = await this.AuthService.changePassword(userId, code, newPassword)

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

  @Throttle(AUTH_THROTTLE_OPTIONS)
  @HttpCode(HttpStatus.OK)
  @Post('email/change/current/request-code')
  async requestChangeCurrentEmailCode(
    @Body('userId') userId: string
  ) {
    return await this.AuthService.requestChangeCurrentEmailCode(userId)
  }

  @Throttle(AUTH_THROTTLE_OPTIONS)
  @HttpCode(HttpStatus.OK)
  @Post('email/change/current/confirm')
  async confirmChangeCurrentEmail(
    @Body('userId') userId: string,
    @Body('code') code: string,
  ) {
    return await this.AuthService.confirmCurrentEmail(userId, code)
  }

  @Throttle(AUTH_THROTTLE_OPTIONS)
  @HttpCode(HttpStatus.OK)
  @Post('email/change/new/request-code')
  async requestChangeNewEmailCode(
    @Body('userId') userId: string,
    @Body('newEmail') newEmail: string,
  ) {
    return await this.AuthService.requestChangeNewEmailCode(userId, newEmail)
  }

  @Throttle(AUTH_THROTTLE_OPTIONS)
  @HttpCode(HttpStatus.OK)
  @Post('email/change/new/confirm')
  async confirmChangeNewEmail(
    @Body('userId') userId: string,
    @Body('code') code: string,
  ) {
    return await this.AuthService.confirmNewEmail(userId, code)
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

  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('update')
  async update(
    @Body('user') newUser: UserFromClient,
    @Req() req: RequestWithUser,
  ) {
    return await this.AuthService.update(newUser, req.user._id)
  }
}
