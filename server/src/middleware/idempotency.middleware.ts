import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { getRedis } from '../lib/redis';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';

const UUID_V4_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const IDEMPOTENCY_TTL_SECONDS = 86400; // 24 hours

export type IdempotencyStatus = 'processing' | 'completed' | 'failed';

export interface IdempotencyRecord {
  status: IdempotencyStatus;
  requestHash: string;
  statusCode?: number;
  responseBody?: any;
  contentType?: string;
  createdAt: number;
}

// In-memory fallback cache when Redis is unavailable or in unit test environments
const memoryStore = new Map<string, { record: IdempotencyRecord; expiresAt: number }>();

export function clearMemoryStore(): void {
  memoryStore.clear();
}

/**
 * Computes a SHA-256 fingerprint from the route path and request body.
 */
export function computePayloadHash(req: Request): string {
  const path = req.originalUrl || req.baseUrl + req.path;
  const bodyString = req.body ? JSON.stringify(req.body) : '';
  return crypto.createHash('sha256').update(`${path}:${bodyString}`).digest('hex');
}

/**
 * Fetches an idempotency record from Redis, Prisma database, or in-memory fallback.
 */
async function getRecord(key: string): Promise<IdempotencyRecord | null> {
  const redis = await getRedis();
  if (redis) {
    try {
      const data = await redis.get(`idempotency:${key}`);
      if (data) return JSON.parse(data);
    } catch (err) {
      logger.warn(`[Idempotency] Redis get error: ${String(err)}`);
    }
  }

  // Multi-tier: Check database if configured
  try {
    const dbRecord = await (prisma as any).paymentIdempotencyRecord?.findUnique({
      where: { key },
    });
    if (dbRecord) {
      if (new Date() > dbRecord.expiresAt) {
        return null;
      }
      return {
        status: dbRecord.status as IdempotencyStatus,
        requestHash: dbRecord.requestHash,
        statusCode: dbRecord.statusCode ?? undefined,
        responseBody: dbRecord.responseBody,
        createdAt: dbRecord.createdAt.getTime(),
      };
    }
  } catch {
    // If table is not yet migrated, smoothly fall through
  }

  const inMem = memoryStore.get(key);
  if (!inMem) return null;
  if (Date.now() > inMem.expiresAt) {
    memoryStore.delete(key);
    return null;
  }
  return inMem.record;
}

/**
 * Stores an idempotency record in Redis, Prisma database, and in-memory fallback.
 */
async function saveRecord(key: string, record: IdempotencyRecord): Promise<void> {
  const expiresAt = new Date(Date.now() + IDEMPOTENCY_TTL_SECONDS * 1000);

  const redis = await getRedis();
  if (redis) {
    try {
      await redis.set(
        `idempotency:${key}`,
        JSON.stringify(record),
        'EX',
        IDEMPOTENCY_TTL_SECONDS
      );
    } catch (err) {
      logger.warn(`[Idempotency] Redis set error: ${String(err)}`);
    }
  }

  // Multi-tier: Store in database
  try {
    await (prisma as any).paymentIdempotencyRecord?.upsert({
      where: { key },
      create: {
        key,
        requestHash: record.requestHash,
        status: record.status,
        statusCode: record.statusCode,
        responseBody: record.responseBody ?? undefined,
        expiresAt,
      },
      update: {
        requestHash: record.requestHash,
        status: record.status,
        statusCode: record.statusCode,
        responseBody: record.responseBody ?? undefined,
        expiresAt,
      },
    });
  } catch {
    // DB fallback
  }

  memoryStore.set(key, {
    record,
    expiresAt: expiresAt.getTime(),
  });
}

/**
 * Global Idempotency Middleware.
 * Intercepts POST, PUT, PATCH requests to guarantee zero double-processing.
 */
export const requireIdempotency = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void | Response> => {
  // Only state-changing HTTP methods require idempotency
  if (!['POST', 'PUT', 'PATCH'].includes(req.method.toUpperCase())) {
    return next();
  }

  const idempotencyKey = (
    req.header('Idempotency-Key') ||
    req.header('idempotency-key') ||
    (req.headers['x-idempotency-key'] as string)
  )?.trim();

  // 1. Missing header validation
  if (!idempotencyKey) {
    return res.status(400).json({
      error: 'Idempotency-Key header is required for this operation',
    });
  }

  // 2. UUID v4 syntax validation
  if (!UUID_V4_REGEX.test(idempotencyKey)) {
    return res.status(400).json({
      error: 'Idempotency-Key must be a valid UUID v4',
    });
  }

  const currentPayloadHash = computePayloadHash(req);

  try {
    const existing = await getRecord(idempotencyKey);

    if (existing) {
      // 3. Payload mismatch validation
      if (existing.requestHash !== currentPayloadHash) {
        return res.status(422).json({
          error: 'Idempotency key reused with different payload',
        });
      }

      // 4. In-flight collision
      if (existing.status === 'processing') {
        return res.status(409).json({
          error: 'Request already in progress',
        });
      }

      // 5. Duplicate completed/failed request — return exact cached response
      if (existing.statusCode) {
        res.status(existing.statusCode);
      }
      res.setHeader('X-Cache-Lookup', 'IDEMPOTENT_HIT');
      if (existing.contentType) {
        res.setHeader('Content-Type', existing.contentType);
      }
      return res.send(existing.responseBody);
    }

    // Mark as processing
    const processingRecord: IdempotencyRecord = {
      status: 'processing',
      requestHash: currentPayloadHash,
      createdAt: Date.now(),
    };
    await saveRecord(idempotencyKey, processingRecord);

    // Intercept response to capture status code & body on completion
    const originalJson = res.json.bind(res);
    const originalSend = res.send.bind(res);

    let captured = false;

    const recordResponse = async (statusCode: number, body: any, contentType?: string) => {
      if (captured) return;
      captured = true;

      const isError = statusCode >= 400;
      const finalRecord: IdempotencyRecord = {
        status: isError ? 'failed' : 'completed',
        requestHash: currentPayloadHash,
        statusCode,
        responseBody: body,
        contentType,
        createdAt: Date.now(),
      };
      await saveRecord(idempotencyKey, finalRecord);
    };

    res.json = (body: any): Response => {
      res.setHeader('X-Cache-Lookup', 'IDEMPOTENT_MISS');
      recordResponse(res.statusCode, body, 'application/json').catch((err) =>
        logger.error(`[Idempotency] Failed to record response: ${String(err)}`)
      );
      return originalJson(body);
    };

    res.send = (body: any): Response => {
      res.setHeader('X-Cache-Lookup', 'IDEMPOTENT_MISS');
      const contentType = res.getHeader('Content-Type')?.toString();
      recordResponse(res.statusCode, body, contentType).catch((err) =>
        logger.error(`[Idempotency] Failed to record response: ${String(err)}`)
      );
      return originalSend(body);
    };

    return next();
  } catch (error) {
    logger.error(`[Idempotency] Middleware error: ${String(error)}`);
    return next(error);
  }
};
