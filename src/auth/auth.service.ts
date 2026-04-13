import { Injectable } from '@nestjs/common'
import { TokenService } from 'src/token/token.service'
import mongoose, { Model } from 'mongoose'
import ApiError from 'src/exceptions/errors/api-error'
import { InjectModel } from '@nestjs/mongoose'
import { UserClass, UserDocument } from 'src/user/schemas/user.schema'
import { User } from 'src/user/interfaces/user.interface'
import { UserFromClient } from 'src/user/interfaces/user-from-client.interface'
import { RolesService } from 'src/roles/roles.service'
import * as bcrypt from 'bcryptjs'
import { MailService } from 'src/mail/mail.service'
import { VerificationCodeService } from 'src/verification-code/verification-code.service' 
import Redis from 'ioredis'
import { NAME_USER_MIN_LEN, NAME_USER_MAX_LEN } from 'src/user/constants/user.constants'
import { AuthMethod } from 'src/types/auth-method.type'
import { MongoServerError } from 'mongodb'
import { MIN_PASSWORD_LENGTH, MAX_PASSWORD_LENGTH, MAX_EMAIL_LENGTH } from './constants/auth.constants'

@Injectable()
export class AuthService {
  constructor(
    @InjectModel('User') private UserModel: Model<UserClass>,
    private TokenService: TokenService,
    private RolesService: RolesService,
  ) { }

  /**
   * Проверка сложности пароля
   * @param password 
   */
  private validatePassword(password: string) {
    if (password.length < MIN_PASSWORD_LENGTH)
      throw ApiError.BadRequest(`Слишком короткий пароль. Минимальная длина ${MIN_PASSWORD_LENGTH} символов`)

    if (password.length > MAX_PASSWORD_LENGTH)
      throw ApiError.BadRequest(`Слишком длинный пароль. Максимальная длина ${MAX_PASSWORD_LENGTH} символов`)
  }

