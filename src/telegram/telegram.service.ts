import { Injectable } from '@nestjs/common';
import ApiError from 'src/exceptions/errors/api-error';
import { InjectBot } from 'nestjs-telegraf';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Telegraf } from 'telegraf';
import { createHash, randomBytes } from 'crypto';
import Redis from 'ioredis';
import { UserClass } from 'src/user/schemas/user.schema';
import { LINK_CODE_PREFIX, LINK_CODE_TTL } from './constants/telegram.constants';

@Injectable()
export class TelegramService {
  private readonly redis = new Redis({
    host: process.env.REDIS_HOST,
    port: Number(process.env.REDIS_PORT),
    password: process.env.REDIS_PASSWORD || undefined,
    db: Number(process.env.REDIS_DB ?? 0),
  });

  private sendQueue: Promise<void> = Promise.resolve();

  constructor(
    @InjectBot() private readonly bot: Telegraf,
    @InjectModel('User') private readonly userModel: Model<UserClass>,
  ) {}

  async generateLinkCode(userId: string): Promise<string> {
    const code = randomBytes(9).toString('base64url').slice(0, 12);
    const hash = createHash('sha256').update(code).digest('hex');
    await this.redis.set(`${LINK_CODE_PREFIX}${hash}`, userId, 'EX', LINK_CODE_TTL);
    return code;
  }

  async verifyLinkCode(code: string): Promise<string | null> {
    const hash = createHash('sha256').update(code).digest('hex');
    const key = `${LINK_CODE_PREFIX}${hash}`;
    const userId = await this.redis.get(key);
    if (userId) await this.redis.del(key);
    return userId ?? null;
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
    try {
      await this.bot.telegram.sendMessage(user.telegramChatId, 'Telegram успешно отвязан');
    } catch {
    }
    await this.userModel.findByIdAndUpdate(userId, { $unset: { telegramChatId: '' } });
  }

  async sendDocument(buffer: Buffer, filename: string, chatId: string): Promise<void> {
    if (!chatId) return;
    this.sendQueue = this.sendQueue.then(async () => {
      try {
        await this.bot.telegram.sendDocument(chatId, { source: buffer, filename });
      } catch {
      }
    });
  }
}
