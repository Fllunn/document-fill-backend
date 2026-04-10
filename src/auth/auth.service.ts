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
import { VCodeType } from 'src/types/verification-code.type'
import { NAME_USER_MIN_LEN, NAME_USER_MAX_LEN } from 'src/user/constants/user.constants'
import { AuthMethod } from 'src/types/auth-method.type'

@Injectable()
export class AuthService {
  private static readonly MIN_PASSWORD_LENGTH = 8

  private readonly redis = new Redis({
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT),
    password: process.env.REDIS_PASSWORD || undefined,
    db: Number(process.env.REDIS_DB ?? 0),
  })

  constructor(
    @InjectModel('User') private UserModel: Model<UserClass>,
    private TokenService: TokenService,
    private RolesService: RolesService,
    private mailService: MailService,
    private verificationCodeService: VerificationCodeService,
  ) { }

  /**
   * Проверка сложности пароля
   * @param password 
   */
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
      fileCount: user.fileCount,
      authMethods: user.authMethods,
    }
  }

  async registerByEmail(email: string) {
    email = email.trim().toLowerCase()

    const user = await this.UserModel.findOne({ email }).lean()

    if (user)
      throw ApiError.BadRequest(`Пользователь с почтой ${email} уже существует`)
    
    const tempUserId = new mongoose.Types.ObjectId().toString()

    const tempUser = {
      provider: 'email',
      email,
      isVerified: false,
      name: null,
      createdAt: new Date().toISOString(),
    }

    await this.redis.set(
      `reg:temp:${tempUserId}`,
      JSON.stringify(tempUser),
      'EX',
      5 * 60, // 5 минут
    )

    try {
      await this.verificationCodeService.requestCode({
        tempUserId,
        email,
        type: VCodeType.REGISTER_EMAIL,
      })
    } catch (error) {
      if (error instanceof ApiError)
        throw error
      
      await this.redis.del(`reg:temp:${tempUserId}`)

      throw ApiError.Internal('Не удалось отправить код подтверждения на почту. Проверьте правильность введенной почты')
    }

    return {
      tempUserId,
      email,
      isVerified: false,
    }
  }

  async registerByEmailConfirm(tempUserId: string, code: string) {
    const tempUserData = await this.redis.get(`reg:temp:${tempUserId}`)
    
    if (!tempUserData)
      throw ApiError.BadRequest('Пользователь не найден или код подтверждения истек')

    let tempUser: {
      provider: string,
      email: string,
      isVerified: boolean,
      name: string | null,
      createdAt: string,
    }

    try {
      tempUser = JSON.parse(tempUserData) as {
        provider: string,
        email: string,
        isVerified: boolean,
        name: string | null,
        createdAt: string,
      }
    } catch (error) {
      await this.redis.del(`reg:temp:${tempUserId}`)
      throw ApiError.BadRequest('Пользователь не найден или код подтверждения истек')
    }

    await this.verificationCodeService.verifyCode({
      tempUserId,
      code,
      type: VCodeType.REGISTER_EMAIL,
    })

    tempUser.isVerified = true

    const ttl = await this.redis.ttl(`reg:temp:${tempUserId}`)

    if (ttl <= 0) {
      await this.redis.del(`reg:temp:${tempUserId}`)
      throw ApiError.BadRequest('Пользователь не найден или код подтверждения истек')
    }

    await this.redis.set(
      `reg:temp:${tempUserId}`,
      JSON.stringify(tempUser),
      'EX',
      ttl,
    )

    await this.verificationCodeService.consumeCode(
      tempUserId,
      VCodeType.REGISTER_EMAIL
    )

    return {
      tempUserId,
      email: tempUser.email,
      isVerified: tempUser.isVerified,
    }
  }

  /**
   * Проверка корректности имени пользователя
   * @param name имя пользователя
   */
  private ValidateName(name: string) {
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
   * Проверка уникальности почты
   * @param email 
   */
  private async checkUniqueEmail(email: string) {
    const user = await this.UserModel.findOne({ email }).lean()

    if (user)
      throw ApiError.BadRequest(`Пользователь с почтой ${email} уже существует`)
  }

  async registerProfile(tempUserId: string, name: string){
    name = this.ValidateName(name)

    const tempUserData = await this.redis.get(`reg:temp:${tempUserId}`)

    if (!tempUserData)
      throw ApiError.BadRequest('Пользователь не найден или код подтверждения истек')

    let tempUser: {
      provider: string,
      email: string,
      isVerified: boolean,
      name: string | null,
      createdAt: string,
    }

    // пробуем достать данные из redis
    try {
      tempUser = JSON.parse(tempUserData) as {
        provider: string,
        email: string,
        isVerified: boolean,
        name: string | null,
        createdAt: string,
      }
    } catch (error) {
      await this.redis.del(`reg:temp:${tempUserId}`)
      throw ApiError.BadRequest('Пользователь не найден или код подтверждения истек')
    }

    if (!tempUser.isVerified)
      throw ApiError.BadRequest('Почта не подтверждена')

    const ttl = await this.redis.ttl(`reg:temp:${tempUserId}`)

    if (ttl <= 0) {
      await this.redis.del(`reg:temp:${tempUserId}`)
      throw ApiError.BadRequest('Пользователь не найден или код подтверждения истек')
    }

    await this.checkUniqueEmail(tempUser.email)

    tempUser.name = name
    let createdUser: UserDocument

    try {
      createdUser = await this.UserModel.create({
        name,
        email: tempUser.email,
        password: null,
        roles: ['user'],
        authMethods: [AuthMethod.EMAIL_CODE],
      })
    } catch (error) {
      if (error?.code === 11000) 
        throw ApiError.BadRequest(`Пользователь с почтой ${tempUser.email} уже существует`)

      throw ApiError.Internal('Не удалось создать пользователя. Попробуйте позже')
    }

    try {
      const tokens = this.TokenService.generateTokens({
        _id: createdUser._id,
        password: createdUser.password,
      })

      if (!tokens.refreshToken || !tokens.accessToken)
        throw ApiError.Internal('Не удалось сгенерировать токены')

      await this.TokenService.saveToken(tokens.refreshToken)

      await this.redis.del(`reg:temp:${tempUserId}`)

      return {
        ...tokens,
        user: this.getSafeUser(createdUser)
      }
    } catch (error) {
      await this.UserModel.findByIdAndDelete(createdUser._id)

      if (error instanceof ApiError)
        throw error

      throw ApiError.Internal('Не удалось завершить регистрацию. Попробуйте позже')
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
