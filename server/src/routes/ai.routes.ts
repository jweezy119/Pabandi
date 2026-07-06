import { Router } from 'express';
import { handleConciergeQuery } from '../controllers/ai.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// Concierge endpoint
router.post('/concierge', authenticate, handleConciergeQuery);

export default router;
