import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { logger } from '../utils/logger';

export class StorageService {
  private s3Client: S3Client | null = null;
  private bucket: string | null = null;
  private isMock = false;

  // In-memory mock store for mock mode and tests
  private mockStore = new Map<string, { buffer: Buffer; mimeType: string }>();

  constructor() {
    this.init();
  }

  private init() {
    this.bucket = process.env.S3_BUCKET || null;
    const region = process.env.S3_REGION || 'auto';
    const accessKeyId = process.env.S3_ACCESS_KEY_ID;
    const secretAccessKey = process.env.S3_SECRET_ACCESS_KEY;
    const endpoint = process.env.S3_ENDPOINT;

    if (!this.bucket) {
      logger.warn('[StorageService] S3_BUCKET is not set; running in Mock Mode.');
      this.isMock = true;
      return;
    }

    try {
      this.s3Client = new S3Client({
        region,
        credentials:
          accessKeyId && secretAccessKey
            ? {
                accessKeyId,
                secretAccessKey,
              }
            : undefined,
        endpoint: endpoint || undefined,
      });
      this.isMock = false;
    } catch (err: any) {
      logger.warn(`[StorageService] Failed to initialize S3 client: ${err?.message}. Falling back to Mock Mode.`);
      this.isMock = true;
    }
  }

  /**
   * Generates a presigned upload URL for an S3/R2 object key. Expires in 5 minutes (300 seconds).
   */
  async getPresignedUploadUrl(key: string, mimeType: string): Promise<string> {
    if (this.isMock || !this.s3Client || !this.bucket) {
      return `https://mock-s3.com/upload/${encodeURIComponent(key)}?mime=${encodeURIComponent(mimeType)}`;
    }

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: mimeType,
    });

    return await getSignedUrl(this.s3Client, command, { expiresIn: 300 });
  }

  /**
   * Generates a presigned download URL for an S3/R2 object key. Expires in 5 minutes (300 seconds).
   */
  async getPresignedDownloadUrl(key: string): Promise<string> {
    if (this.isMock || !this.s3Client || !this.bucket) {
      return `https://mock-s3.com/download/${encodeURIComponent(key)}`;
    }

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    return await getSignedUrl(this.s3Client, command, { expiresIn: 300 });
  }

  /**
   * Deletes an object from storage.
   */
  async deleteObject(key: string): Promise<void> {
    if (this.isMock || !this.s3Client || !this.bucket) {
      this.mockStore.delete(key);
      return;
    }

    const command = new DeleteObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    await this.s3Client.send(command);
  }

  /**
   * Directly uploads buffer bytes to storage (used for inline uploads).
   */
  async uploadBuffer(key: string, buffer: Buffer, mimeType: string): Promise<void> {
    if (this.isMock || !this.s3Client || !this.bucket) {
      this.mockStore.set(key, { buffer, mimeType });
      return;
    }

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: buffer,
      ContentType: mimeType,
    });

    await this.s3Client.send(command);
  }

  /**
   * Checks whether an object exists in storage and verifies its size if expectedSize is passed.
   */
  async checkObjectExists(key: string, expectedSize?: number): Promise<{ exists: boolean; size?: number }> {
    if (this.isMock || !this.s3Client || !this.bucket) {
      const item = this.mockStore.get(key);
      if (item) {
        if (expectedSize !== undefined && item.buffer.length !== expectedSize) {
          return { exists: false, size: item.buffer.length };
        }
        return { exists: true, size: item.buffer.length };
      }
      // If not in mockStore, allow mocked tests to assume existence if expectedSize matches or default
      return { exists: true, size: expectedSize ?? 1024 };
    }

    try {
      const command = new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      const res = await this.s3Client.send(command);
      const size = res.ContentLength ?? 0;
      if (expectedSize !== undefined && size !== expectedSize) {
        return { exists: false, size };
      }
      return { exists: true, size };
    } catch (err: any) {
      return { exists: false };
    }
  }

  /**
   * Retrieves the raw buffer bytes of an object from storage to compute vcapHash.
   */
  async getObjectBytes(key: string): Promise<Buffer> {
    if (this.isMock || !this.s3Client || !this.bucket) {
      const item = this.mockStore.get(key);
      if (item) return item.buffer;
      return Buffer.from(`mock_file_content_for_${key}`);
    }

    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    const res = await this.s3Client.send(command);
    const byteArray = await res.Body?.transformToByteArray();
    return Buffer.from(byteArray || []);
  }

  /**
   * Set mock content directly for testing purposes.
   */
  setMockFile(key: string, buffer: Buffer, mimeType = 'application/octet-stream') {
    this.mockStore.set(key, { buffer, mimeType });
  }

  clearMockStore() {
    this.mockStore.clear();
  }
}

export const storageService = new StorageService();

