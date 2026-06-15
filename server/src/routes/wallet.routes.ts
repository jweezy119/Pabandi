import { Router } from 'express';
import { getBalances } from '../controllers/wallet.controller';
import { authenticate as requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.use(requireAuth);

router.get('/balances', getBalances);

export default router;
