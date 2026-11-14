import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { logger } from '../utils/logger';

export interface StoredImage {
  hash: string;
  storageKey: string;
  url: string;
}

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function localDir(): string {
  return path.join(process.cwd(), 'uploads', 'receipts');
}

async function storeLocal(key: string, base64: string): Promise<StoredImage> {
  const dir = localDir();
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, key);
  fs.writeFileSync(file, Buffer.from(base64, 'base64'));
  return {
    hash: sha256(base64),
    storageKey: `local:receipts/${key}`,
    url: `/uploads/receipts/${key}`,
  };
}

async function storeS3(key: string, base64: string): Promise<StoredImage> {
  const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
  const bucket = process.env.STORAGE_BUCKET;
  if (!bucket) throw new Error('STORAGE_BUCKET is required when STORAGE_ENDPOINT is set');
  const endpoint = process.env.STORAGE_ENDPOINT;
  const region = process.env.STORAGE_REGION || 'auto';
  const client = new S3Client({
    endpoint,
    region,
    forcePathStyle: Boolean(endpoint),
    credentials: {
      accessKeyId: process.env.STORAGE_ACCESS_KEY_ID || '',
      secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY || '',
    },
  });
  const body = Buffer.from(base64, 'base64');
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: `receipts/${key}`,
      Body: body,
      ContentType: 'image/jpeg',
      ChecksumSHA256: crypto.createHash('sha256').update(body).digest('base64'),
    }),
  );
  const publicBase = (process.env.STORAGE_PUBLIC_BASE_URL || '').replace(/\/$/, '');
  return {
    hash: sha256(base64),
    storageKey: `s3:${bucket}/receipts/${key}`,
    url: publicBase ? `${publicBase}/receipts/${key}` : `s3://${bucket}/receipts/${key}`,
  };
}

export async function storeReceiptImage(base64: string, hint?: string): Promise<StoredImage> {
  const clean = base64.replace(/^data:image\/[a-z]+;base64,/, '');
  const hash = sha256(clean);
  const ext = hint?.startsWith('data:image/') ? hint.split('/')[1]?.split(';')[0] || 'jpg' : 'jpg';
  const key = `${hash}.${ext}`;
  if (process.env.STORAGE_ENDPOINT || process.env.STORAGE_BUCKET) {
    return storeS3(key, clean);
  }
  return storeLocal(key, clean);
}

export function receiptImageHash(base64: string): string {
  return sha256(base64.replace(/^data:image\/[a-z]+;base64,/, ''));
}
