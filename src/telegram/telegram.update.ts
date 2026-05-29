import { SkipThrottle } from '@nestjs/throttler';
import { Update, Command, Ctx } from 'nestjs-telegraf';
import { Context } from 'telegraf';
import { TelegramService } from './telegram.service';

@SkipThrottle()
@Update()
export class TelegramUpdate {
  constructor(
    private readonly telegramService: TelegramService,
  ) {}

  @Command('link')
  async onLink(@Ctx() ctx: Context): Promise<void> {
    const text = (ctx.message as any)?.text ?? '';
    const code = text.split(' ')[1]?.trim();

    if (!code) {
      await ctx.reply('Использование: /link <код>');
      return;
    }

    const userId = await this.telegramService.verifyLinkCode(code);
    if (!userId) {
      await ctx.reply('Неверный или истёкший код');
      return;
    }

    if (!ctx.chat) {
      await ctx.reply('Не удалось определить чат');
      return;
    }

    if (!await this.telegramService.isAdminUser(userId)) {
      await ctx.reply('Вы не можете привязать Telegram');
      return;
    }

    await this.telegramService.linkTelegram(userId, String(ctx.chat.id));
    await ctx.reply('Telegram успешно привязан');
  }
}
