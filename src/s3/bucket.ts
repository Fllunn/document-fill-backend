import * as AWS from 'aws-sdk'
// не трогать! иначе не будет env
import 'dotenv/config'

class YandexCloud {
  aws: any

  constructor() {
    this.aws = new AWS.S3({
      endpoint: 'https://storage.yandexcloud.net',
      accessKeyId: process.env.YC_KEY_ID, // берем ключ из переменной окружения
      secretAccessKey: process.env.YC_SECRET, // берем секрет из переменной окружения
      region: 'ru-central1',
      httpOptions: {
        timeout: 10000,
        connectTimeout: 10000
      },
    });
  }

  Upload = async ({ file, path, fileName }): Promise<any> => {
    try {
      const params = {
        Bucket: process.env.YC_BUCKET_NAME, // название созданного bucket
        Key: `${path}/${fileName}`, // путь и название файла в облаке (path без слэша впереди)
        Body: file.buffer, // сам файл
        ContentType: file?.mimetype || 'application/octet-stream', // тип файла
      }

      const aws = this.aws
      const result = await new Promise(function (resolve, reject) {

        aws.upload(params, function (err, data) {
          if (err) return reject(err);
          return resolve(data);
        });
      });
      return result;
    } catch (e) {

      console.error(e);
    }
  }

  public async deleteFile (filePath: string): Promise<void> {
    try {
      const params = {
        Bucket: process.env.YC_BUCKET_NAME,
        Key: filePath,
      };

      const aws = this.aws;

      await new Promise<void>((resolve, reject) => {
        aws.deleteObject(params, function (err, data) {
          if (err) {
            console.error('Error delete file from yandex cloud:', err);
            return reject(err);
          }

          // if (process.env.NODE_ENV === 'development') {
          //   console.log('File successfully deleted from yandex cloud', filePath);
          // }

          resolve();
        });
      });
    } catch (error) {
      console.error('deleteFile failed:', error);
      throw error;
    }
  }

  public async generatePresignedUrl(objectKey: string) {
    try {
      const params = {
        Bucket: process.env.YC_BUCKET_NAME,
        Key: objectKey,
        Expires: 60 * 5, // URL expiration time in seconds
        ContentType: 'application/octet-stream', // Set the content type
      };
      const url = await this.aws.getSignedUrlPromise('getObject', params);
      return url;
    } catch (error) {
      console.error('Error generating pre-signed URL', error);
      throw error;
    }
  }
  public async uploadVideo(fileBuffer: any, presignedUrl: string) {
    const response = await fetch(presignedUrl, {
      method: 'PUT',
      body: fileBuffer,
      headers: {
        'Content-Type': 'application/octet-stream',
        // Optionally set other headers
      },
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }

    console.log('File uploaded successfully!', response);
    return response
  }

}

const YaCloud = new YandexCloud();
export default YaCloud