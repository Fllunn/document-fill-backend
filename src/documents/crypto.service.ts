import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';
import ApiError from 'src/exceptions/errors/api-error';

@Injectable()
export class CryptoService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly key: Buffer;

  constructor() {
    const keyString = process.env.DOCUMENT_ENCRYPTION_KEY;
    if (!keyString) {
      throw new Error('DOCUMENT_ENCRYPTION_KEY пустой!');
    }
    this.key = crypto.createHash('sha256').update(keyString, 'utf8').digest();
  }

  encrypt(plaintext: string): string {
    // вектор инициализации
    const iv = crypto.randomBytes(12);
    // шифрование
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
    // получение зашифрованного текста и тега аутентификации
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    // объединение IV, тега и зашифрованного текста в одну строку
    const authTag = cipher.getAuthTag();
    // кодирование в base64 для хранения
    return Buffer.concat([iv, authTag, encrypted]).toString('base64');
  }

  decrypt(ciphertext: string): string {
    try {
      // декодирование из base64
      const buffer = Buffer.from(ciphertext, 'base64');
      const iv = buffer.subarray(0, 12);
      const authTag = buffer.subarray(12, 28);
      const encrypted = buffer.subarray(28);
      const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
      decipher.setAuthTag(authTag);
      return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
    } catch {
      throw ApiError.BadRequest('Метаданные файла повреждены');
    }
  }
}
