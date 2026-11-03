import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { ingestData, getJobProgress, listAdapters, getAdapter, onJobEvent } from '../services/ingestion/pipeline.service';
import { companyIntel } from '../services/company-intel.service';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';

const router = Router();

// All ingestion routes require auth + ADMIN role
router.use(authenticate);
router.use((req: any, res: Response, next) => {
  if (req.user?.role !== 'ADMIN') {
    return res.status(403).json({ success: false, message: 'Admin access required' });
  }
  next();
});

// ── POST /api/v1/admin/ingest ────────────────────────────────────────────
// Body: { source: 'opendirectories' | 'apify' | 'googlemaps', ...source-specific fields }
// Triggers background ingestion and returns a jobId.
router.post('/ingest', async (req: Request, res: Response) => {
  try {
    const { source, country, state, category, limit, query, geo, radius } = req.body;

    if (!source || !['opendirectories', 'apify', 'googlemaps'].includes(source)) {
      return res.status(400).json({
        success: false,
        error: "Invalid or missing 'source'. Must be 'opendirectories', 'apify', or 'googlemaps'.",
      });
    }

    const adapter = getAdapter(source);
    if (!adapter) {
      return res.status(400).json({ success: false, error: `Adapter '${source}' not available` });
    }

    const { jobId } = await ingestData(source, { query, country, state, category, limit, geo, radius });

    logger.info(`[Admin] Ingestion job started: ${jobId} (source=${source})`);

    return res.json({
      success: true,
      data: { jobId, source, status: 'running' },
    });
  } catch (error: any) {
    logger.error(`[Admin] Ingestion start failed: ${error.message}`);
    return res.status(500).json({ success: false, error: error.message || 'Ingestion failed to start' });
  }
});

// ── POST /api/v1/admin/ingest/google-maps ────────────────────────────────
// Body: { queryId?: string, query?: string, category?, geo?, radius?, limit? }
// If queryId is provided, looks up the saved GoogleMapsQuery config.
// Triggers background ingestion and returns a jobId.
router.post('/ingest/google-maps', async (req: Request, res: Response) => {
  try {
    const { queryId, query: searchQuery, category, geo, radius, limit } = req.body;

    let finalQuery = searchQuery;
    let finalCategory = category;
    let finalGeo = geo;
    let finalRadius = radius;

    // If queryId provided, look up saved config
    if (queryId) {
      const saved = await prisma.googleMapsQuery.findUnique({ where: { id: queryId } });
      if (!saved) {
        return res.status(404).json({ success: false, error: 'Google Maps query not found' });
      }
      if (!saved.active) {
        return res.status(400).json({ success: false, error: 'Google Maps query is inactive' });
      }
      finalQuery = saved.query;
      finalCategory = saved.category;
      finalGeo = saved.geo;
      finalRadius = saved.radius;
    }

    if (!finalQuery) {
      return res.status(400).json({ success: false, error: 'query is required' });
    }

    const { jobId } = await ingestData('googlemaps', {
      query: finalQuery,
      category: finalCategory,
      geo: finalGeo,
      radius: finalRadius,
      limit,
    });

    // Update lastRun on saved query
    if (queryId) {
      await prisma.googleMapsQuery.update({
        where: { id: queryId },
        data: { lastRun: new Date() },
      });
    }

    logger.info(`[Admin] Google Maps ingestion job started: ${jobId} (query=${finalQuery})`);

    return res.json({
      success: true,
      data: { jobId, source: 'googlemaps', query: finalQuery, status: 'running' },
    });
  } catch (error: any) {
    logger.error(`[Admin] Google Maps ingestion start failed: ${error.message}`);
    return res.status(500).json({ success: false, error: error.message || 'Google Maps ingestion failed to start' });
  }
});

// ── GET /api/v1/admin/ingest/status/:jobId ───────────────────────────────
router.get('/ingest/status/:jobId', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;
    const job = getJobProgress(jobId);

    if (!job) {
      return res.status(404).json({ success: false, error: 'Job not found' });
    }

    return res.json({
      success: true,
      data: {
        jobId: job.jobId,
        source: job.adapterId,
        status: job.status,
        processed: job.totalUpserted,
        total: job.totalFetched,
        errors: job.totalErrors,
        currentBusiness: job.currentBusiness,
        error: job.error,
        startedAt: job.startedAt,
        completedAt: job.completedAt,
      },
    });
  } catch (error: any) {
    logger.error(`[Admin] Ingestion status failed: ${error.message}`);
    return res.status(500).json({ success: false, error: error.message || 'Status check failed' });
  }
});

// ── SSE: GET /api/v1/admin/ingest/stream/:jobId ──────────────────────────
// Server-sent events for real-time progress updates.
router.get('/ingest/stream/:jobId', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    });

    const send = (data: any) => {
      res.write(`data: ${JSON.stringify(data)}\n\n`);
    };

    // Send current state immediately
    const job = getJobProgress(jobId);
    if (job) {
      send(job);
    }

    // Subscribe to updates
    const unsubscribe = onJobEvent((updatedJob) => {
      if (updatedJob.jobId === jobId) {
        send(updatedJob);
      }
    });

    // Cleanup on client disconnect
    req.on('close', () => {
      unsubscribe();
      res.end();
    });

    req.on('error', () => {
      unsubscribe();
      res.end();
    });
  } catch (error: any) {
    logger.error(`[Admin] Ingestion stream failed: ${error.message}`);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: error.message || 'Stream failed' });
    }
  }
});

