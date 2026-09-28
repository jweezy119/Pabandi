import { Router, Request, Response } from 'express';
import { prisma } from '../utils/database';
import { apiKeyAuth, logApiUsage } from '../middleware/apiKey.middleware';
import { CustomError } from '../middleware/errorHandler';
import * as fs from 'fs';
import * as path from 'path';
import { TRUST_API_OPENAPI_SPEC } from '../specs/trustApi.openapi';

const router = Router();

const TIER_DAILY_LIMITS: Record<string, number> = {
  STARTER: 100,
  PRO: 10_000,
  ENTERPRISE: 100_000,
};

const TIER_OVERAGE_PRICES: Record<string, number> = {
  STARTER: 0,
  PRO: 0.05,
  ENTERPRISE: 0,
};

const TIER_RATE_LIMITS: Record<string, number> = {
  STARTER: 100,
  PRO: 10_000,
  ENTERPRISE: 100_000,
};

function trustApiKeyAuth(req: Request, res: Response, next: Function) {
  const apiKey = req.headers['x-api-key'] as string | undefined;
  if (!apiKey) {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.slice(7).trim();
      if (token.startsWith('pk_')) {
        req.headers['x-api-key'] = token;
      }
    }
  }
  apiKeyAuth(req, res, next);
}

function trustRateLimit(req: Request, res: Response, next: Function) {
  const client = (req as any).apiClient;
  if (!client) return next();

  const tier = client.tier || 'STARTER';
  const limit = TIER_RATE_LIMITS[tier] || TIER_RATE_LIMITS.STARTER;

  const key = `trust:v1:${client.id}`;
  const now = Date.now();
  const windowMs = 60 * 1000;

  // Simple in-memory rate limiting (replace with Redis in production)
  const cache = (global as any).__trustRateCache || new Map();
  (global as any).__trustRateCache = cache;

  const entry = cache.get(key);
  if (!entry || now >= entry.resetAt) {
    cache.set(key, { count: 1, resetAt: now + windowMs });
    return next();
  }

  if (entry.count >= limit) {
    return res.status(429).json({
      success: false,
      error: `Rate limit exceeded (${limit}/min for ${tier} tier)`,
      retryAfter: Math.ceil((entry.resetAt - now) / 1000),
    });
  }

  entry.count++;
  next();
}

function trustUsageLogger(req: Request, res: Response, next: Function) {
  res.on('finish', () => {
    const client = (req as any).apiClient;
    if (!client) return;

    const latencyMs = Date.now() - ((req as any).requestStartTime ?? Date.now());
    const endpoint = req.path;

    const tier = (req as any).apiClient?.tier || 'STARTER';
    const dailyLimit = TIER_DAILY_LIMITS[tier] || TIER_DAILY_LIMITS.STARTER;
    const overagePrice = TIER_OVERAGE_PRICES[tier] || 0;

    Promise.all([
      prisma.apiUsageLog.create({
        data: {
          clientId: client.id,
          endpoint: req.path,
          statusCode: res.statusCode,
          latencyMs: latencyMs,
          costFiat: overagePrice,
          costCrypto: 0,
        },
      }),
      prisma.apiClient.update({
        where: { id: client.id },
        data: { callsUsed: { increment: 1 } },
      }),
    ]).catch((err) => console.error('Failed to log trust API usage:', err));
  });
  next();
}

function getPublicPassportData(passport: any) {
  return {
    id: passport.id,
    handle: passport.handle,
    displayName: passport.displayName,
    category: passport.category,
    visibility: passport.visibility,
    scores: {
      payment: passport.paymentScore ?? 500,
      showUp: passport.showUpScore ?? 500,
      delivery: passport.deliveryScore ?? 500,
    },
    sampleSizes: {
      payment: passport.paymentSampleSize ?? 0,
      showUp: passport.showUpSampleSize ?? 0,
      delivery: passport.deliverySampleSize ?? 0,
    },
    verifiedIdentity: passport.verifiedIdentity ?? false,
    verifiedAt: passport.verifiedAt,
    verifiedLocationCount: passport.verifiedLocationCount ?? 0,
    verifiedEventCount: passport._count?.invoiceTrustEvents ?? 0,
    badges: passport.verifiedIdentity ? ['Verified Identity'] : [],
    memberSince: passport.createdAt.toISOString(),
  };
}

