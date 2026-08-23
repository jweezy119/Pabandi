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
    const { payer, solAmount, bookingRef } = req.body || {};
    if (!payer || !solAmount) return res.status(400).json({ success: false, error: 'payer + solAmount required' });
    const r = await autonomousEconomyService.chargeRake(payer, Number(solAmount), bookingRef);
    res.json({ success: true, data: r });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── SOL checkout (wires the human rake into the real product flow) ──
// A human booking an agent pays in SOL; 1% skims to the fee wallet, rest settles.
// Returns a partial-signed tx for the payer to broadcast. chargeRake already persists a
// PENDING_CHARGE so confirm-rake can close the booking on broadcast.
router.post('/sol-checkout', async (req, res) => {
  try {
    const { payer, solAmount, bookingRef, agentId, note } = req.body || {};
    if (!payer || !solAmount) return res.status(400).json({ success: false, error: 'payer + solAmount required' });
    const r = await autonomousEconomyService.chargeRake(payer, Number(solAmount), bookingRef);
    res.json({ success: true, data: { ...r, feeWallet: process.env.FEE_TREASURY_WALLET, agentId: agentId || null, note: note || 'SOL checkout' } });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── Yield router (option Y): route USER external SOL → JitoSOL, platform skims entry fee ──
// Quote a yield route (no on-chain action)
router.post('/quote-yield', async (req, res) => {
  try {
    const { user, solAmount } = req.body || {};
    if (!user || !solAmount) return res.status(400).json({ success: false, error: 'user + solAmount required' });
    const q = await autonomousEconomyService.quoteYield(user, Number(solAmount));
    res.json({ success: true, data: q });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Route a user's SOL into JitoSOL — returns a base64 tx for the user to sign + broadcast
router.post('/route-yield', async (req, res) => {
  try {
    const { user, solAmount, bookingRef } = req.body || {};
    if (!user || !solAmount) return res.status(400).json({ success: false, error: 'user + solAmount required' });
    const r = await autonomousEconomyService.routeToYield(user, Number(solAmount), bookingRef);
    res.json({ success: true, data: r });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Confirm a yield route after the user broadcasts the tx
router.post('/confirm-yield', async (req, res) => {
  try {
    const { bookingRef, txHash } = req.body || {};
    if (!bookingRef || !txHash) return res.status(400).json({ success: false, error: 'bookingRef + txHash required' });
    const r = await autonomousEconomyService.confirmYield(bookingRef, txHash);
    res.json({ success: true, data: r });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});


export default router;
