import { Router } from 'express';
import { getSummary, createTribute } from '../controllers/treasury.controller';
import { authenticate } from '../middleware/auth.middleware';
import { authorize } from '../middleware/auth.middleware';

const router = Router();

router.get('/summary', authenticate, authorize('ADMIN'), getSummary);
router.post('/tribute', authenticate, authorize('ADMIN'), createTribute);

export default router;
