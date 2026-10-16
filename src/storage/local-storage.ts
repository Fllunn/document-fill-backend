import * as fs from 'fs';
import * as path from 'path';

/**
 * Файлы пользователей на локальном диске (вместо Yandex Object Storage).
 * Ключи те же, что были в бакете: users/<id>/templates/<file>, поэтому filePath в Mongo не меняется.
 * Корень — STORAGE_DIR или ./storage (в контейнере /app/storage).
 */
class LocalStorage {
  private readonly root = path.resolve(process.env.STORAGE_DIR || path.join(process.cwd(), 'storage'));

  // ключ → абсолютный путь; выход за пределы корня запрещён
  private resolve(key: string): string {
    const fullPath = path.resolve(this.root, key);

    if (!fullPath.startsWith(this.root + path.sep)) {
      throw new Error(`Недопустимый путь к файлу: ${key}`);
    }

    return fullPath;
  }

  async upload(key: string, buffer: Buffer): Promise<void> {
    const fullPath = this.resolve(key);

    await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.promises.writeFile(fullPath, buffer);
  }

  // как и в S3, удаление несуществующего файла не ошибка
  async deleteFile(key: string): Promise<void> {
    try {
      await fs.promises.unlink(this.resolve(key));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
  }

  async read(key: string): Promise<Buffer> {
    return fs.promises.readFile(this.resolve(key));
  }
}

const Storage = new LocalStorage();
export default Storage;
