import { Injectable } from '@nestjs/common'
import { TokenService } from 'src/token/token.service'
import { Model } from 'mongoose'
import ApiError from 'src/exceptions/errors/api-error'
import { InjectModel } from '@nestjs/mongoose'
import { UserClass, UserDocument } from 'src/user/schemas/user.schema'
import { RolesService } from 'src/roles/roles.service'
import * as bcrypt from 'bcryptjs'
import { AuthMethod } from 'src/types/auth-method.type'
import { MongoServerError } from 'mongodb'
import { isValidObjectId } from 'mongoose'
import { UpdateUserDto } from './dto/update-user.dto'

@Injectable()
export class AuthService {
  constructor(
    @InjectModel('User') private UserModel: Model<UserClass>,
    private TokenService: TokenService,
    private RolesService: RolesService,
  ) { }

  private async getUserOrThrow(userId: string): Promise<UserDocument> {
    await this.checkUserId(userId)

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

  private checkUserId(userId: string) {
    if (!isValidObjectId(userId))
      throw ApiError.UnauthorizedError('Некорректный userId')
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
  async update(newUser: UpdateUserDto, userId: string) {
    this.checkUserId(userId)

    const email = newUser.email
    const name = newUser.name

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

  async deleteUser(userId: string, password: string, refreshToken: string) {
    const user = await this.getUserOrThrow(userId)

    const isPasswordEqualsUser = await bcrypt.compare(password, user.password)

    if (!isPasswordEqualsUser)
      throw ApiError.BadRequest('Неверный пароль')

    await this.UserModel.findByIdAndDelete(userId)

    try {
      await this.TokenService.removeToken(refreshToken)
    } catch {
      // игнорирумем ошибку при удалении токена, так как аккаунт мы уже удалили
    }
    

    return { message: 'Пользователь успешно удален' }
  }
}
