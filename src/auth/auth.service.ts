import { Injectable } from '@nestjs/common'
import { TokenService } from 'src/token/token.service'
import { Model } from 'mongoose'
import ApiError from 'src/exceptions/errors/api-error'
import { InjectModel } from '@nestjs/mongoose'
import { UserClass, UserDocument } from 'src/user/schemas/user.schema'
import { User } from 'src/user/interfaces/user.interface'
import { UserFromClient } from 'src/user/interfaces/user-from-client.interface'
import { RolesService } from 'src/roles/roles.service'
import * as bcrypt from 'bcryptjs'
import { MailService } from 'src/mail/mail.service'

@Injectable()
export class AuthService {
  private static readonly MIN_PASSWORD_LENGTH = 8

  constructor(
    @InjectModel('User') private UserModel: Model<UserClass>,
    private TokenService: TokenService,
    private RolesService: RolesService,
    private mailService: MailService,
  ) { }

  private validatePassword(password: string) {
    if (password.length < AuthService.MIN_PASSWORD_LENGTH)
      throw ApiError.BadRequest('Слишком короткий пароль. Минимальная длина 8 символов')
  }

  /**
   * Получение объекта пользователя без пароля
   * @param user 
   * @returns 
   */
  private getSafeUser(user: UserDocument) {
    return {
      _id: user._id,
      name: user.name,
      email: user.email,
      roles: user.roles,
      avatars: user.avatars,
      fileCount: user.fileCount,
      isVerified: user.isVerified,
      isTwoFactorEnabled: user.isTwoFactorEnabled,
    }
  }

  async registration(user: UserFromClient) {
    // ищем пользователя с такой почтой, если есть, то выдаем ошибку
    const candidate = await this.UserModel.findOne({ email: user.email })

    if (candidate)
      throw ApiError.BadRequest(`Пользователь с почтой ${user.email} уже существует`)

    this.validatePassword(user.password)

    // хэшируем пароль с помощью bcrypt
    const password = await bcrypt.hash(user.password, 3)

    const createdUser: UserDocument = await this.UserModel.create({
      name: user.name,
      email: user.email,
      password,
      roles: ['user'],
      avatars: Array.isArray(user.avatars) ? user.avatars : []
    })

    // генерируем access и refresh токены для нового пользователя
    const tokens = this.TokenService.generateTokens({ _id: createdUser._id, password: createdUser.password })
    // сохраняем refresh токен в redis
    if (tokens.refreshToken)
      await this.TokenService.saveToken(tokens.refreshToken)

    return {
      ...tokens,
      user: this.getSafeUser(createdUser)
    }
  }

  async login(email: string, password: string) {
    const user = await this.UserModel.findOne({ email })

    if (!user) {
      throw ApiError.BadRequest('Пользователь с таким email не найден')
    }

    // сравниваем пароль из БД с паролем, который ввел пользователь
    const isPassEquals = await bcrypt.compare(password, user.password)

    if (!isPassEquals) {
      throw ApiError.BadRequest('Неверный пароль')
    }

    // генерируем access и refresh токены для пользователя
    const tokens = this.TokenService.generateTokens({ _id: user._id, password: user.password })
    if (tokens?.refreshToken)
      await this.TokenService.saveToken(tokens.refreshToken)

    return {
      ...tokens,
      user: this.getSafeUser(user)
    }
  }

  /**
   * Обновление access токена с помощью refresh токена
   * @param refreshToken 
   * @param accessToken 
   * @returns refreshToken, newAccessToken, user
   */
  async refresh(refreshToken: string, accessToken: string) {
    if (!refreshToken)
      throw ApiError.UnauthorizedError()

    const refreshUserData = this.TokenService.validateRefreshToken(refreshToken)
    const tokenFromDb = await this.TokenService.findToken(refreshToken)

    if (!refreshUserData || !tokenFromDb)
      throw ApiError.UnauthorizedError()

    let userData: any; // jwt payload (_id, password и т.д.)
    let user: any; // object to return (user._id, user.name, user.email, user.roles и т.д.)

    user = await this.UserModel.findById(refreshUserData._id)

    if (!user)
      throw ApiError.UnauthorizedError()

    if (refreshUserData.password !== user.password)
      throw ApiError.AccessDenied('Пароль пользователя изменился, пожалуйста, войдите в аккаунт заново')
    
    userData = this.TokenService.validateAccessToken(accessToken)

    if (userData != null) {
      return {
        refreshToken: refreshToken,
        accessToken: accessToken,
        user: this.getSafeUser(user)
      }
    }

    const newAccessToken = this.TokenService.generateAccessToken({
      _id: user._id,
      password: user.password,
    })

    return {
      refreshToken: refreshToken,
      accessToken: newAccessToken,
      user: this.getSafeUser(user)
    }
  }

