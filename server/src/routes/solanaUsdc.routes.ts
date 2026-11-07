import { Router } from 'express';
import {
  getPlatformBalance,
  buildTransfer,
  recordTransfer,
  createAgentWallet,
  getAgentBalance,
  getTransfers,
  getAgentWallets,
} from '../controllers/solanaUsdc.controller';
import { authenticate, optionalAuthenticate } from '../middleware/auth.middleware';

const router = Router();

router.get('/platform-balance', authenticate, getPlatformBalance);
router.get('/transfers', authenticate, getTransfers);
router.get('/agent-wallets', authenticate, getAgentWallets);
router.post('/transfer/build', optionalAuthenticate, buildTransfer);
router.post('/transfer/record', optionalAuthenticate, recordTransfer);
router.post('/agents/:agentId/wallet', authenticate, createAgentWallet);
router.get('/agents/:agentId/balance', authenticate, getAgentBalance);

export default router;
