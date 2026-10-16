import { Injectable, Optional } from '@nestjs/common';
import ApiError from 'src/exceptions/errors/api-error';
import { InjectBot } from 'nestjs-telegraf';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Telegraf } from 'telegraf';
import { createHash, randomBytes } from 'crypto';
import { UserClass } from 'src/user/schemas/user.schema';
import { ExpiringStoreService } from 'src/expiring-store/expiring-store.service';
import { LINK_CODE_PREFIX, LINK_CODE_TTL } from './constants/telegram.constants';

@Injectable()
export class TelegramService {
  private sendQueue: Promise<void> = Promise.resolve();

  constructor(
    @Optional() @InjectBot() private readonly bot: Telegraf | null,
    @InjectModel('User') private readonly userModel: Model<UserClass>,
    private readonly store: ExpiringStoreService,
  ) {}

  get isBotAvailable(): boolean {
    return !!this.bot;
  }

  async generateLinkCode(userId: string): Promise<string> {
    const code = randomBytes(9).toString('base64url').slice(0, 12);
    const hash = createHash('sha256').update(code).digest('hex');
    await this.store.set(`${LINK_CODE_PREFIX}${hash}`, userId, LINK_CODE_TTL);
    return code;
  }

  async verifyLinkCode(code: string): Promise<string | null> {
    const hash = createHash('sha256').update(code).digest('hex');
    return this.store.take(`${LINK_CODE_PREFIX}${hash}`);
  }

  async isLinked(userId: string): Promise<boolean> {
    const user = await this.userModel.findById(userId).select('telegramChatId').lean();
    return !!user?.telegramChatId;
  }

  async isAdminUser(userId: string): Promise<boolean> {
    const user = await this.userModel.findById(userId).select('roles').lean();
    return !!user?.roles.includes('admin');
  }

  async linkTelegram(userId: string, chatId: string): Promise<void> {
    await this.userModel.findByIdAndUpdate(userId, { telegramChatId: chatId });
  }

  async unlink(userId: string): Promise<void> {
    const user = await this.userModel.findById(userId).select('telegramChatId').lean();
    if (!user) throw ApiError.NotFound('Пользователь не найден');
    if (!user.telegramChatId) throw ApiError.BadRequest('Telegram не привязан');
    if (this.bot) {
      try {
        await this.bot.telegram.sendMessage(user.telegramChatId, 'Telegram успешно отвязан');
      } catch {
      }
    }
    await this.userModel.findByIdAndUpdate(userId, { $unset: { telegramChatId: '' } });
  }

  async sendDocument(buffer: Buffer, filename: string, chatId: string): Promise<void> {
    if (!chatId || !this.bot) return;
    this.sendQueue = this.sendQueue.then(async () => {
      try {
        await this.bot!.telegram.sendDocument(chatId, { source: buffer, filename });
      } catch {
      }
    });
  }
}
