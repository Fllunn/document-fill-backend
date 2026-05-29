import { Controller, Delete, Get, HttpCode, HttpStatus, Post, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { AuthGuard } from 'src/auth/auth.guard';
import { TelegramService } from './telegram.service';
import ApiError from 'src/exceptions/errors/api-error';
import { LINK_CODE_TTL } from './constants/telegram.constants';

@ApiBearerAuth()
@ApiTags('Telegram')
@Controller('telegram')
export class TelegramController {
  constructor(private readonly telegramService: TelegramService) {}

  @Post('link-code')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Получить код привязки Telegram',
    description: 'Генерирует одноразовый код для привязки Telegram. Только для администраторов',
  })
  async getLinkCode(@Req() req: any): Promise<{ code: string; expiresIn: number }> {
    if (!this.telegramService.isBotAvailable) throw ApiError.BadRequest('Telegram бот не настроен');
    if (!req.user.roles.includes('admin')) {
      throw ApiError.AccessDenied();
    }
    const code = await this.telegramService.generateLinkCode(req.user._id.toString());
    return { code, expiresIn: LINK_CODE_TTL };
  }

  @Get('status')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Статус привязки Telegram' })
  async getStatus(@Req() req: any): Promise<{ linked: boolean }> {
    if (!this.telegramService.isBotAvailable) throw ApiError.BadRequest('Telegram бот не настроен');
    if (!req.user.roles.includes('admin')) {
      throw ApiError.AccessDenied();
    }
    return { linked: await this.telegramService.isLinked(req.user._id.toString()) };
  }

  @Delete('unlink')
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Отвязать Telegram', description: 'Только для администраторов' })
  @ApiResponse({ status: 200 })
  async unlink(@Req() req: any): Promise<void> {
    if (!this.telegramService.isBotAvailable) throw ApiError.BadRequest('Telegram бот не настроен');
    if (!req.user.roles.includes('admin')) {
      throw ApiError.AccessDenied();
    }
    await this.telegramService.unlink(req.user._id.toString());
  }
}
