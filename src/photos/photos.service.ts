import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as path from 'path';

import ApiError from 'src/exceptions/errors/api-error';
import { FilesService } from 'src/files/files.service';
import { RolesService } from 'src/roles/roles.service';

import { CreatePhotoDto } from './dto/create-photo.dto';
import { UpdatePhotoDto } from './dto/update-photo.dto';
import { Photo, PhotoDocument } from './schemas/photos.schema';
import {
  ALLOWED_PHOTO_MIME_TYPES,
  MAX_PHOTO_ORIGINAL_NAME_LENGTH,
  USER_PHOTO_LIMIT,
  USER_PHOTO_MAX_SIZE,
} from './constants/photos.constants';

type PhotoResponse = {
  _id: Types.ObjectId;
  name: string;
  originalName: string;
  size: number;
  mimeType: string;
  createdAt: Date;
};

const PHOTO_PUBLIC_FIELDS = 'name originalName size mimeType createdAt';

@Injectable()
export class PhotosService {
  constructor(
    @InjectModel(Photo.name) private photoModel: Model<PhotoDocument>,
    private filesService: FilesService,
    private rolesService: RolesService,
  ) {}

  async upload(file: Express.Multer.File, dto: CreatePhotoDto, user: any): Promise<PhotoResponse> {
    if (!file) {
      throw ApiError.BadRequest('Фотография не загружена');
    }

    if (!ALLOWED_PHOTO_MIME_TYPES.includes(file.mimetype as typeof ALLOWED_PHOTO_MIME_TYPES[number])) {
      throw ApiError.BadRequest('Разрешены только PNG, JPG и JPEG');
    }

    const isAdmin = this.rolesService.isAdmin(user.roles);

    if (!isAdmin && file.size > USER_PHOTO_MAX_SIZE) {
      throw ApiError.BadRequest('Максимальный размер фотографии 128 КБ');
    }

    if (!isAdmin) {
      const photosCount = await this.photoModel.countDocuments({ userId: user._id }).exec();

      if (photosCount >= USER_PHOTO_LIMIT) {
        throw ApiError.BadRequest('Максимальное количество фотографий 5');
      }
    }

    const originalName = this.normalizeOriginalName(file.originalname);
    const fileName = this.filesService.generateFileName(originalName);
    const filePath = await this.filesService.saveYCFilePhoto(file, fileName, user);

    const photo = await this.photoModel.create({
      userId: user._id,
      name: dto.name || originalName,
      originalName,
      filePath,
      size: file.size,
      mimeType: file.mimetype,
    });

    return await this.getOne(photo._id.toString(), user);
  }

  async getAll(user: any): Promise<PhotoResponse[]> {
    return await this.photoModel
      .find({ userId: user._id })
      .select(PHOTO_PUBLIC_FIELDS)
      .lean<PhotoResponse[]>();
  }

  async getOne(id: string, user: any): Promise<PhotoResponse> {
    const photo = await this.photoModel
      .findOne({ _id: id, userId: user._id })
      .select(PHOTO_PUBLIC_FIELDS)
      .lean<PhotoResponse>();

    if (!photo) {
      throw ApiError.NotFound();
    }

    return photo;
  }

  async update(id: string, dto: UpdatePhotoDto, user: any): Promise<PhotoResponse> {
    const photo = await this.photoModel.findOne({ _id: id, userId: user._id }).exec();

    if (!photo) {
      throw ApiError.NotFound();
    }

    photo.name = dto.name;

    await photo.save();

    return await this.getOne(id, user);
  }

  async delete(id: string, user: any): Promise<boolean> {
    const photo = await this.photoModel.findOne({ _id: id, userId: user._id }).exec();

    if (!photo) {
      throw ApiError.NotFound();
    }

    await this.filesService.deleteYCFile(photo.filePath);
    await this.photoModel.deleteOne({ _id: id, userId: user._id }).exec();

    return true;
  }

  private normalizeOriginalName(originalName: string): string {
    const extension = path.extname(originalName);
    const baseName = path.basename(originalName, extension);
    const maxBaseNameLength = MAX_PHOTO_ORIGINAL_NAME_LENGTH - extension.length;

    return `${baseName.slice(0, maxBaseNameLength)}${extension}`;
  }
}
