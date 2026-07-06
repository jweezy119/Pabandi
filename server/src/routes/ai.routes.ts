import { Router } from 'express';
import { handleConciergeQuery } from '../controllers/ai.controller';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

// Concierge endpoint
router.post('/concierge', authenticateToken, handleConciergeQuery);

export default router;
