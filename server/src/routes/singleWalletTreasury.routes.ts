import { Router } from 'express';
import {
  fundWallet,
  getBreakdown,
  recycleProfits,
  getWalletAddress,
  allocateToReserve,
} from '../controllers/singleWalletTreasury.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.get('/address', authenticate, getWalletAddress);
router.post('/fund', authenticate, fundWallet);
router.get('/breakdown', authenticate, getBreakdown);
router.post('/recycle', authenticate, recycleProfits);
router.post('/reserve', authenticate, allocateToReserve);

export default router;
