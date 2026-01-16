import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  UseGuards,
  Patch,
  Delete,
} from '@nestjs/common';

import { SomeAdminGuard } from 'src/admin/some_admin.guard';
import { RolesService } from 'src/roles/roles.service';
import { GlobalAdminGuard } from 'src/admin/global_admin.guard';

import { UserService } from './user.service';
import ApiError from 'src/exceptions/errors/api-error';
import { ApiOperation } from '@nestjs/swagger';
import { AuthGuard } from 'src/auth/auth.guard';


// types
import { Role } from '../roles/interfaces/role.interface';
import { UserFromClient } from './interfaces/user-from-client.interface';
import { User } from './interfaces/user.interface';
import RequestWithUser from 'src/types/request-with-user.type';


// all about MongoDB
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UserClass } from './schemas/user.schema';


@Controller('user')
export class UserController {
  constructor(
    @InjectModel('User') private UserModel: Model<UserClass>,

    private UserService: UserService,
    private RolesService: RolesService,
  ) { }

  @HttpCode(HttpStatus.OK)
  @Get('get-by-id')
  async get_by_id(@Query('_id') _id: string) {
    let candidate = await this.UserModel.findById(_id, {
      password: 0,
    }).populate('orders').populate('managerIn');
    if (!candidate)
      throw ApiError.BadRequest('Пользователь с таким ID не найден');

    return candidate;
  }

  @Post('categories')
  @UseGuards(AuthGuard) // только авторизованные
  @ApiOperation({
    summary: 'creat user template categories',
    description: '',
  })
  async setUserTemplateCategories(@Req() request: any, @Body() categories: string[]) {
    return this.UserService.setUserTemplateCategories(request.user, categories);
  }

  @Get('categories')
  @UseGuards(AuthGuard) // только авторизованные
  @ApiOperation({
    summary: 'Get user template categories',
    description: '',
  })
  async getUserTemplateCategories(@Req() request: any) {
    return this.UserService.getUserTemplateCategories(request.user);
  }

  @Patch('categories')
  @UseGuards(AuthGuard) // только авторизованные
  @ApiOperation({
    summary: 'Update user template categories',
    description: '',
  })
  async updateUserTemplateCategories(@Req() request: any, @Body() categories: string[]) {
    return this.UserService.setUserTemplateCategories(request.user, categories);
  }

  @Delete('categories')
  @UseGuards(AuthGuard) // только авторизованные
  @ApiOperation({
    summary: 'Delete user template categories',
    description: '',
  })
  async deleteUserTemplateCategories(@Req() request: any) {
    return this.UserService.deleteUserTemplateCategories(request.user);
  }

  // @HttpCode(HttpStatus.OK)
  // @UseGuards(SomeAdminGuard)
  // @Post('change-user')
  // async changeUser(
  //   @Req() req: RequestWithUser,
  //   @Body('user') user: UserFromClient,
  // ) {
  //   let subject_user = await this.UserModel.findById(user._id);

  //   // ... Защиты, проверки

  //   await subject_user.updateOne(user, { runValidators: true });
  // }

  // async addRole(user_email: string, role_type: string) {
  //   let role: Role = {
  //     type: role_type,
  //     rest_ids: [],
  //   };
  //   return await this.UserModel.updateOne(
  //     { email: user_email, 'role.type': { $nin: [role_type] } },
  //     { $addToSet: { roles: role } },
  //     { runValidators: true },
  //   );
  // }

  // async deleteRole(user_email: string, role_type: string) {
  //   return await this.UserModel.updateOne(
  //     { email: user_email },
  //     { $unset: { 'roles.$[t]': '' } },
  //     { arrayFilters: [{ 't.type': role_type }], runValidators: true },
  //   );
  // }
}
