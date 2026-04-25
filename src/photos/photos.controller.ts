import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';

import { AuthGuard } from 'src/auth/auth.guard';
import ApiError from 'src/exceptions/errors/api-error';

import { ALLOWED_PHOTO_MIME_TYPES } from './constants/photos.constants';
import { CreatePhotoDto } from './dto/create-photo.dto';
import { UpdatePhotoDto } from './dto/update-photo.dto';
import { PhotosService } from './photos.service';

@ApiBearerAuth()
@ApiTags('Photos')
@Controller('photos')
export class PhotosController {
  constructor(private readonly photosService: PhotosService) {}

  @Post('upload')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Загрузить фото' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: {
        file: {
          type: 'string',
          format: 'binary',
        },
        name: {
          type: 'string',
          example: 'Название файла',
        },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', {
      fileFilter: (req, file, cb) => {
        if (ALLOWED_PHOTO_MIME_TYPES.includes(file.mimetype as typeof ALLOWED_PHOTO_MIME_TYPES[number])) {
          cb(null, true);
        } else {
          cb(ApiError.BadRequest('Разрешены только PNG, JPG и JPEG'), false);
        }
      },
    }),
  )
  async upload(
    @UploadedFile() file: Express.Multer.File,
    @Body() dto: CreatePhotoDto,
    @Req() request: any,
  ) {
    if (file) {
      file.originalname = Buffer.from(file.originalname, 'latin1').toString('utf8');
    }

    return await this.photosService.upload(file, dto, request.user);
  }

  @Get()
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Получить все фотки' })
  async getAll(@Req() request: any) {
    return await this.photosService.getAll(request.user);
  }

  @Get(':id')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Получить фото по ID' })
  @ApiParam({ name: 'id', type: 'string', required: true })
  async getOne(@Param('id') id: string, @Req() request: any) {
    return await this.photosService.getOne(id, request.user);
  }

  @Patch(':id')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Изменить имя фото' })
  @ApiParam({ name: 'id', type: 'string', required: true })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['name'],
      properties: {
        name: {
          type: 'string',
          example: 'Название фотки',
        },
      },
    },
  })
  async update(@Param('id') id: string, @Body() dto: UpdatePhotoDto, @Req() request: any) {
    return await this.photosService.update(id, dto, request.user);
  }

  @Delete(':id')
  @UseGuards(AuthGuard)
  @ApiOperation({ summary: 'Удалить фото по ID' })
  @ApiParam({ name: 'id', type: 'string', required: true })
  async delete(@Param('id') id: string, @Req() request: any) {
    return await this.photosService.delete(id, request.user);
  }
}
