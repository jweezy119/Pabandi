import { Router } from 'express';
import { getGuidelines, getHistory } from '../controllers/reliability.controller';
import { authenticate as requireAuth } from '../middleware/auth.middleware';

const router = Router();

// Publicly accessible guidelines
router.get('/guidelines', getGuidelines);

// Authenticated history
router.get('/history', requireAuth, getHistory);

export default router;
