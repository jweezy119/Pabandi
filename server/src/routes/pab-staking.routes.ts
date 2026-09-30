import { Router, Request, Response } from 'express';
import { z } from 'zod';
import { pabStakingService } from '../services/pab-staking.service';
import { pabReferralService } from '../services/pab-referral.service';
import { authenticate } from '../middleware/auth.middleware';
import { logger } from '../utils/logger';
import { apiLimiter } from '../middleware/rateLimit.middleware';

const router = Router();

const StakeSchema = z.object({
  amountPab: z.number().positive(),
  durationDays: z.number().min(30).max(365),
});

const UnstakeSchema = z.object({
  stakingRecordId: z.string(),
});

router.use(authenticate);

router.get('/position', async (req: any, res: Response) => {
  try {
    const userId = req.user.id;
    const position = await pabStakingService.getUserStaking(userId);

    return res.json({
      success: true,
      data: position,
    });
  } catch (error: any) {
    logger.error(`[PabStaking] get position error: ${error.message}`);
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/stake', apiLimiter, async (req: any, res: Response) => {
  try {
    const userId = req.user.id;
    const body = StakeSchema.parse(req.body);

    const position = await pabStakingService.stake(userId, body.amountPab, body.durationDays);

    return res.status(201).json({
      success: true,
      data: position,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: error.errors });
    }
    logger.error(`[PabStaking] stake error: ${error.message}`);
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/unstake', apiLimiter, async (req: any, res: Response) => {
  try {
    const userId = req.user.id;
    const body = UnstakeSchema.parse(req.body);

    const result = await pabStakingService.unstake(userId, body.stakingRecordId);

    return res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ success: false, error: error.errors });
    }
    logger.error(`[PabStaking] unstake error: ${error.message}`);
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/treasury', async (_req: Request, res: Response) => {
  try {
    const treasury = await pabStakingService.getTreasury();

    return res.json({
      success: true,
      data: treasury,
    });
  } catch (error: any) {
    logger.error(`[PabStaking] treasury error: ${error.message}`);
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/referral', apiLimiter, async (req: any, res: Response) => {
  try {
    const userId = req.user.id;
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, error: 'email is required' });
    }

    const referral = await pabReferralService.createReferral(userId, email);

    return res.status(201).json({
      success: true,
      data: referral,
    });
  } catch (error: any) {
    logger.error(`[PabReferral] create error: ${error.message}`);
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/referrals', async (req: any, res: Response) => {
  try {
    const userId = req.user.id;
    const [referrals, stats] = await Promise.all([
      pabReferralService.getReferrals(userId),
      pabReferralService.getReferralStats(userId),
    ]);

    return res.json({
      success: true,
      data: { referrals, stats },
    });
  } catch (error: any) {
    logger.error(`[PabReferral] list error: ${error.message}`);
    return res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/referrals/:referralId/claim', apiLimiter, async (req: any, res: Response) => {
  try {
    const { referralId } = req.params;
    const result = await pabReferralService.claimVested(referralId);

    return res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    logger.error(`[PabReferral] claim error: ${error.message}`);
    return res.status(400).json({ success: false, error: error.message });
  }
});

export default router;