// ── POST /api/v1/admin/ingest/company-intel ──────────────────────────────
router.post('/company-intel', async (req: Request, res: Response) => {
  try {
    const { domain } = req.body;
    if (!domain || typeof domain !== 'string') {
      return res.status(400).json({ success: false, error: 'domain is required' });
    }

    const result = await companyIntel.enrichCompany(domain);

    // Also run legal verification if we have a company name hint from the domain
    let legal = undefined;
    try {
      const legalResult = await companyIntel.verifyLegalEntity(domain.replace(/\..*$/, ''));
      legal = {
        verified: legalResult.verified,
        source: legalResult.source,
        lei: legalResult.lei,
        legalName: legalResult.legalName,
        jurisdiction: legalResult.jurisdiction,
        companyNumber: legalResult.companyNumber,
      };
    } catch {
      // legal verification is best-effort
    }

    return res.json({
      success: true,
      data: { ...result, legal },
    });
  } catch (error: any) {
    logger.error(`[Admin] Company intel failed: ${error.message}`);
    return res.status(500).json({ success: false, error: error.message || 'Company intel failed' });
  }
});

// ── GET /api/v1/admin/ingest/google-maps/queries ─────────────────────────
// List all saved Google Maps queries.
router.get('/ingest/google-maps/queries', async (_req: Request, res: Response) => {
  try {
    const queries = await prisma.googleMapsQuery.findMany({
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        name: true,
        query: true,
        category: true,
        geo: true,
        radius: true,
        active: true,
        lastRun: true,
        totalFound: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return res.json({ success: true, data: queries });
  } catch (error: any) {
    logger.error(`[Admin] List Google Maps queries failed: ${error.message}`);
    return res.status(500).json({ success: false, error: error.message || 'Failed to list queries' });
  }
});

// ── POST /api/v1/admin/ingest/google-maps/queries ────────────────────────
// Create a new saved Google Maps query.
router.post('/ingest/google-maps/queries', async (req: Request, res: Response) => {
  try {
    const { name, query, category, geo, radius, active, userId } = req.body;

    if (!query) {
      return res.status(400).json({ success: false, error: 'query is required' });
    }

    const created = await prisma.googleMapsQuery.create({
      data: {
        name: name || query,
        query,
        category,
        geo,
        radius,
        active: active !== undefined ? active : true,
        userId: userId || '',
      },
    });

    return res.json({ success: true, data: created });
  } catch (error: any) {
    logger.error(`[Admin] Create Google Maps query failed: ${error.message}`);
    return res.status(500).json({ success: false, error: error.message || 'Failed to create query' });
  }
});

// ── PATCH /api/v1/admin/ingest/google-maps/queries/:id ───────────────────
// Update a saved Google Maps query.
router.patch('/ingest/google-maps/queries/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, query, category, geo, radius, active } = req.body;

    const updated = await prisma.googleMapsQuery.update({
      where: { id },
      data: {
        ...(name !== undefined ? { name } : {}),
        ...(query !== undefined ? { query } : {}),
        ...(category !== undefined ? { category } : {}),
        ...(geo !== undefined ? { geo } : {}),
        ...(radius !== undefined ? { radius } : {}),
        ...(active !== undefined ? { active } : {}),
      },
    });

    return res.json({ success: true, data: updated });
  } catch (error: any) {
    logger.error(`[Admin] Update Google Maps query failed: ${error.message}`);
    return res.status(500).json({ success: false, error: error.message || 'Failed to update query' });
  }
});

// ── DELETE /api/v1/admin/ingest/google-maps/queries/:id ──────────────────
router.delete('/ingest/google-maps/queries/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    await prisma.googleMapsQuery.delete({ where: { id } });

    return res.json({ success: true });
  } catch (error: any) {
    logger.error(`[Admin] Delete Google Maps query failed: ${error.message}`);
    return res.status(500).json({ success: false, error: error.message || 'Failed to delete query' });
  }
});

// ── GET /api/v1/businesses/recent ────────────────────────────────────────
// Public: last 10 businesses added to the network.
router.get('/businesses/recent', async (_req: Request, res: Response) => {
  try {
    const businesses = await prisma.business.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        address: true,
        city: true,
        state: true,
        country: true,
        source: true,
        isVerified: true,
        trustScore: true,
        createdAt: true,
      },
    });

    return res.json({
      success: true,
      data: businesses,
    });
  } catch (error: any) {
    logger.error(`[Admin] Recent businesses failed: ${error.message}`);
    return res.status(500).json({ success: false, error: error.message || 'Failed to fetch recent businesses' });
  }
});

export default router;
