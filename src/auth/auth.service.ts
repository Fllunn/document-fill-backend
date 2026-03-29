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
  constructor(
    @InjectModel('User') private UserModel: Model<UserClass>,
    private TokenService: TokenService,
    private RolesService: RolesService,
    private mailService: MailService,
  ) { }

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

    if (user.password.length < 8)
      throw ApiError.BadRequest('Слишком короткий пароль')

    // хэшируем пароль с помощью bcrypt
    const password = await bcrypt.hash(user.password, 3)

    const created_user: UserDocument = await this.UserModel.create({
      name: user.name,
      email: user.email,
      password,
      roles: ['user'],
      avatars: Array.isArray(user.avatars) ? user.avatars : []
    })

    // генерируем access и refresh токены для нового пользователя
    const tokens = this.TokenService.generateTokens({ _id: created_user._id, password: created_user.password })
    // сохраняем refresh токен в redis
    if (tokens.refreshToken)
      await this.TokenService.saveToken(tokens.refreshToken)

    return {
      ...tokens,
      user: this.getSafeUser(created_user)
    }
  }

  async login(email: string, password: string) {
    const user = await this.UserModel.findOne({ email })

    if (!user) {
      throw ApiError.BadRequest('Пользователь с таким email не найден')
    }

    if (user.password.length < 8)
      throw ApiError.BadRequest('Слишком короткий пароль')

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
    let userData: any; // jwt payload (_id, password и т.д.)
    let user: any; // object to return (user._id, user.name, user.email, user.roles и т.д.)

    // проверить, валиден ли ещё accessToken
    userData = this.TokenService.validateAccessToken(accessToken)

    // если accessToken валиден, то просто вернуть его и юзера
    if (userData != null) {
      user = await this.UserModel.findById(userData._id)

      if (!user)
        throw ApiError.UnauthorizedError()

      return {
        refreshToken: refreshToken,
        accessToken: accessToken,
        user: this.getSafeUser(user)
      }
    }
    
    // если accessToken не валиден - пройти авторизацию с refreshToken и создать новый accessToken

    // если нет refreshToken выкидываем пользователя
    // он может удалиться при выходе из аккаунта или через 30 дней после генерации
    if (!refreshToken) {
      throw ApiError.UnauthorizedError()
    }

    // проверить валиден ли refreshToken и есть ли он в БД
    userData = this.TokenService.validateRefreshToken(refreshToken)
    const tokenFromDb = await this.TokenService.findToken(refreshToken)

    // если refreshToken не валиден или его нет в БД, то выкидываем пользователя
    if (!userData || !tokenFromDb) {
      throw ApiError.UnauthorizedError()
    }

    user = await this.UserModel.findById(userData._id)

    if (!user)
      throw ApiError.UnauthorizedError()

    // проверить, соответствует ли пароль в JWT паролю в БД
    if (userData.password !== user.password) {
      throw ApiError.AccessDenied('Аутентификация провалена. Пароль изменен')
    }
    
    // если все проверки пройдены, то генерируем новый accessToken и возвращаем его вместе с refreshToken и юзером
    const newAccessToken = this.TokenService.generateAccessToken({ _id: user._id, password: user.password })

    return {
      refreshToken: refreshToken,
      accessToken: newAccessToken,
      user: this.getSafeUser(user)
    }
  }

  /**
   * Валидация входа для сброса пароля
   * @param user_id 
   * @param token 
   * @returns 
   */
  async validateEnterToResetPassword(user_id: any, token: string) {
    let candidate = await this.UserModel.findById(user_id)

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
    try {
      // проверить, валиден ли reset токен и соответствует ли он пользователю
      await this.validateEnterToResetPassword(userId, token)

      // хэшируем новый пароль и сохраняем его в БД
      const hashPassword = await bcrypt.hash(password, 3)
      const user = await this.UserModel.findByIdAndUpdate(userId, { password: hashPassword })

      if (!user)
        throw ApiError.UnauthorizedError()

      // генерируем новый access и refresh токены для пользователя, так как его пароль изменился
      const tokens = this.TokenService.generateTokens({ _id: user._id, password: user.password })

      if (tokens.refreshToken) {
        await this.TokenService.saveToken(tokens.refreshToken)
        return {
          ...tokens,
          user: this.getSafeUser(user)
        }
      }

      return null
    } catch (error) {
      return null
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

    // создать ссылку для сброса пароля: CLIENT_URL/forgot-password?user_id=...&token=...
    const link = process.env.CLIENT_URL + `/forgot-password?user_id=${candidate._id}&token=${token}`

    // отправить ссылку на почту пользователя
    await this.mailService.sendResetLink(link, email)

    return link
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
