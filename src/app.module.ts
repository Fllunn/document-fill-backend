import * as dotenv from 'dotenv';
dotenv.config();

import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AdminModule } from './admin/admin.module';
import { AuthModule } from './auth/auth.module';
import { TokenModule } from './token/token.module';
import { UserModule } from './user/user.module';
import { RolesModule } from './roles/roles.module';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerModule } from '@nestjs/throttler';
import { MongooseModule } from '@nestjs/mongoose';
import { TemplatesModule } from './templates/templates.module';


@Module({
  imports: [
    ThrottlerModule.forRoot([{
      ttl: 1000,
      limit: 20,
      blockDuration: 10 * 60000,
    }]),
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRoot(process.env.MONGO_URL, {
      connectionFactory: (connection) => {
        connection.plugin(require('mongoose-autopopulate'));
        return connection;
      },
    }),
    AuthModule,
    TokenModule,
    UserModule,
    RolesModule,
    AdminModule,
    TemplatesModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule { }
