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
  @ApiQuery({ name: 'search', required: false, example: 'igor', description: 'Поиск по имени и email' })
  @ApiQuery({ name: 'role', required: false, example: 'admin', description: 'Фильтр по роли' })
  @ApiQuery({ name: 'sortBy', required: false, example: 'createdAt', description: 'createdAt / name / email / roles / fileCount' })
  @ApiQuery({ name: 'order', required: false, example: 'desc', description: 'asc / desc' })
  @ApiResponse({ status: 200, description: 'Список пользователей успешно получен' })
  @UseGuards(AuthGuard)
  @HttpCode(HttpStatus.OK)
  @Get('users')
  async getAllUsers(
    @Req() req: any,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('search') search?: string,
    @Query('role') role?: string,
    @Query('sortBy') sortBy = 'createdAt',
    @Query('order') order: 'asc' | 'desc' = 'desc',
  ) {
    return this.adminService.getAllUsers(req.user, Number(page), Number(limit), search, role, sortBy as any, order);
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