  /**
   * Валидация входа для сброса пароля
   * @param userId 
   * @param token 
   * @returns 
   */
  async validateEnterToResetPassword(userId: any, token: string) {
    let candidate = await this.UserModel.findById(userId)

    if (!candidate?._id)
      throw ApiError.BadRequest('Пользователь с таким _id не найден')

    // секрет для reset токена = это JWT_RESET_SECRET + пароль пользователя
    let secret = process.env.JWT_RESET_SECRET + candidate.password

    // проверить валидность reset токена
    let result = this.TokenService.validateResetToken(token, secret)

    if (!result)
      throw ApiError.AccessDenied()

    // если токен валиден, то вернуть результат (payload reset токена)
    return result
  }

  async resetPassword(password: string, token: string, userId: string) {
    // проверить, валиден ли reset токен и соответствует ли он пользователю
    await this.validateEnterToResetPassword(userId, token)

    this.validatePassword(password)

    // хэшируем новый пароль и сохраняем его в БД
    const hashPassword = await bcrypt.hash(password, 3)
    const user = await this.UserModel.findByIdAndUpdate(
      userId,
      { password: hashPassword },
      { new: true},
    )

    if (!user)
      throw ApiError.UnauthorizedError()

    // генерируем новый access и refresh токены для пользователя, так как его пароль изменился
    const tokens = this.TokenService.generateTokens({ _id: user._id, password: user.password })

    if (!tokens.refreshToken || !tokens.accessToken)
      throw ApiError.BadRequest('Не удалось сгенерировать токены')

    await this.TokenService.saveToken(tokens.refreshToken)

    return {
      ...tokens,
      user: this.getSafeUser(user)
    }
  }

  /**
   * Отправка ссылки для сброса пароля
   * @param email 
   * @returns link
   */
  async sendResetLink(email: string) {
    let candidate = await this.UserModel.findOne({ email })
    if (!candidate)
      throw ApiError.BadRequest('Пользователь с таким email не найден')

    // секрет для reset токена = это JWT_RESET_SECRET + пароль пользователя
    const secret = process.env.JWT_RESET_SECRET + candidate.password
    
    // создать reset токен
    const token = this.TokenService.createResetToken({ _id: candidate._id, password: candidate.password }, secret)

    // создать ссылку для сброса пароля: CLIENT_URL/forgot-password?userId=...&token=...
    const link = process.env.CLIENT_URL + `/forgot-password?userId=${candidate._id}&token=${token}`

    // отправить ссылку на почту пользователя
    await this.mailService.sendResetLink(link, email)

    return true
  }

  /**
   * Удаление refresh токена из БД при выходе из аккаунта
   * @param refreshToken 
   * @returns
   */
  async logout(refreshToken: string) {
    return await this.TokenService.removeToken(refreshToken)
  }

  /**
   * Обновление данных пользователя (кроме пароля, для него отдельный метод resetPassword)
   * @param newUser 
   * @param userId 
   * @returns 
   */
  async update(newUser: UserFromClient, userId: string) {
    const userData = {
      name: newUser.name,
      email: newUser.email,
      avatars: Array.isArray(newUser.avatars) ? newUser.avatars : [],
    }

    return await this.UserModel.findByIdAndUpdate(userId, userData, {
      new: true,
      runValidators: true,
      projection: { password: 0 },
    }).lean()
  }

  /**
   * Получение всех пользователей без паролей
   * @returns 
   */
  async getAllUsers() {
    return await this.UserModel.find({}, { password: 0 }).lean()
  }
}