router.get('/passport/:id', trustApiKeyAuth, trustRateLimit, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const passport = await prisma.trustPassport.findUnique({
      where: { id },
      include: {
        _count: {
          select: { invoiceTrustEvents: true },
        },
      },
    });

    if (!passport || passport.visibility !== 'PUBLIC') {
      return res.status(404).json({
        success: false,
        error: 'Profile not found or private',
      });
    }

    trustUsageLogger(req, res, () => {});

    return res.json({
      success: true,
      data: getPublicPassportData(passport),
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/score/:id', trustApiKeyAuth, trustRateLimit, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { context } = req.query;

    const passport = await prisma.trustPassport.findUnique({
      where: { id },
      select: {
        id: true,
        handle: true,
        displayName: true,
        paymentScore: true,
        showUpScore: true,
        deliveryScore: true,
        paymentSampleSize: true,
        showUpSampleSize: true,
        deliverySampleSize: true,
        verifiedIdentity: true,
      },
    });

    if (!passport || passport.visibility !== 'PUBLIC') {
      return res.status(404).json({
        success: false,
        error: 'Profile not found or private',
      });
    }

    let score = 0;
    let contextLabel = 'overall';

    switch (context) {
      case 'payment':
        score = passport.paymentScore ?? 500;
        contextLabel = 'payment';
        break;
      case 'showUp':
        score = passport.showUpScore ?? 500;
        contextLabel = 'showUp';
        break;
      case 'delivery':
        score = passport.deliveryScore ?? 500;
        contextLabel = 'delivery';
        break;
      default:
        score = Math.round(
          ((passport.paymentScore ?? 500) + (passport.showUpScore ?? 500) + (passport.deliveryScore ?? 500)) / 3
        );
        contextLabel = 'overall';
    }

    trustUsageLogger(req, res, () => {});

    return res.json({
      success: true,
      data: {
        id: passport.id,
        handle: passport.handle,
        displayName: passport.displayName,
        score,
        context: contextLabel,
        confidence: Math.min(
          100,
          (passport.paymentSampleSize ?? 0) + (passport.showUpSampleSize ?? 0) + (passport.deliverySampleSize ?? 0)
        ),
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/bulk-check', trustApiKeyAuth, trustRateLimit, async (req: Request, res: Response) => {
  try {
    const { ids } = req.body;

    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      throw new CustomError('ids array is required', 400);
    }

    if (ids.length > 100) {
      throw new CustomError('Maximum 100 IDs per request', 400);
    }

    const passports = await prisma.trustPassport.findMany({
      where: {
        id: { in: ids },
        visibility: 'PUBLIC',
      },
      select: {
        id: true,
        handle: true,
        displayName: true,
        category: true,
        paymentScore: true,
        showUpScore: true,
        deliveryScore: true,
        verifiedIdentity: true,
        verifiedLocationCount: true,
        createdAt: true,
        _count: {
          select: { invoiceTrustEvents: true },
        },
      },
    });

    const results = passports.map(p => ({
      id: p.id,
      handle: p.handle,
      displayName: p.displayName,
      category: p.category,
      scores: {
        payment: p.paymentScore ?? 500,
        showUp: p.showUpScore ?? 500,
        delivery: p.deliveryScore ?? 500,
      },
      verifiedIdentity: p.verifiedIdentity ?? false,
      verifiedLocationCount: p.verifiedLocationCount ?? 0,
      verifiedEventCount: p._count?.invoiceTrustEvents ?? 0,
      memberSince: p.createdAt.toISOString(),
    }));

    const foundIds = new Set(results.map(r => r.id));
    const notFound = ids.filter(id => !foundIds.has(id)).map(id => ({ id, error: 'Not found or private' }));

    return res.json({
      success: true,
      data: {
        results,
        notFound,
        summary: {
          requested: ids.length,
          found: results.length,
          notFound: notFound.length,
        },
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/openapi.json', async (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'application/json');
    const specPath = path.join(__dirname, '../specs/trustApi.openapi.json');
    const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'));
    res.json(spec);
  });

export default router;
