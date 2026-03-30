import { Injectable } from '@nestjs/common'
import Redis from 'ioredis'
import { MailService } from 'src/mail/mail.service'
import { IVerificationCodeToCreate } from './interfaces/IVerificationCodeToCreate'
import { IVerificationCodeToVerify } from './interfaces/IVerificationCodeToVerify'
import { IVerificationCode } from './interfaces/verification-code.interface'
import * as bcrypt from 'bcryptjs'
import ApiError from 'src/exceptions/errors/api-error'
import { InjectModel } from '@nestjs/mongoose'
import { Model } from 'mongoose'
import { UserClass } from 'src/user/schemas/user.schema'
import { randomInt } from 'crypto'


@Injectable()
export class VerificationCodeService {
  private static readonly EMAIL_VERIFICATION_TYPE = 'email-verification'
  private static readonly PASSWORD_RESET_TYPE = 'password-reset'
  private static readonly ENABLE_TWO_FACTOR_TYPE = 'enable-2fa'
  private static readonly DISABLE_TWO_FACTOR_TYPE = 'disable-2fa'

  private static readonly VERIFICATION_CODE_LENGTH = Number(process.env.VERIFICATION_CODE_LENGTH ?? 6)
  private static readonly VERIFICATION_CODE_ATTEMPTS = Number(process.env.VERIFICATION_CODE_ATTEMPTS ?? 5)
  private static readonly VERIFICATION_CODE_TTL_SECONDS = Number(process.env.VERIFICATION_CODE_TTL_SECONDS ?? 600)
  private static readonly VERIFICATION_CODE_COOLDOWN_SECONDS = Number(process.env.VERIFICATION_CODE_COOLDOWN_SECONDS ?? 60)

