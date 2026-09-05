import { Router, Request, Response } from 'express';
import { nightlifeTokenomicsService } from '../services/nightlifeTokenomics.service';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();

// ═══════════════════════════════════════════════════════════════════════════
// NIGHTLIFE TOKENOMICS ROUTES
// ═══════════════════════════════════════════════════════════════════════════

// Reward guest attendance
router.post('/reward-attendance', authenticate, async (req: any, res: Response) => {
  try {
    const { guestListId } = req.body;
    const result = await nightlifeTokenomicsService.rewardGuestAttendance(guestListId);
    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to reward attendance' });
  }
});

// Reward guest review
router.post('/reward-review', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const { reviewId, isFirstReview } = req.body;
    const result = await nightlifeTokenomicsService.rewardGuestReview(userId, reviewId, isFirstReview);
    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to reward review' });
  }
});

// Reward referral
router.post('/reward-referral', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const { referredUserId } = req.body;
    const result = await nightlifeTokenomicsService.rewardGuestReferral(userId, referredUserId);
    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to reward referral' });
  }
});

// Reward bottle purchase
router.post('/reward-bottle', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const { amount, bottleReservationId } = req.body;
    const result = await nightlifeTokenomicsService.rewardBottlePurchase(userId, amount, bottleReservationId);
    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to reward bottle purchase' });
  }
});

// Stake promoter tier
router.post('/stake-promoter', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const { tier } = req.body;
    const result = await nightlifeTokenomicsService.stakePromoterTier(userId, tier);
    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Failed to stake tier' });
  }
});

// Unstake promoter tier
router.post('/unstake-promoter', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const result = await nightlifeTokenomicsService.unstakePromoterTier(userId);
    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to unstake tier' });
  }
});

// Pay venue subscription
router.post('/pay-venue', authenticate, async (req: any, res: Response) => {
  try {
    const { venueId, amountUsd } = req.body;
    const result = await nightlifeTokenomicsService.payVenueSubscription(venueId, amountUsd);
    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to pay venue subscription' });
  }
});

// Deposit guest list spot
router.post('/deposit-guestlist', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const { guestListId, amountPab } = req.body;
    const result = await nightlifeTokenomicsService.depositGuestListSpot(userId, guestListId, amountPab);
    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to deposit guest list spot' });
  }
});

// Return guest list deposit
router.post('/return-deposit', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const { guestListId, showUp } = req.body;
    const result = await nightlifeTokenomicsService.returnGuestListDeposit(userId, guestListId, showUp);
    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to return deposit' });
  }
});

// Get tokenomics stats
router.get('/stats', authenticate, async (req: any, res: Response) => {
  try {
    const { period } = req.query;
    const stats = await nightlifeTokenomicsService.getTokenomicsStats(period as any || 'week');
    res.json({ success: true, data: stats });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// Get user nightlife balance
router.get('/balance', authenticate, async (req: any, res: Response) => {
  try {
    const userId = req.user?.id;
    const balance = await nightlifeTokenomicsService.getUserNightlifeBalance(userId);
    res.json({ success: true, data: balance });
  } catch (e: any) {
    res.status(500).json({ error: 'Failed to get balance' });
  }
});

export default router;
