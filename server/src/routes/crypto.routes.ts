import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../middleware/auth.middleware';
import {
  getMyWallet,
  getBusinessRewards,
  getRewardRules,
  connectSolanaWallet,
  requestSolanaTransfer,
  mintBadge,
  getContractAddresses,
  stakeTokens,
  unstakeTokens,
} from '../controllers/crypto.controller';

const router = Router();

// ── Public ───────────────────────────────────────────────────────────────────
router.get('/reward-rules', getRewardRules);
router.get('/contracts', getContractAddresses);   // deployed contract addresses for client

// ── Authenticated ─────────────────────────────────────────────────────────────
router.get('/wallet',           authenticate, getMyWallet);
router.get('/rewards/business', authenticate, getBusinessRewards);

const withdrawalLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour window
  max: 5, // limit each IP to 5 withdrawal requests per windowMs
  message: { success: false, error: 'Too many withdrawal attempts. Please try again after an hour to comply with security policies.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.put('/wallet/solana',    authenticate, connectSolanaWallet);
router.post('/wallet/solana/transfer', authenticate, withdrawalLimiter, requestSolanaTransfer);

// ── Staking ───────────────────────────────────────────────────────────────────
router.post('/wallet/stake', authenticate, stakeTokens);
router.post('/wallet/unstake', authenticate, unstakeTokens);

// ── NFT Badges ────────────────────────────────────────────────────────────────
// POST /api/v1/crypto/mint-badge — mint soulbound NFT for the user's connected wallet
router.post('/mint-badge', authenticate, mintBadge);

export default router;
