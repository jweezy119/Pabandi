import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import {
  getRecommendations,
  getRecommendedInvestors,
  upsertProfile,
  getProfile,
  getInsights,
  recordFeedback,
  getStats,
  batchGenerateMatches,
} from '../controllers/mudarabahMatcher.controller';

const router = Router();

// ── All routes require authentication ─────────────────────────────────
router.get('/recommendations', authenticate, getRecommendations);
router.get('/investors/:poolId', authenticate, getRecommendedInvestors);
router.post('/profile', authenticate, upsertProfile);
router.get('/profile', authenticate, getProfile);
router.get('/insights', authenticate, getInsights);
router.post('/feedback', authenticate, recordFeedback);
router.get('/stats', authenticate, getStats);

// ── Batch match generation (called by cron or admin) ──────────────────
router.post('/batch-generate', authenticate, batchGenerateMatches);

export default router;
