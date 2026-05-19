import { S3Client, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { Upload } from '@aws-sdk/lib-storage'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import 'dotenv/config'

class YandexCloud {
  private client: S3Client

  constructor() {
    this.client = new S3Client({
      endpoint: 'https://storage.yandexcloud.net',
      credentials: {
        accessKeyId: process.env.YC_KEY_ID,
        secretAccessKey: process.env.YC_SECRET,
      },
      region: 'ru-central1',
      requestHandler: {
        requestTimeout: 10000,
        connectionTimeout: 10000,
      },
    })
  }

  Upload = async ({ file, path, fileName }): Promise<any> => {
    try {
      const upload = new Upload({
        client: this.client,
        params: {
          Bucket: process.env.YC_BUCKET_NAME,
          Key: `${path}/${fileName}`,
          Body: file.buffer,
          ContentType: file?.mimetype || 'application/octet-stream',
        },
      })
      return await upload.done()
    } catch (e) {
      console.error(e)
    }
  }

  public async deleteFile(filePath: string): Promise<void> {
    try {
      await this.client.send(new DeleteObjectCommand({
        Bucket: process.env.YC_BUCKET_NAME,
        Key: filePath,
      }))
    } catch (error) {
      console.error('deleteFile failed:', error)
      throw error
    }
  }

  public async generatePresignedUrl(objectKey: string): Promise<string> {
    try {
      return await getSignedUrl(
        this.client,
        new GetObjectCommand({
          Bucket: process.env.YC_BUCKET_NAME,
          Key: objectKey,
        }),
        { expiresIn: 60 * 5 },
      )
    } catch (error) {
      console.error('Error generating pre-signed URL', error)
      throw error
    }
  }
}

const YaCloud = new YandexCloud()
export default YaCloud