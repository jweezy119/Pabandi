import { Response, NextFunction } from 'express';
import { LRUCache } from 'lru-cache';
import { AuthRequest } from './auth.middleware';
import { logger } from '../utils/logger';

interface CachedResponse {
  status: number;
  body: any;
  timestamp: number;
}

// 24 hours TTL in milliseconds
const IDEMPOTENCY_TTL = 24 * 60 * 60 * 1000;

// High capacity LRU cache for 24-hour idempotency keys
const idempotencyCache = new LRUCache<string, CachedResponse>({
  max: 50000,
  ttl: IDEMPOTENCY_TTL,
});

/**
 * Idempotency middleware for mutating endpoints.
 * Expects an `Idempotency-Key` HTTP header.
 * Key is scoped by businessId: `${businessId}:${key}` to prevent cross-tenant collision.
 */
export function idempotency(req: AuthRequest, res: Response, next: NextFunction) {
  const idempotencyKey = req.headers['idempotency-key'] as string | undefined;

  // Non-mutating methods don't require idempotency
  if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method)) {
    return next();
  }

  // If no idempotency key provided, proceed normally
  if (!idempotencyKey || !idempotencyKey.trim()) {
    return next();
  }

  const businessId = req.user?.businessId || 'anonymous';
  const compositeKey = `idemp:${businessId}:${idempotencyKey.trim()}`;

  const cached = idempotencyCache.get(compositeKey);
  if (cached) {
    logger.info(`[Idempotency] Returning cached response for key: ${idempotencyKey} (Tenant: ${businessId})`);
    res.setHeader('X-Cache-Lookup', 'HIT-IDEMPOTENT');
    return res.status(cached.status).json(cached.body);
  }

  // Intercept json() to capture and store the response
  const originalJson = res.json.bind(res);
  res.json = (body: any): Response => {
    // Only cache successful or client error responses (don't cache 500s so retry is possible)
    if (res.statusCode < 500) {
      idempotencyCache.set(compositeKey, {
        status: res.statusCode,
        body,
        timestamp: Date.now(),
      });
    }
    return originalJson(body);
  };

  next();
}

