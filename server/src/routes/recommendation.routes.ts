import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { recommendationEngine } from '../services/recommendation.service';

const router = Router();

// Property recommendations
router.get('/properties', authenticate, async (req, res) => {
  try {
    const properties = [
      { id: '1', name: 'Downtown Loft', monthlyRent: 1500, minTrustScore: 0 },
      { id: '2', name: 'Suburban House', monthlyRent: 2200, minTrustScore: 200 },
      { id: '3', name: 'Luxury Penthouse', monthlyRent: 5000, minTrustScore: 500 },
    ];
    const result = await recommendationEngine.recommendProperties(req.user!.id, properties);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Trust tier recommendation
router.get('/trust-tier', authenticate, async (req, res) => {
  try {
    const result = await recommendationEngine.recommendTrustTier(req.user!.id);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Payment method recommendation
router.post('/payment-method', authenticate, async (req, res) => {
  try {
    const { amount } = req.body;
    const result = await recommendationEngine.recommendPaymentMethod(req.user!.id, amount);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// Next feature recommendation (for onboarding)
router.get('/next-feature', authenticate, async (req, res) => {
  try {
    const result = await recommendationEngine.recommendNextFeature(req.user!.id);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
