import { Router } from 'express';
import {
  fundWallet,
  getBreakdown,
  recycleProfits,
  getWalletAddress,
  allocateToReserve,
} from '../controllers/singleWalletTreasury.controller';
import { authenticate, authorize } from '../middleware/auth.middleware';

const router = Router();

/**
 * Why these four writes are admin-only.
 *
 * Each one writes a `treasuryPosition` row with a caller-supplied `amountUsd`,
 * and each writes it as `status: CONFIRMED` — the status
 * `getBucketBalance` sums when reporting real operating cash. So any
 * authenticated user could POST /fund with any number and the reported
 * treasury balance would move by that number, with no transfer of funds and
 * nothing to reconcile against. /reserve and /recycle move value between
 * buckets, so they could also manufacture an operating balance out of reserve
 * and back.
 *
 * A wallet deposit in the real world is proved by an on-chain transaction. These
 * endpoints record a declaration. Until that proof is verified here, only an
 * admin may make one.
 */
router.get('/address', authenticate, getWalletAddress);
router.post('/fund', authenticate, authorize('ADMIN'), fundWallet);
router.get('/breakdown', authenticate, authorize('ADMIN'), getBreakdown);
router.post('/recycle', authenticate, authorize('ADMIN'), recycleProfits);
router.post('/reserve', authenticate, authorize('ADMIN'), allocateToReserve);

export default router;
