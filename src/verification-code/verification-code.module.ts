import { Module } from '@nestjs/common'
import { VerificationCodeController } from './verification-code.controller'
import { VerificationCodeService } from './verification-code.service'
import { MailModule } from 'src/mail/mail.module'
import UserModel from 'src/user/models/user.model'

@Module({
  imports: [MailModule, UserModel],
  controllers: [VerificationCodeController],
  providers: [VerificationCodeService],
  exports: [VerificationCodeService],
})
export class VerificationCodeModule {}
