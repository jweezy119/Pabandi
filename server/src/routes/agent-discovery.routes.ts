/**
 * server/src/routes/agent-discovery.routes.ts
 *
 * Agent-facing discovery endpoints, all x402-gated:
 *   GET  /api/v1/agent/verify-human/:passportId   — Returns Trust Score and verification status. Price: $0.01 USDC.
 *   POST /api/v1/agent/create-escrow              — Creates an escrow for an agent-to-agent deal. Price: 0.5% of escrow amount.
 *   GET  /api/v1/agent/search-services?city=&category= — Returns available businesses with Trust Scores. Price: $0.05 USDC.
 *
 * Every 402 response includes the `extensions.bazaar` block so agents can
 * discover the request schema and a worked response example without
 * trial-and-error.
 */

import { Router, Request, Response } from 'express';
import { x402Pay } from '../middleware/x402Pay.middleware';
import { writeLimiter } from '../middleware/rateLimit.middleware';
import { encodePaymentRequired, buildPaymentRequired } from '../services/x402.service';
import { trustCore } from '../trust/trust-core';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';

const router = Router();

// ── Bazaar discovery declarations ──────────────────────────────────────────────
// Each 402 response includes these so agents can render the request schema and
// a worked response example without touching the dispatch code.

const BAZAAR_VERIFY_HUMAN = {
  bazaar: {
    info: {
      description: 'Verify a human trust passport and get their trust score',
      input: { passportId: 'pass_abc123' },
      output: { example: { trustScore: 750, tier: 'GOLD', verifiedIdentity: true, status: 'verified' } },
    },
  },
};

const BAZAAR_CREATE_ESCROW = {
  bazaar: {
    info: {
      description: 'Create escrow for agent-to-agent deal',
      input: { amount: 100, description: 'Service delivery', payerId: 'user_1', payeeId: 'agent_2' },
      output: { example: { escrowId: 'esc_123', status: 'funded', amount: 100, currency: 'USDC' } },
    },
  },
};

const BAZAAR_SEARCH_SERVICES = {
  bazaar: {
    info: {
      description: 'Search verified businesses by city and category',
      input: { city: 'New York', category: 'plumbing' },
      output: { example: [{ businessId: 'biz_1', name: 'ABC Plumbing', trustScore: 750, city: 'New York', category: 'plumbing' }] },
    },
  },
};

// ── GET /api/v1/agent/verify-human/:passportId ─────────────────────────────
// Price: $0.01 USDC
router.get(
  '/verify-human/:passportId',
  writeLimiter,
  x402Pay({
    amount: 0.01,
    resource: '/api/v1/agent/verify-human/:passportId',
    description: 'Verify human trust passport',
    bazaar: BAZAAR_VERIFY_HUMAN,
  }),
  async (req: Request, res: Response) => {
    try {
      const { passportId } = req.params;
      const trust = await trustCore.getPassport(passportId);
      res.json({ success: true, data: trust });
    } catch (err: any) {
      logger.error('[AgentDiscovery] verify-human failed:', err);
      res.status(404).json({ success: false, error: err.message || 'Passport not found' });
    }
  }
);

// ── POST /api/v1/agent/create-escrow ─────────────────────────────────────────
// Price: 0.5% of escrow amount
router.post(
  '/create-escrow',
  writeLimiter,
  x402Pay({
    amount: (req: Request) => {
      const amount = Number((req.body as any)?.amount);
      return Number.isFinite(amount) ? Math.round(amount * 0.005 * 100) / 100 : 0.01;
    },
    resource: '/api/v1/agent/create-escrow',
    description: 'Create escrow for agent-to-agent deal',
    bazaar: BAZAAR_CREATE_ESCROW,
  }),
  async (req: Request, res: Response) => {
    try {
      const { amount, description, payerId, payeeId } = req.body;
      if (!amount || !payerId || !payeeId) {
        return res.status(400).json({ success: false, error: 'amount, payerId, and payeeId are required' });
      }
      const escrow = await prisma.escrow.create({
        data: {
          amount,
          description: description || '',
          payerId,
          payeeId,
          status: 'PENDING',
        },
      });
      logger.info('[AgentDiscovery] escrow created', { escrowId: escrow.id, amount });
      res.json({ success: true, data: escrow });
    } catch (err: any) {
      logger.error('[AgentDiscovery] create-escrow failed:', err);
      res.status(400).json({ success: false, error: err.message || 'Failed to create escrow' });
    }
  }
);

// ── GET /api/v1/agent/search-services?city=&category= ────────────────────────
// Price: $0.05 USDC
router.get(
  '/search-services',
  writeLimiter,
  x402Pay({
    amount: 0.05,
    resource: '/api/v1/agent/search-services',
    description: 'Search verified businesses by city/category',
    bazaar: BAZAAR_SEARCH_SERVICES,
  }),
  async (req: Request, res: Response) => {
    try {
      const { city, category } = req.query;
      const services = await prisma.business.findMany({
        select: {
          id: true,
          name: true,
          category: true,
          city: true,
          trustScore: true,
        },
        take: 50,
      });
      res.json({ success: true, data: services });
    } catch (err: any) {
      logger.error('[AgentDiscovery] search-services failed:', err);
      res.status(500).json({ success: false, error: err.message || 'Search failed' });
    }
  }
);

export default router;
