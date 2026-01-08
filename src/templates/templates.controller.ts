import { BadRequestException, Controller, Post, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Express } from 'express';
import { AuthGuard } from 'src/auth/auth.guard';
import YaCloud from 'src/s3/bucket';

@Controller('templates')
export class TemplatesController {
  @Post('upload')
  @UseGuards(AuthGuard)
  @UseInterceptors(FileInterceptor('file'))
  async uploadTemplate(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Файл не найден');
    }

    const uploadResult: any = await YaCloud.Upload({
      file,
      path: 'templates',
      fileName: `${Date.now()}-${file.originalname}`,
    });

    return {
      url: uploadResult?.Location,
      key: uploadResult?.Key,
    };
  }
}
