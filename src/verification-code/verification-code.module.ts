import { Module } from '@nestjs/common'
import { VerificationCodeController } from './verification-code.controller'
import { VerificationCodeService } from './verification-code.service'
import { MailModule } from 'src/mail/mail.module'

@Module({
  imports: [MailModule],
  controllers: [VerificationCodeController],
  providers: [VerificationCodeService],
  exports: [VerificationCodeService],
})
export class VerificationCodeModule {}
