import { Router } from 'express';
import { getEconomyStats } from '../services/economy.service';

const router = Router();

// Public: real-time $PAB circulation (burn, accrual, fees) for the Economy dashboard.
router.get('/stats', async (_req: any, res: any) => {
  try {
    const stats = await getEconomyStats();
    res.json({ success: true, data: stats });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err?.message || 'Failed to load economy stats' });
  }
});

export default router;
