/**
 * simulator.routes.ts — Project Simulator API.
 *
 *   POST /api/v1/simulator/start        — create simulation + trigger swarm (background)
 *   GET  /api/v1/simulator/:id          — get simulation status + agent trace
 *   POST /api/v1/simulator/:id/steer    — update factors + re-run swarm
 *
 * Swarm execution is fire-and-forget: the HTTP response returns immediately
 * with the simulationId, and the frontend polls GET /:id for progress.
 */
import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { runSwarm } from '../services/simulator/swarm.service';
import { squareService } from '../services/squareCheckout.service';
import { safepayService } from '../services/safepay.service';
import { universalEscrowService } from '../services/universal-escrow.service';
import { z } from 'zod';

const router = Router();

const StartBodySchema = z.object({
  projectType: z.string().min(1),
  factors: z.record(z.string(), z.unknown()),
});

const SteerBodySchema = z.object({
  factors: z.record(z.string(), z.unknown()),
});

const PublicFundBodySchema = z.object({
  rail: z.enum(['square', 'solana', 'safepay']).default('square'),
  milestoneMode: z.enum(['full', 'deposit_50']).default('full'),
  clientName: z.string().max(120).optional(),
  clientEmail: z.string().email().optional().or(z.literal('')),
  origin: z.string().url().optional(),
});

const PublicVerifySolanaSchema = z.object({
  txSignature: z.string().min(20).max(128),
  milestoneMode: z.enum(['full', 'deposit_50']).default('full'),
  clientName: z.string().max(120).optional(),
  clientEmail: z.string().email().optional().or(z.literal('')),
});

// ── POST /api/v1/simulator/start ──────────────────────────────────────────

router.post(
  '/start',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { projectType, factors } = StartBodySchema.parse(req.body);
      const userId = req.user!.id;

      // Create the simulation record (draft status)
      const simulation = await prisma.projectSimulation.create({
        data: {
          userId,
          projectType,
          initialFactors: factors as any,
          status: 'draft',
        },
      });

      // Trigger swarm in the background (fire-and-forget). Do not await — the
      // HTTP response returns immediately with the simulationId. The frontend
      // polls GET /:id for progress.
      runSwarm(simulation.id, factors).catch((err: any) => {
        logger.error(`[Simulator] background swarm failed for ${simulation.id}: ${err.message}`);
      });

      return res.status(201).json({
        success: true,
        data: {
          simulationId: simulation.id,
          status: 'draft',
        },
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('[Simulator] start error:', message);
      return res.status(400).json({ success: false, error: message });
    }
  },
);

// ── Public Interactive Proposal Endpoints (/p/estimate/:id) ───────────────
// Declared BEFORE `GET /:id` so literal `/public/...` paths are matched first.

