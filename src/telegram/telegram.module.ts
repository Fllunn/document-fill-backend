import { Module } from '@nestjs/common';
import { TelegrafModule } from 'nestjs-telegraf';
import { TelegramService } from './telegram.service';
import { TelegramUpdate } from './telegram.update';
import { TelegramController } from './telegram.controller';
import UserModel from 'src/user/models/user.model';
import { AuthModule } from 'src/auth/auth.module';

@Module({
  imports: [
    TelegrafModule.forRoot({
      token: process.env.TELEGRAM_BOT_TOKEN!,
    }),
    UserModel,
    AuthModule,
  ],
  controllers: [TelegramController],
  providers: [TelegramService, TelegramUpdate],
  exports: [TelegramService],
})
export class TelegramModule {}
