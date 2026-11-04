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
import { z } from 'zod';

const router = Router();

const StartBodySchema = z.object({
  projectType: z.string().min(1),
  factors: z.record(z.string(), z.unknown()),
});

const SteerBodySchema = z.object({
  factors: z.record(z.string(), z.unknown()),
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
