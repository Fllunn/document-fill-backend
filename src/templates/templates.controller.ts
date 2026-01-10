import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Put,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { TemplatesService } from './templates.service';
import ApiError from 'src/exceptions/errors/api-error';
import { ITemplatesToEdit } from './interfaces/ITemplatesToEdit';
import { TemplatesDocument } from './schemas/templates.schema';
import { AuthGuard } from 'src/auth/auth.guard';
import RequestWithUser from 'src/types/request-with-user.type';

@Controller('templates')
export class TemplatesController {
  constructor(private TemplatesService: TemplatesService) {}

  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  @Get('get-all')
  async getAll(@Req() req: RequestWithUser) {
    const templates = await this.TemplatesService.getAllTemplates(
      req.user._id,
      req.user.roles,
    );
    return {
      templates: templates,
    };
  }

  @HttpCode(HttpStatus.CREATED)
  @UseGuards(AuthGuard)
  @Post('create')
  @UseInterceptors(FileInterceptor('file'))
  async create(
    @Req() req: RequestWithUser,
    @Body() body: any,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const templateData = {
      name: body.name,
      variables: body.variables,
      storageType: body.storageType,
      userId: req.user._id,
      mimeType: file?.mimetype || body.mimeType,
      // filePath передается только для system шаблонов админом
      filePath: body.storageType === 'system' ? body.filePath : '',
    };

    const createdTemplate: TemplatesDocument =
      await this.TemplatesService.create(
        templateData,
        file,
        req.user._id,
        req.user.roles,
      );

    return {
      template: createdTemplate,
    };
  }

  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  @Delete('delete')
  async delete(@Req() req: RequestWithUser, @Body('_id') _id?: string) {
    if (!_id) {
      throw ApiError.BadRequest('Необходимо указать id');
    }

    const deletedTemplate: TemplatesDocument =
      await this.TemplatesService.deleteById(_id, req.user._id, req.user.roles);

    return {
      template: deletedTemplate,
    };
  }

  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  @Put('edit')
  async update(
    @Req() req: RequestWithUser,
    @Body('_id') _id?: string,
    @Body('updates') updates?: ITemplatesToEdit,
  ) {
    if (!_id) {
      throw ApiError.BadRequest('Необходимо указать id');
    }

    if (!updates || Object.keys(updates).length === 0) {
      throw ApiError.BadRequest('Не переданы данные для обновления');
    }

    const editedTemplate: TemplatesDocument =
      await this.TemplatesService.editById(
        updates,
        _id,
        req.user._id,
        req.user.roles,
      );

    return {
      template: editedTemplate,
    };
  }
}