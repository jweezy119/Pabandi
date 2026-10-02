import { Router } from 'express';
import { authenticate, type AuthRequest } from '../middleware/auth.middleware';
import { resolveCrmBusiness, requireCrmContext } from '../middleware/crmContext.middleware';
import { CustomError } from '../middleware/errorHandler';
import { prisma } from '../utils/database';
import { moduleRegistry } from '../modules';
import type { ModuleId } from '../modules';
import {
  buildPulse,
  moduleHealth,
  parseRange,
  resolveInstalledModules,
  setModuleEnabled,
} from '../modules/businessGraph.service';

const router = Router();

router.use(authenticate);
router.use(resolveCrmBusiness);

/**
 * Business OS — the unified surface over the platform's layers.
 *
 * Everything here is scoped through `resolveCrmBusiness`, so a caller only ever
 * sees their own business and never has to pass an id that could point at
 * someone else's.
 */

// ── Module catalogue ──────────────────────────────────────────────────────────

/**
 * GET /api/v1/business-os/modules
 * Every module the platform knows about, with the caller's install state.
 */
router.get('/modules', async (req: AuthRequest, res) => {
  try {
    const { serviceBusinessId } = requireCrmContext(req);
    const installed = new Set(await resolveInstalledModules(serviceBusinessId));

    res.json({
      success: true,
      data: {
        modules: moduleRegistry.catalogue().map((m) => ({
          ...m,
          installed: installed.has(m.id),
          // A module whose prerequisites are missing is reported as not
          // installed, so the UI never shows a tile that cannot function.
          satisfiable: m.requires.every((r) => installed.has(r)),
          requiresInstalled: m.requires.filter((r) => installed.has(r)),
        })),
      },
    });
  } catch (err) {
    next_(err, res);
  }
});

// ── Pulse ─────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/business-os/pulse?range=30d
 * The merged cross-layer read: totals, trust posture, and one timeline.
 */
router.get('/pulse', async (req: AuthRequest, res) => {
  try {
    const { businessId, serviceBusinessId } = requireCrmContext(req);
    if (!businessId) {
      throw new CustomError(
        'Business is not linked to a platform business yet — re-enroll to enable cross-layer reporting',
        400
      );
    }

    const range = parseRange({
      range: req.query.range as string,
      from: req.query.from as string,
      to: req.query.to as string,
    });

    const pulse = await buildPulse(businessId, serviceBusinessId, range);
    res.json({ success: true, data: pulse });
  } catch (err) {
    next_(err, res);
  }
});

/**
 * GET /api/v1/business-os/timeline?range=30d&limit=100
 * Just the merged timeline, for clients that page through it.
 */
router.get('/timeline', async (req: AuthRequest, res) => {
  try {
    const { businessId, serviceBusinessId } = requireCrmContext(req);
    if (!businessId) {
      throw new CustomError('Business is not linked to a platform business yet', 400);
    }

    const range = parseRange({ range: req.query.range as string });
    const limit = Math.min(Number(req.query.limit) || 100, 200);
    const pulse = await buildPulse(businessId, serviceBusinessId, range);

    res.json({ success: true, data: pulse.timeline.slice(0, limit) });
  } catch (err) {
    next_(err, res);
  }
});

// ── Per-module reads ──────────────────────────────────────────────────────────

/**
 * GET /api/v1/business-os/modules/:moduleKey/facts?range=30d
 * One module's contribution on its own, for a module detail panel.
 */
router.get('/modules/:moduleKey/facts', async (req: AuthRequest, res) => {
  try {
    const { businessId, serviceBusinessId } = requireCrmContext(req);
    if (!businessId) {
      throw new CustomError('Business is not linked to a platform business yet', 400);
    }

    const key = req.params.moduleKey;
    const module = moduleRegistry.all().find((m) => m.key === key);
    if (!module) {
      throw new CustomError(`Unknown module: ${key}`, 404);
    }

    const installed = await resolveInstalledModules(serviceBusinessId);
    if (!installed.includes(module.id)) {
      // Distinguishing "not installed" from "installed but empty" is the whole
      // point of the result union — the UI renders a different affordance.
      return res.json({
        success: true,
        data: { status: 'unavailable', reason: `${module.label} is not installed` },
      });
    }

    const range = parseRange({ range: req.query.range as string });
    const result = await module.facts({ businessId, serviceBusinessId, range });
    res.json({ success: true, data: result });
  } catch (err) {
    next_(err, res);
  }
});

/**
 * POST /api/v1/business-os/modules/:moduleKey/install
 * POST /api/v1/business-os/modules/:moduleKey/uninstall
 *
 * Toggling a module is a business decision about which layers it operates, so it
 * is owner-scoped by the same middleware as everything else.
 */
router.post('/modules/:moduleKey/:action', async (req: AuthRequest, res) => {
  try {
    const { serviceBusinessId } = requireCrmContext(req);
    const { moduleKey, action } = req.params;

    if (action !== 'install' && action !== 'uninstall') {
      throw new CustomError('Action must be install or uninstall', 400);
    }

    const module = moduleRegistry.all().find((m) => m.key === moduleKey);
    if (!module) {
      throw new CustomError(`Unknown module: ${moduleKey}`, 404);
    }

    const installed = await setModuleEnabled(
      serviceBusinessId,
      module.id as ModuleId,
      action === 'install'
    );

    res.json({
      success: true,
      data: { moduleId: module.id, action, installed },
    });
  } catch (err) {
    next_(err, res);
  }
});

// ── Health ────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/business-os/health
 * Per-module reachability. Mounted under `authenticate` because a module's
 * latency profile is operational detail a tenant should not be able to read.
 */
router.get('/health', async (_req: AuthRequest, res) => {
  try {
    const health = await moduleHealth();
    res.json({
      success: true,
      data: {
        modules: health,
        degraded: health.filter((h) => !h.ok).map((h) => h.key),
      },
    });
  } catch (err) {
    next_(err, res);
  }
});

// ── Local error handler ───────────────────────────────────────────────────────
// Registered after the routes so a thrown CustomError becomes the platform's
// canonical `{ success: false, message }` shape instead of a bare 500.
function next_(err: unknown, res: import('express').Response) {
  const statusCode = err instanceof CustomError ? err.statusCode : 500;
  const message = err instanceof Error ? err.message : 'Internal error';
  res.status(statusCode).json({ success: false, message });
}

export default router;