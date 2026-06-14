import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import {
  getMyWallet,
  getBusinessRewards,
  getRewardRules,
  connectSolanaWallet,
  requestSolanaTransfer,
  mintBadge,
  getContractAddresses,
} from '../controllers/crypto.controller';

const router = Router();

// ── Public ───────────────────────────────────────────────────────────────────
router.get('/reward-rules', getRewardRules);
router.get('/contracts', getContractAddresses);   // deployed contract addresses for client

// ── Authenticated ─────────────────────────────────────────────────────────────
router.get('/wallet',           authenticate, getMyWallet);
router.get('/rewards/business', authenticate, getBusinessRewards);
router.put('/wallet/solana',    authenticate, connectSolanaWallet);
router.post('/wallet/solana/transfer', authenticate, requestSolanaTransfer);

// ── NFT Badges ────────────────────────────────────────────────────────────────
// POST /api/v1/crypto/mint-badge — mint soulbound NFT for the user's connected wallet
router.post('/mint-badge', authenticate, mintBadge);

export default router;
