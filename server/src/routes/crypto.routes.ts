import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import {
  getMyWallet,
  getBusinessRewards,
  getRewardRules,
  connectSolanaWallet,
  requestSolanaTransfer,
} from '../controllers/crypto.controller';

const router = Router();

router.get('/reward-rules', getRewardRules);
router.get('/wallet', authenticate, getMyWallet);
router.get('/rewards/business', authenticate, getBusinessRewards);
router.put('/wallet/solana', authenticate, connectSolanaWallet);
router.post('/wallet/solana/transfer', authenticate, requestSolanaTransfer);

export default router;
