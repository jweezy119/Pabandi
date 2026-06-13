import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import crypto from 'crypto';

const router = Router();

// All API client management routes require admin authentication
router.use(authenticate);
router.use(authorize('ADMIN'));

const TIER_LIMITS: Record<string, number> = {
  STARTER: 500,
  GROWTH: 10_000,
  ENTERPRISE: 100_000,
};

/**
 * POST /api/v1/admin/api-clients
 * Provision a new API client and generate an API key.
 */
router.post('/', async (req, res, next) => {
  try {
    const { name, email, tier = 'STARTER' } = req.body;

    if (!name || !email) {
      return res.status(400).json({ success: false, error: 'name and email are required' });
    }

    if (!['STARTER', 'GROWTH', 'ENTERPRISE'].includes(tier)) {
      return res.status(400).json({ success: false, error: 'Invalid tier. Must be STARTER, GROWTH, or ENTERPRISE' });
    }

    // Generate a secure, prefixed API key
    const rawKey = crypto.randomBytes(32).toString('hex');
    const apiKey = `pk_live_${rawKey}`;
    const callsLimit = TIER_LIMITS[tier];

    const client = await prisma.apiClient.create({
      data: { name, email, apiKey, tier: tier as any, callsLimit },
    });

    logger.info(`[Admin] New API client provisioned: ${name} (${email}) tier=${tier}`);

    return res.status(201).json({
      success: true,
      data: {
        id: client.id,
        name: client.name,
        email: client.email,
        apiKey: client.apiKey, // Only returned once on creation
        tier: client.tier,
        callsLimit: client.callsLimit,
        createdAt: client.createdAt,
      },
      message: 'Store the apiKey securely — it will not be shown again.',
    });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return res.status(409).json({ success: false, error: 'An API client with this email already exists' });
    }
    next(error);
  }
});

/**
 * GET /api/v1/admin/api-clients
 * List all API clients with usage statistics.
 */
router.get('/', async (req, res, next) => {
  try {
    const clients = await prisma.apiClient.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        email: true,
        tier: true,
        callsUsed: true,
        callsLimit: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        // Do NOT expose the raw apiKey in list responses
      },
    });

    return res.status(200).json({
      success: true,
      data: { clients, total: clients.length },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * PUT /api/v1/admin/api-clients/:id
 * Update tier, limits, or active status for a client.
 */
router.put('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { tier, isActive, callsLimit } = req.body;

    const updateData: any = {};
    if (tier !== undefined) {
      if (!['STARTER', 'GROWTH', 'ENTERPRISE'].includes(tier)) {
        return res.status(400).json({ success: false, error: 'Invalid tier' });
      }
      updateData.tier = tier;
      // Auto-update limit to match tier unless explicitly overridden
      if (callsLimit === undefined) {
        updateData.callsLimit = TIER_LIMITS[tier];
      }
    }
    if (isActive !== undefined) updateData.isActive = isActive;
    if (callsLimit !== undefined) updateData.callsLimit = callsLimit;

    const client = await prisma.apiClient.update({
      where: { id },
      data: updateData,
      select: { id: true, name: true, tier: true, callsLimit: true, isActive: true },
    });

    logger.info(`[Admin] API client ${id} updated:`, updateData);

    return res.status(200).json({ success: true, data: { client } });
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return res.status(404).json({ success: false, error: 'API client not found' });
    }
    next(error);
  }
});

/**
 * DELETE /api/v1/admin/api-clients/:id
 * Revoke an API key (soft delete via isActive = false, or hard delete).
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { hard = false } = req.query;

    if (hard === 'true') {
      await prisma.apiClient.delete({ where: { id } });
      logger.warn(`[Admin] API client ${id} HARD DELETED`);
    } else {
      await prisma.apiClient.update({ where: { id }, data: { isActive: false } });
      logger.info(`[Admin] API client ${id} revoked (soft delete)`);
    }

    return res.status(200).json({ success: true, message: hard === 'true' ? 'Client permanently deleted' : 'API key revoked' });
  } catch (error: any) {
    if (error?.code === 'P2025') {
      return res.status(404).json({ success: false, error: 'API client not found' });
    }
    next(error);
  }
});

export default router;
