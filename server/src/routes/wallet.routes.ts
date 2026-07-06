import { Router } from 'express';
import { getBalances, exportSecret } from '../controllers/wallet.controller';
import { authenticate as requireAuth } from '../middleware/auth.middleware';

const router = Router();

router.use(requireAuth);

router.get('/balances', getBalances);
router.post('/export-secret', exportSecret);

export default router;
