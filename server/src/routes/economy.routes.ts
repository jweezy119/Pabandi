import { Router } from 'express';
import { autonomousEconomyService } from '../services/autonomousEconomy.service';

const router = Router();

// Net platform SOL revenue (profitability report)
router.get('/net-revenue', async (_req, res) => {
  try {
    const r = await autonomousEconomyService.netSolRevenue();
    res.json({ success: true, data: r });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Quote a human SOL rake (no on-chain action)
router.post('/quote-rake', async (req, res) => {
  try {
    const { payer, solAmount } = req.body || {};
    if (!payer || !solAmount) return res.status(400).json({ success: false, error: 'payer + solAmount required' });
    const q = await autonomousEconomyService.quoteRake(payer, Number(solAmount));
    res.json({ success: true, data: q });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Charge a human SOL rake — returns a base64 tx for the payer to sign + broadcast
router.post('/charge-rake', async (req, res) => {
  try {
    const { payer, solAmount } = req.body || {};
    if (!payer || !solAmount) return res.status(400).json({ success: false, error: 'payer + solAmount required' });
    const r = await autonomousEconomyService.chargeRake(payer, Number(solAmount));
    res.json({ success: true, data: r });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Autonomous reinvestment gate (JitoSOL stake when balance justifies)
router.post('/reinvest', async (_req, res) => {
  try {
    const r = await autonomousEconomyService.autonomousReinvest();
    res.json({ success: true, data: r });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
