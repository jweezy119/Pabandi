import { Router } from 'express';
import { bestFitEngineService } from '../services/ai/bestFitEngine.service';
import { logger } from '../utils/logger';

const router = Router();

/**
 * POST /api/v1/best-fit/search
 * Finds the best fit gig workers for a specific shift.
 */
router.post('/search', async (req, res) => {
  try {
    const { scheduledDate, skills, limit, weights } = req.body;

    if (!scheduledDate) {
      return res.status(400).json({ error: 'scheduledDate is required' });
    }

    const matches = await bestFitEngineService.predictBestFit({
      scheduledDate: new Date(scheduledDate),
      skills: skills || [],
      limit: limit || 10,
      weights,
    });

    return res.json({
      success: true,
      matches,
    });
  } catch (error: any) {
    logger.error(`[BestFitRoutes] Search error: ${error.message}`);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
