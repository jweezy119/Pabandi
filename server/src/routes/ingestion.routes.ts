import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { ingestData, getJobProgress, listAdapters, getAdapter, onJobEvent } from '../services/ingestion/pipeline.service';
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
// Body: { source: 'opendirectories' | 'apify', country?, state?, category?, limit? }
// Triggers background ingestion and returns a jobId.
router.post('/ingest', async (req: Request, res: Response) => {
  try {
    const { source, country, state, category, limit } = req.body;

    if (!source || !['opendirectories', 'apify'].includes(source)) {
      return res.status(400).json({
        success: false,
        error: "Invalid or missing 'source'. Must be 'opendirectories' or 'apify'.",
      });
    }

    const adapter = getAdapter(source);
    if (!adapter) {
      return res.status(400).json({ success: false, error: `Adapter '${source}' not available` });
    }

    const { jobId } = await ingestData(source, { country, state, category, limit });

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