  private readonly redis = new Redis({
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT),
    password: process.env.REDIS_PASSWORD || undefined,
    db: Number(process.env.REDIS_DB ?? 0),
  })

  constructor(
    @InjectModel('User') private UserModel: Model<UserClass>,
    private readonly mailService: MailService,
  ) {}

  private async removeCodeNoAttemptsLeft(codeKey: string): Promise<void> {
    await this.redis.del(codeKey)
    throw ApiError.BadRequest('Превышено количество попыток ввода кода. Пожалуйста, запросите новый код')
  }

  /**
   * Отправление кода подтверждения на почту
   * @param verificationCode 
   */
  async requestCode(verificationCode: IVerificationCodeToCreate): Promise<void> {
    // данные для создания кода
    const { userId, type } = verificationCode

    const codeKey = this.getCodeKey(userId, type)
    const cooldownKey = this.getCooldownKey(userId, type)

    const cooldownExists = await this.redis.exists(cooldownKey)

    // если код недавно отправлялся, не разрешаем отправлять новый
    if (cooldownExists)
      throw ApiError.BadRequest('Код уже был отправлен. Попробуйте позже')

    const user = await this.UserModel.findById(userId).lean()

    if (!user)
      throw ApiError.NotFound('Пользователь не найден')

    const min = 10 ** (VerificationCodeService.VERIFICATION_CODE_LENGTH - 1)
    const max = 10 ** VerificationCodeService.VERIFICATION_CODE_LENGTH - 1
    const code = randomInt(min, max + 1).toString()

    const codeHash = await bcrypt.hash(code, 3)

    const value: IVerificationCode = {
      codeHash,
      attemptsLeft: VerificationCodeService.VERIFICATION_CODE_ATTEMPTS,
    }

    await this.redis.set(codeKey, JSON.stringify(value), 'EX', VerificationCodeService.VERIFICATION_CODE_TTL_SECONDS)
    await this.redis.set(cooldownKey, '1', 'EX', VerificationCodeService.VERIFICATION_CODE_COOLDOWN_SECONDS)

    try {
      await this.mailService.sendVerificationCode(user.email, code, type)
    } catch (error) {
      await this.redis.del(codeKey)
      await this.redis.del(cooldownKey)

      throw ApiError.Internal('Не удалось отправить код подтверждения. Попробуйте позже')
    }
    
  }

  /**
   * Проверка кода подтверждения
   * @param verificationCode 
   * @returns 
   */
  async verifyCode(verificationCode: IVerificationCodeToVerify): Promise<void> {
    const { userId, code, type } = verificationCode

    const user = await this.UserModel.findById(userId).lean()

    if (!user)
      throw ApiError.NotFound('Пользователь не найден')

    // получаем код из redis
    const codeKey = this.getCodeKey(userId, type)
    
    // получаем строку из redis по ключу
    const codeDataString = await this.redis.get(codeKey)

    // если строки нет, значит кода нет или он истек
    if (!codeDataString)
      throw ApiError.BadRequest('Код подтверждения не найден или истек')

    let codeData: IVerificationCode

    // пытаемся распарсить строку
    try {
      codeData = JSON.parse(codeDataString) as IVerificationCode
    } catch (error) {
      await this.redis.del(codeKey)
      throw ApiError.BadRequest('Код подтверждения не найден или истек')
    }

    // если попыток ввода не осталось
    if (codeData.attemptsLeft <= 0) {
      await this.removeCodeNoAttemptsLeft(codeKey)
    }

    // сравниваем код из запроса с хэшем кода из redis
    const isCodeValid = await bcrypt.compare(code, codeData.codeHash)

    if (isCodeValid)
      return

    // если код не совпал, уменьшаем количество попыток и сохраняем обратно в redis
    codeData.attemptsLeft -= 1

    const ttl = await this.redis.ttl(codeKey)

    if (ttl <= 0) {
      await this.redis.del(codeKey)
      throw ApiError.BadRequest('Код подтверждения не найден или истек')
    }

    if (codeData.attemptsLeft <= 0) {
      await this.removeCodeNoAttemptsLeft(codeKey)
    }
    
    await this.redis.set(codeKey, JSON.stringify(codeData), 'EX', ttl)

    throw ApiError.BadRequest(`Неверный код подтверждения. Осталось попыток: ${codeData.attemptsLeft}`)
  }

  /**
   * Удаление кода после успешного использования
   * @param userId 
   * @param type 
   */
  async consumeCode(userId: string, type: string): Promise<void> {
    const user = await this.UserModel.findById(userId).lean()

    if (!user)
      throw ApiError.NotFound('Пользователь не найден')

    const codeKey = this.getCodeKey(userId, type)
    const codeExists = await this.redis.exists(codeKey)

    if (!codeExists)
      throw ApiError.BadRequest('Код подтверждения не найден или истек')

    await this.redis.del(codeKey)
  }

  /**
   * Повторная отправка кода подтверждения
   * @param verificationCode 
   * @returns 
   */
  async resendCode(verificationCode: IVerificationCodeToCreate): Promise<void> {
    return await this.requestCode(verificationCode)
  }

  /**
   * Получение ключа для хранения в redis: vc:{type}:{userId}
   * @param userId 
   * @param type 
   * @returns 
   */
  private getCodeKey(userId: string, type: string): string {
    const firstPath = `vc`

    switch (type) {
      case VerificationCodeService.EMAIL_VERIFICATION_TYPE:
        return `${firstPath}:${VerificationCodeService.EMAIL_VERIFICATION_TYPE}:${userId}`
      case VerificationCodeService.PASSWORD_RESET_TYPE:
        return `${firstPath}:${VerificationCodeService.PASSWORD_RESET_TYPE}:${userId}`
      case VerificationCodeService.ENABLE_TWO_FACTOR_TYPE:
        return `${firstPath}:${VerificationCodeService.ENABLE_TWO_FACTOR_TYPE}:${userId}`
      case VerificationCodeService.DISABLE_TWO_FACTOR_TYPE:
        return `${firstPath}:${VerificationCodeService.DISABLE_TWO_FACTOR_TYPE}:${userId}`
      default:
        throw ApiError.BadRequest('Неверный тип кода')
    }
  }

  /**
   * Получение ключа для хранения в redis: vc:cooldown:{type}:{userId}
   * @param userId 
   * @param type 
   * @returns 
   */
  private getCooldownKey(userId: string, type: string): string {
    const firstPath = `vc:cooldown`

    switch (type) {
      case VerificationCodeService.EMAIL_VERIFICATION_TYPE:
        return `${firstPath}:${VerificationCodeService.EMAIL_VERIFICATION_TYPE}:${userId}`
      case VerificationCodeService.PASSWORD_RESET_TYPE:
        return `${firstPath}:${VerificationCodeService.PASSWORD_RESET_TYPE}:${userId}`
      case VerificationCodeService.ENABLE_TWO_FACTOR_TYPE:
        return `${firstPath}:${VerificationCodeService.ENABLE_TWO_FACTOR_TYPE}:${userId}`
      case VerificationCodeService.DISABLE_TWO_FACTOR_TYPE:
        return `${firstPath}:${VerificationCodeService.DISABLE_TWO_FACTOR_TYPE}:${userId}`
      default:
        throw ApiError.BadRequest('Неверный тип кода')
    }
  }
}
