import { Controller, Delete, Get, HttpCode, HttpStatus, Param, Query, Req, UseGuards } from '@nestjs/common';
import { AdminService } from './admin.service';
import { AuthGuard } from 'src/auth/auth.guard';
import { ApiCookieAuth, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('Admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @ApiOperation({
    summary: 'Получение всех пользователей',
    description: 'Возвращает список пользователей. Максимум 100 на страницу',
  })
  @ApiCookieAuth('token')
  @ApiQuery({ name: 'page', required: false, example: 1 })
  @ApiQuery({ name: 'limit', required: false, example: 20 })
  @ApiResponse({ status: 200, description: 'Список пользователей успешно получен' })
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  @Get('users')
  async getAllUsers(
    @Req() req: any,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.adminService.getAllUsers(req.user, Number(page), Number(limit));
  }

  @ApiOperation({
    summary: 'Удаление пользователя',
    description: 'Удаляет пользователя',
  })
  @ApiCookieAuth('token')
  @ApiParam({ name: 'id', type: 'string', description: 'ID пользователя' })
  @ApiResponse({ status: 200, description: 'Пользователь успешно удален' })
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  @Delete('users/:id')
  async deleteUser(@Req() req: any, @Param('id') id: string) {
    return this.adminService.deleteUser(req.user, id);
  }
}
