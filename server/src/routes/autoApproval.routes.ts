import { Router } from 'express';
import {
  getAutoApprovalStatus,
  getPlatformBalance,
  autoTransfer,
  generateNewWallet,
  getTransferHistory,
} from '../controllers/autoApproval.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

router.get('/status', authenticate, getAutoApprovalStatus);
router.get('/balance', authenticate, getPlatformBalance);
router.post('/transfer', authenticate, autoTransfer);
router.post('/generate-wallet', authenticate, generateNewWallet);
router.get('/history', authenticate, getTransferHistory);

export default router;
