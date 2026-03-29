import { Body, Controller, Post } from '@nestjs/common'
import { VerificationCodeService } from './verification-code.service'
import { IVerificationCodeToCreate } from './interfaces/IVerificationCodeToCreate'
import { IVerificationCodeToVerify } from './interfaces/IVerificationCodeToVerify'
import { Throttle } from '@nestjs/throttler'


@Throttle({
  default: {
    ttl: 60000,
    limit: 5,
    blockDuration: 5 * 60000,
  },
})
@Controller('verification-codes')
export class VerificationCodeController {
  constructor(
    private readonly verificationCodeService: VerificationCodeService
  ) {}

  @Post('request')
  async requestCode(@Body() verificationCode: IVerificationCodeToCreate) {
    return await this.verificationCodeService.requestCode(verificationCode)
  }

  @Post('verify')
  async verifyCode(@Body() verificationCode: IVerificationCodeToVerify) {
    return await this.verificationCodeService.verifyCode(verificationCode)
  }

  @Post('consume')
  async consumeCode(@Body('userId') userId: string, @Body('type') type: string) {
    return await this.verificationCodeService.consumeCode(userId, type)
  }

  @Post('resend')
  async resendCode(@Body() verificationCode: IVerificationCodeToCreate) {
    return await this.verificationCodeService.resendCode(verificationCode)
  }
}
