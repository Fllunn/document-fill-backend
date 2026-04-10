import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TokenModule } from 'src/token/token.module';

import { JwtModule } from '@nestjs/jwt';
import { RolesService } from 'src/roles/roles.service';
import { MailService } from 'src/mail/mail.service';

// mongodb
import UserModel from 'src/user/models/user.model';
import { MailModule } from 'src/mail/mail.module';
import { AuthGuard } from './auth.guard';
import { VerificationCodeModule } from 'src/verification-code/verification-code.module';

@Module({
  imports: [
    TokenModule,
    JwtModule,
    UserModel,
    MailModule,
    VerificationCodeModule,
  ],
  controllers: [AuthController],
  providers: [AuthService, RolesService, AuthGuard],
  exports: [TokenModule, AuthGuard]
})
export class AuthModule { }