router.get(
  '/public/:id',
  async (req: Request, res: Response, _next: NextFunction) => {
    try {
      const { id } = req.params;
      let simulation = await prisma.projectSimulation.findUnique({
        where: { id },
        include: {
          agentRuns: {
            orderBy: { createdAt: 'asc' },
            select: {
              id: true,
              agentRole: true,
              inputPayload: true,
              outputPayload: true,
              status: true,
              executionTimeMs: true,
              createdAt: true,
            },
          },
        },
      });

      // Auto-seed the live interactive demo proposal when `/p/estimate/demo` is visited
      if (!simulation && id === 'demo') {
        const demoFactors = { timelineUrgency: 3, quality: 4, scale: 3 };
        await prisma.projectSimulation.create({
          data: {
            id: 'demo',
            userId: 'pabandi-demo-provider',
            projectType: 'app-development',
            initialFactors: demoFactors as any,
            status: 'draft',
          },
        });
        await runSwarm('demo', demoFactors);
        simulation = await prisma.projectSimulation.findUnique({
          where: { id: 'demo' },
          include: {
            agentRuns: {
              orderBy: { createdAt: 'asc' },
              select: {
                id: true,
                agentRole: true,
                inputPayload: true,
                outputPayload: true,
                status: true,
                executionTimeMs: true,
                createdAt: true,
              },
            },
          },
        });
      }

      if (!simulation) {
        return res.status(404).json({ success: false, error: 'Proposal not found' });
      }

      // Best-effort lookup of creator & escrow state
      const [creatorUser, creatorBusiness, escrow] = await Promise.all([
        prisma.user
          .findUnique({
            where: { id: simulation.userId },
            select: { id: true, firstName: true, lastName: true, email: true },
          })
          .catch(() => null),
        prisma.platformBusiness
          .findFirst({
            where: { ownerId: simulation.userId },
            select: { id: true, name: true, slug: true },
          })
          .catch(() => null),
        prisma.universalEscrow
          .findUnique({
            where: { referenceId: `sim-${simulation.id}` },
            select: { referenceId: true, status: true, amount: true, currency: true, metadata: true },
          })
          .catch(() => null),
      ]);

      const creatorDisplayName =
        creatorBusiness?.name ||
        [creatorUser?.firstName, creatorUser?.lastName].filter(Boolean).join(' ') ||
        creatorUser?.email?.split('@')[0] ||
        'Verified Pabandi Provider';

      return res.json({
        success: true,
        data: {
          id: simulation.id,
          projectType: simulation.projectType,
          initialFactors: simulation.initialFactors,
          status: simulation.status,
          finalEstimate: simulation.finalEstimate,
          createdAt: simulation.createdAt,
          updatedAt: simulation.updatedAt,
          agentRuns: simulation.agentRuns,
          creator: {
            id: simulation.userId,
            name: creatorDisplayName,
            businessSlug: creatorBusiness?.slug ?? null,
          },
          escrow: escrow ?? null,
        },
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('[Simulator] public get error:', message);
      return res.status(500).json({ success: false, error: message });
    }
  },
);

router.post(
  '/public/:id/steer',
  async (req: Request, res: Response, _next: NextFunction) => {
    try {
      const { id } = req.params;
      const { factors } = SteerBodySchema.parse(req.body);

      const simulation = await prisma.projectSimulation.findUnique({
        where: { id },
      });

      if (!simulation) {
        return res.status(404).json({ success: false, error: 'Proposal not found' });
      }

      const prevEst =
        simulation.finalEstimate && typeof simulation.finalEstimate === 'object'
          ? (simulation.finalEstimate as Record<string, unknown>)
          : {};
      if (prevEst.escrowStatus === 'funded') {
        return res.status(409).json({
          success: false,
          error: 'This proposal has already been funded in escrow and its scope is locked.',
        });
      }

      await prisma.projectSimulation.update({
        where: { id },
        data: {
          initialFactors: factors as any,
          status: 'draft',
          finalEstimate: null as any,
        },
      });

      await prisma.simulationAgentRun.deleteMany({
        where: { simulationId: id },
      });

      runSwarm(id, factors).catch((err: any) => {
        logger.error(`[Simulator] public steer swarm failed for ${id}: ${err.message}`);
      });

      return res.json({
        success: true,
        data: {
          simulationId: id,
          status: 'draft',
        },
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('[Simulator] public steer error:', message);
      return res.status(400).json({ success: false, error: message });
    }
  },
);

router.post(
  '/public/:id/fund',
  async (req: Request, res: Response, _next: NextFunction) => {
    try {
      const { id } = req.params;
      const { rail, milestoneMode, clientName, clientEmail, origin } =
        PublicFundBodySchema.parse(req.body ?? {});

      const simulation = await prisma.projectSimulation.findUnique({
        where: { id },
      });

      if (!simulation) {
        return res.status(404).json({ success: false, error: 'Proposal not found' });
      }

      const est =
        simulation.finalEstimate && typeof simulation.finalEstimate === 'object'
          ? (simulation.finalEstimate as Record<string, any>)
          : null;
      const totalCost = Number(est?.totalCost || 0);
      if (simulation.status !== 'completed' || !Number.isFinite(totalCost) || totalCost <= 0) {
        return res.status(400).json({
          success: false,
          error: 'Wait for the AI Swarm estimate to finish before funding escrow.',
        });
      }

      const amountToFund =
        milestoneMode === 'deposit_50'
          ? Math.round(totalCost * 0.5 * 100) / 100
          : Math.round(totalCost * 100) / 100;

      const referenceId = `sim-${simulation.id}`;
      const currency = rail === 'solana' ? 'USDC' : rail === 'safepay' ? 'PKR' : 'USD';

      // Create or update draft UniversalEscrow
      const existingEscrow = await prisma.universalEscrow
        .findUnique({ where: { referenceId } })
        .catch(() => null);

      if (!existingEscrow) {
        await universalEscrowService
          .create({
            referenceId,
            template: 'milestone',
            parties: [
              { partyId: clientEmail || clientName || 'proposal-client', role: 'buyer' },
              { partyId: simulation.userId, role: 'seller' },
            ],
            amount: amountToFund,
            currency,
            conditions: [
              {
                type: 'milestone',
                verify: {
                  simulationId: simulation.id,
                  projectType: simulation.projectType,
                  milestoneMode,
                  rail,
                },
              },
            ],
            metadata: {
              simulationId: simulation.id,
              projectType: simulation.projectType,
              milestoneMode,
              totalCost,
              amountToFund,
              clientName: clientName || null,
              clientEmail: clientEmail || null,
              rail,
              breakdown: est?.breakdown ?? null,
            },
          })
          .catch((e) => logger.warn(`[Simulator] universalEscrow create warning: ${e.message}`));
      } else if (existingEscrow.status === 'draft') {
        await prisma.universalEscrow
          .update({
            where: { referenceId },
            data: {
              amount: amountToFund,
              currency,
              metadata: {
                ...(typeof existingEscrow.metadata === 'object' && existingEscrow.metadata
                  ? (existingEscrow.metadata as Record<string, unknown>)
                  : {}),
                milestoneMode,
                totalCost,
                amountToFund,
                clientName: clientName || null,
                clientEmail: clientEmail || null,
                rail,
              } as any,
            },
          })
          .catch(() => null);
      }

      const safeOrigin = (origin || process.env.FRONTEND_URL || 'https://pabandi.com').replace(
        /\/$/,
        '',
      );

      if (rail === 'square') {
        const cents = Math.round(amountToFund * 100);
        const sqIdempotencyKey = `sim-${simulation.id.slice(-18)}-${cents}-${Date.now().toString(36).slice(-4)}`;
        const checkout = await squareService.createCheckout({
          referenceId: sqIdempotencyKey,
          amount: cents,
          currency: 'USD',
          redirectUrl: `${safeOrigin}/p/estimate/${simulation.id}?funded=${referenceId}&rail=square&mode=${milestoneMode}`,
          cancelUrl: `${safeOrigin}/p/estimate/${simulation.id}`,
          note: `pabandi:universalescrow:${referenceId}`,
          label: `Pabandi Escrow — ${simulation.projectType} (${
            milestoneMode === 'deposit_50' ? '50% Milestone 1' : 'Full Project'
          })`,
          customerEmail: clientEmail || undefined,
        });

        return res.json({
          success: true,
          data: {
            rail: 'square',
            referenceId,
            amount: amountToFund,
            totalCost,
            milestoneMode,
            checkoutUrl: checkout.url,
          },
        });
      }

      if (rail === 'safepay') {
        const amountPkr = Math.round(amountToFund * 278);
        const safepayConfigured = Boolean(
          process.env.SAFEPAY_API_KEY && process.env.SAFEPAY_SECRET_KEY,
        );
        const checkoutUrl = await safepayService.createCheckoutUrl(amountPkr, referenceId);

        return res.json({
          success: true,
          data: {
            rail: 'safepay',
            referenceId,
            amount: amountToFund,
            amountPkr,
            totalCost,
            milestoneMode,
            checkoutUrl,
            safepayConfigured,
            raastIban: process.env.PABANDI_RAAST_IBAN || 'PK36MEZN0001010100492817',
          },
        });
      }

      // Solana Pay USDC URI
      const merchantWallet =
        process.env.SOLANA_MERCHANT_WALLET || 'PabandiEscrowVault1111111111111111111111111';
      const solanaPayUrl = `solana:${merchantWallet}?amount=${amountToFund.toFixed(
        2,
      )}&spl-token=EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v&label=${encodeURIComponent(
        `Pabandi Escrow (${simulation.projectType})`,
      )}&message=${encodeURIComponent(`Escrow ${referenceId} (${milestoneMode})`)}`;

      return res.json({
        success: true,
        data: {
          rail: 'solana',
          referenceId,
          amount: amountToFund,
          totalCost,
          milestoneMode,
          solanaPayUrl,
          merchantWallet,
        },
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('[Simulator] public fund error:', message);
      return res.status(400).json({ success: false, error: message });
    }
  },
);

router.post(
  '/public/:id/verify-solana',
  async (req: Request, res: Response, _next: NextFunction) => {
    try {
      const { id } = req.params;
      const { txSignature, milestoneMode, clientName, clientEmail } =
        PublicVerifySolanaSchema.parse(req.body ?? {});

      const simulation = await prisma.projectSimulation.findUnique({
        where: { id },
      });

      if (!simulation) {
        return res.status(404).json({ success: false, error: 'Proposal not found' });
      }

      const referenceId = `sim-${simulation.id}`;
      const prevEst =
        simulation.finalEstimate && typeof simulation.finalEstimate === 'object'
          ? (simulation.finalEstimate as Record<string, any>)
          : {};
      const totalCost = Number(prevEst.totalCost || 0);
      const fundedAmount =
        milestoneMode === 'deposit_50'
          ? Math.round(totalCost * 0.5 * 100) / 100
          : Math.round(totalCost * 100) / 100;

      // Ensure UniversalEscrow exists and transition to funded
      await universalEscrowService
        .create({
          referenceId,
          template: 'milestone',
          parties: [
            { partyId: clientEmail || clientName || 'solana-client', role: 'buyer' },
            { partyId: simulation.userId, role: 'seller' },
          ],
          amount: fundedAmount || 1,
          currency: 'USDC',
          conditions: [{ type: 'milestone', verify: { simulationId: simulation.id, txSignature } }],
          metadata: { simulationId: simulation.id, txSignature, milestoneMode },
        })
        .catch(() => null);

      await universalEscrowService.updateStatus(referenceId, 'funded').catch(() => null);

      const updatedEstimate = {
        ...prevEst,
        escrowStatus: 'funded',
        escrowReferenceId: referenceId,
        escrowRail: 'solana',
        milestoneMode,
        fundedAmount,
        solanaTxSignature: txSignature.trim(),
        fundedAt: new Date().toISOString(),
      };

      await prisma.projectSimulation.update({
        where: { id: simulation.id },
        data: { finalEstimate: updatedEstimate as any },
      });

      return res.json({
        success: true,
        data: {
          referenceId,
          escrowStatus: 'funded',
          txSignature: txSignature.trim(),
          finalEstimate: updatedEstimate,
        },
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('[Simulator] public verify-solana error:', message);
      return res.status(400).json({ success: false, error: message });
    }
  },
);

// ── GET /api/v1/simulator/:id ─────────────────────────────────────────────

router.get(
  '/:id',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const userId = req.user!.id;

      const simulation = await prisma.projectSimulation.findFirst({
        where: { id, userId },
        include: {
          agentRuns: {
            orderBy: { createdAt: 'asc' },
            select: {
              id: true,
              agentRole: true,
              inputPayload: true,
              outputPayload: true,
              status: true,
              executionTimeMs: true,
              createdAt: true,
            },
          },
        },
      });

      if (!simulation) {
        return res.status(404).json({ success: false, error: 'Simulation not found' });
      }

      return res.json({
        success: true,
        data: {
          id: simulation.id,
          projectType: simulation.projectType,
          initialFactors: simulation.initialFactors,
          status: simulation.status,
          finalEstimate: simulation.finalEstimate,
          createdAt: simulation.createdAt,
          updatedAt: simulation.updatedAt,
          agentRuns: simulation.agentRuns,
        },
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('[Simulator] get error:', message);
      return res.status(500).json({ success: false, error: message });
    }
  },
);

// ── POST /api/v1/simulator/:id/steer ──────────────────────────────────────

router.post(
  '/:id/steer',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { factors } = SteerBodySchema.parse(req.body);
      const userId = req.user!.id;

      const simulation = await prisma.projectSimulation.findFirst({
        where: { id, userId },
      });

      if (!simulation) {
        return res.status(404).json({ success: false, error: 'Simulation not found' });
      }

      // Update factors and reset status
      await prisma.projectSimulation.update({
        where: { id },
        data: {
          initialFactors: factors as any,
          status: 'draft',
          finalEstimate: null as any,
        },
      });

      // Delete old agent runs
      await prisma.simulationAgentRun.deleteMany({
        where: { simulationId: id },
      });

      // Re-trigger swarm in the background
      runSwarm(id, factors).catch((err: any) => {
        logger.error(`[Simulator] steer swarm failed for ${id}: ${err.message}`);
      });

      return res.json({
        success: true,
        data: {
          simulationId: id,
          status: 'draft',
        },
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('[Simulator] steer error:', message);
      return res.status(400).json({ success: false, error: message });
    }
  },
);

export default router;
