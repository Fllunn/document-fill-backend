import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { RolesService } from 'src/roles/roles.service';
import UserModel from './models/user.model';
import { UserController } from './user.controller';
import { UserService } from './user.service';
import { AuthModule } from 'src/auth/auth.module';
import { AuthGuard } from 'src/auth/auth.guard';

@Module({
  imports: [
    UserModel,
    JwtModule,
    AuthModule,
  ],
  controllers: [UserController],
  providers: [RolesService, UserService],
  exports: [UserService],
})
export class UserModule {}
