import { ExceptionFilter, Catch, ArgumentsHost } from '@nestjs/common';
import { MulterError } from 'multer';
import ApiError from '../errors/api-error';
import { Response } from 'express';

@Catch(MulterError, Error)
export class MulterExceptionFilter implements ExceptionFilter {
  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    // Превышение размера файла
    if (exception instanceof MulterError && exception.code === 'LIMIT_FILE_SIZE') {
      return response
        .status(400)
        .json(ApiError.BadRequest('Размер файла не должен превышать 512 КБ'));
    }

    // Недопустимый тип файла
    if (exception.message === 'INVALID_FILE_TYPE') {
      return response
        .status(400)
        .json(ApiError.BadRequest('Недопустимый тип файла. Разрешены .docx и .doc'));
    }

    // Другие ошибки
    if (exception instanceof MulterError) {
      return response.status(400).json(ApiError.BadRequest(exception.message));
    }

    return response.status(500).json(ApiError.BadRequest('Ошибка загрузки файла'));
  }
}