  private async getUserOrThrow(userId: string): Promise<UserDocument> {
    const user = await this.UserModel.findById(userId)

    if (!user)
      throw ApiError.BadRequest('Пользователь не найден')

    return user
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
      fileCount: user.fileCount,
      authMethods: user.authMethods,
    }
  }

  private generateTokensOrThrow(user: UserDocument) {
    const tokens = this.TokenService.generateTokens({
      _id: user._id,
      password: user.password,
    })

    if (!tokens.refreshToken || !tokens.accessToken)
      throw ApiError.Internal('Не удалось сгенерировать токены')

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
    }
  }

  private normalizeEmail(email: string) {
    if (email.length > MAX_EMAIL_LENGTH)
      throw ApiError.BadRequest(`Слишком длинный email. Максимальная длина ${MAX_EMAIL_LENGTH} символов`)

    return email.trim().toLowerCase()
  }

  /**
   * Проверка корректности имени пользователя
   * @param name имя пользователя
   */
  private validateName(name: string) {
    name = name.trim()

    if (!name)
      throw ApiError.BadRequest('Имя не может быть пустым')

    if (name.length < NAME_USER_MIN_LEN)
      throw ApiError.BadRequest(`Минимальная длина имени ${NAME_USER_MIN_LEN} символов`)

    if (name.length > NAME_USER_MAX_LEN)
      throw ApiError.BadRequest(`Максимальная длина имени ${NAME_USER_MAX_LEN} символов`)

    return name
  }

  /**
   * Существует ли пользователь с такой почтой
   * @param email 
   * @returns user
   */
  private async checkUserByEmail(email: string) {
    const user = await this.UserModel.findOne({ email })

    if (!user)
      throw ApiError.BadRequest(`Пользователь с почтой ${email} не найден`)

    return user
  }

  async registerByEmail(email: string, name: string, password: string) {
    email = this.normalizeEmail(email)
    name = this.validateName(name)
    this.validatePassword(password)

    const hashPassword = await bcrypt.hash(password, 3)

    let user: UserDocument

    try {
      user = await this.UserModel.create({
        email,
        name,
        password: hashPassword,
        authMethods: [AuthMethod.EMAIL_AND_PASSWORD],
      })
    } catch (error) {
      if (error instanceof MongoServerError && error.code === 11000) {
        throw ApiError.BadRequest(`Пользователь с почтой ${email} уже существует`)
      }

      throw ApiError.Internal('Ошибка при создании пользователя')
    }

    const tokens = this.generateTokensOrThrow(user)

    await this.TokenService.saveToken(tokens.refreshToken)

    return {
      ...tokens,
      user: this.getSafeUser(user)
    }
  }

  async loginByPassword(email: string, password: string) {
    email = this.normalizeEmail(email)

    const user = await this.checkUserByEmail(email)

    const isPasswordValid = await bcrypt.compare(password, user.password)

    if (!isPasswordValid)
      throw ApiError.BadRequest('Неверный пароль')

    const tokens = this.TokenService.generateTokens({
      _id: user._id,
      password: user.password,
    })

    if (!tokens.refreshToken || !tokens.accessToken)
      throw ApiError.Internal('Не удалось сгенерировать токены')

    await this.TokenService.saveToken(tokens.refreshToken)

    return {
      ...tokens,
      user: this.getSafeUser(user)
    }
  }

  async changePassword(userId: string, oldPassword: string,newPassword: string) {
    const user = await this.getUserOrThrow(userId)

    this.validatePassword(newPassword)

    const isOldPasswordEqualsUser = await bcrypt.compare(oldPassword, user.password)

    if (!isOldPasswordEqualsUser)
      throw ApiError.BadRequest('Введенный старый пароль не совпадает с текущим паролем')

    const isNewPasswordEqualsOld = await bcrypt.compare(newPassword, user.password)
    if (isNewPasswordEqualsOld)
      throw ApiError.BadRequest('Новый пароль совпадает с текущим паролем')

    const hashPassword = await bcrypt.hash(newPassword, 3)

    user.password = hashPassword

    await user.save()

    const tokens = this.TokenService.generateTokens({
      _id: user._id,
      password: user.password,
    })

    if (!tokens.refreshToken || !tokens.accessToken)
      throw ApiError.Internal('Не удалось сгенерировать токены')

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
  async refresh(refreshToken: string) {
    if (!refreshToken)
      throw ApiError.UnauthorizedError()

    const refreshUserData = this.TokenService.validateRefreshToken(refreshToken)
    const tokenFromDb = await this.TokenService.findToken(refreshToken)

    if (!refreshUserData || !tokenFromDb)
      throw ApiError.UnauthorizedError()

    const user = await this.UserModel.findById(refreshUserData._id)

    if (!user)
      throw ApiError.UnauthorizedError()

    if (refreshUserData.password !== user.password)
      throw ApiError.AccessDenied('Пароль пользователя изменился, пожалуйста, войдите в аккаунт заново')

    const newAccessToken = this.TokenService.generateAccessToken({
      _id: user._id,
      password: user.password
    })

    if (!newAccessToken)
      throw ApiError.BadRequest('Не удалось сгенерировать новый access токен')

    return {
      refreshToken,
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
    if (!mongoose.Types.ObjectId.isValid(userId))
      throw ApiError.BadRequest('Пользователь не найден')

    let candidate = await this.UserModel.findById(userId)

    if (!candidate?._id)
      throw ApiError.BadRequest('Пользователь с таким _id не найден')

    // секрет для reset токена = это JWT_RESET_SECRET + пароль пользователя
    let secret = process.env.JWT_RESET_SECRET! + candidate.password

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
   * Удаление refresh токена из БД при выходе из аккаунта
   * @param refreshToken 
   * @returns
   */
  async logout(refreshToken: string) {
    if (!refreshToken)
      return 0

    return await this.TokenService.removeToken(refreshToken)
  }

  /**
   * Обновление данных пользователя (кроме пароля, для него отдельный метод resetPassword)
   * @param newUser 
   * @param userId 
   * @returns 
   */
  async update(newUser: UserFromClient, userId: string) {
    const email = this.normalizeEmail(newUser.email)
    const name = this.validateName(newUser.name)

    try {
      const user = await this.UserModel.findByIdAndUpdate(
        userId,
        { name, email },
        {
          new: true,
          runValidators: true,
          projection: { password: 0 },
        }
      ).lean()

      if (!user)
        throw ApiError.BadRequest('Пользователь не найден')

      return user
    } catch (error) {
      if (error instanceof MongoServerError && error.code === 11000) {
        throw ApiError.BadRequest(`Пользователь с почтой ${email} уже существует`)
      }

      if (error instanceof ApiError)
        throw error

      throw ApiError.Internal('Ошибка при обновлении данных пользователя')
    }
  }

  /**
   * Получение всех пользователей без паролей
   * @returns 
   */
  async getAllUsers() {
    return await this.UserModel.find({}, { password: 0 }).lean()
  }
}
