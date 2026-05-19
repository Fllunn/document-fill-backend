import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TokenModule } from 'src/token/token.module';

import { JwtModule } from '@nestjs/jwt';
import { RolesService } from 'src/roles/roles.service';

// mongodb
import UserModel from 'src/user/models/user.model';
import { AuthGuard } from './auth.guard';

@Module({
  imports: [
    TokenModule,
    JwtModule,
    UserModel,
  ],
  controllers: [AuthController],
  providers: [AuthService, RolesService, AuthGuard],
  exports: [TokenModule, AuthGuard]
})
export class AuthModule { }
