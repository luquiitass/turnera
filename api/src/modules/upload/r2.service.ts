import { Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { randomUUID } from 'crypto';

@Injectable()
export class R2Service {
  private readonly logger = new Logger(R2Service.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly publicUrl: string;

  constructor() {
    const accountId = process.env['R2_ACCOUNT_ID'];
    this.bucket    = process.env['R2_BUCKET_NAME']    ?? 'turnera-images';
    this.publicUrl = (process.env['R2_PUBLIC_URL']    ?? '').replace(/\/$/, '');

    this.client = new S3Client({
      region: 'auto',
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId:     process.env['R2_ACCESS_KEY_ID']     ?? '',
        secretAccessKey: process.env['R2_SECRET_ACCESS_KEY'] ?? '',
      },
    });
  }

  async upload(buffer: Buffer, originalName: string, mimeType: string): Promise<{ key: string; url: string; size: number }> {
    const key = `${randomUUID()}.webp`;

    let compressed: Buffer;
    try {
      // Import dinámico para no crashear si el binding nativo no está disponible
      const sharp = (await import('sharp')).default;
      const original = buffer.length;
      compressed = await sharp(buffer)
        .resize({ width: 1920, height: 1920, fit: 'inside', withoutEnlargement: true })
        .webp({ quality: 92, effort: 4 })
        .toBuffer();
      this.logger.log(`[R2] Comprimido: ${(original / 1024).toFixed(0)}KB → ${(compressed.length / 1024).toFixed(0)}KB`);
    } catch {
      this.logger.warn('[R2] sharp no disponible, subiendo original sin comprimir');
      compressed = buffer;
    }

    try {
      await this.client.send(new PutObjectCommand({
        Bucket:      this.bucket,
        Key:         key,
        Body:        compressed,
        ContentType: 'image/webp',
      }));
    } catch (err: any) {
      this.logger.error('[R2] Upload failed:', err.message);
      throw new InternalServerErrorException('Error al subir la imagen');
    }

    const url = `${this.publicUrl}/${key}`;
    this.logger.log(`[R2] Uploaded: ${key}`);
    return { key, url, size: compressed.length };
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
      this.logger.log(`[R2] Deleted: ${key}`);
    } catch (err: any) {
      this.logger.warn(`[R2] Delete failed for ${key}:`, err.message);
    }
  }
}
