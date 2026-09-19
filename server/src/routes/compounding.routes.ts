import { Router } from 'express';
import { getCompoundReport, addCapital, getSettings } from '../controllers/compounding.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.get('/report', authenticate, getCompoundReport);
router.get('/settings', authenticate, getSettings);
router.post('/add-capital', authenticate, addCapital);

export default router;
