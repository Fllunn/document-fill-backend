import { Injectable } from '@nestjs/common'
import Redis from 'ioredis'
import { MailService } from 'src/mail/mail.service'
import { IVerificationCodeToCreate } from './interfaces/IVerificationCodeToCreate'
import { IVerificationCodeToVerify } from './interfaces/IVerificationCodeToVerify'
import { IVerificationCode } from './interfaces/verification-code.interface'

@Injectable()
export class VerificationCodeService {
  private static readonly EMAIL_VERIFICATION_TYPE = 'email-verification'
  private static readonly PASSWORD_RESET_TYPE = 'password-reset'
  private static readonly ENABLE_TWO_FACTOR_TYPE = 'enable-2fa'
  private static readonly DISABLE_TWO_FACTOR_TYPE = 'disable-2fa'

  private readonly redis = new Redis({
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT),
    password: process.env.REDIS_PASSWORD || undefined,
    db: Number(process.env.REDIS_DB ?? 0),
  })

  constructor(
    private readonly mailService: MailService
  ) {}

  async requestCode(verificationCode: IVerificationCodeToCreate): Promise<void> {
    return
  }

  async verifyCode(verificationCode: IVerificationCodeToVerify): Promise<void> {
    return
  }

  async consumeCode(userId: string, type: string): Promise<void> {
    return
  }

  async resendCode(verificationCode: IVerificationCodeToCreate): Promise<void> {
    return
  }

  private getCodeKey(userId: string, type: string): string {
    return ''
  }

  private getCooldownKey(userId: string, type: string): string {
    return ''
  }

  private getEmailVerificationKey(userId: string): string {
    return ''
  }

  private getPasswordResetKey(userId: string): string {
    return ''
  }

  private getEnableTwoFactorKey(userId: string): string {
    return ''
  }

  private getDisableTwoFactorKey(userId: string): string {
    return ''
  }

  private getCodeValue(): IVerificationCode {
    return {} as IVerificationCode
  }
}
