import { Router } from 'express';
import { authenticate, authorize } from '../middleware/auth.middleware';

/**
 * WHY THIS ROUTER IS AUTHENTICATED, AND WHY FIVE OF ITS ROUTES ARE ADMIN-ONLY
 *
 * Authentication first: all thirteen endpoints were mounted with no
 * `authenticate`, and eight of them move money or write the treasury ledger, so
 * an anonymous caller could drive the fee machinery directly.
 *
 * Authorisation second, which is what the previous pass left open. These
 * endpoints act on the protocol treasury rather than a tenant, so per-business
 * ownership does not apply — but "not a tenant" is not the same as "any user".
 *
 * The treasury write paths are admin-only because of what an authenticated user
 * could do with them:
 *
 *   - charge-rake / route-yield take the *payer address from the request body*
 *     and write a PENDING_CHARGE row for any amount. The transaction needs the
 *     payer's signature so no money moves, but the ledger row is real and is
 *     what confirm-rake later reconciles against. Arbitrary users were able to
 *     mint them at will.
 *   - confirm-rake / confirm-yeld mark a PENDING_CHARGE DEPLOYED once it finds
 *     *a* valid on-chain transaction. It does not check that the transaction
 *     belongs to that charge, so passing any real signature against any
 *     bookingRef marked the row confirmed and credited the referral and partner
 *     kickbacks attached to it. That is a ledger-forging path, not just noise.
 *   - demo-book runs the whole simulation for arbitrary inputs.
 *
 * The quotes are read-only and stay open to any authenticated user, because a
 * price quote does not need to be privileged to be useful.
 *
 * /leaderboard and /referral/:code remain fully public and unauthenticated — a
 * leaderboard should be public and a referral code is a shareable handle.
 * Neither exposes another party's balances.
 */
import { autonomousEconomyService } from '../services/autonomousEconomy.service';

const router = Router();

// Net platform SOL revenue (profitability report)
router.get('/net-revenue', authenticate, async (_req, res) => {
  try {
    const r = await autonomousEconomyService.netSolRevenue();
    res.json({ success: true, data: r });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Quote a human SOL rake (no on-chain action)
router.post('/quote-rake', authenticate, async (req, res) => {
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
router.post('/charge-rake', authenticate, authorize('ADMIN'), async (req, res) => {
  try {
    const { payer, solAmount, bookingRef, referralCode, partnerId } = req.body || {};
    if (!payer || !solAmount) return res.status(400).json({ success: false, error: 'payer + solAmount required' });
    const r = await autonomousEconomyService.chargeRake(payer, Number(solAmount), bookingRef, { referralCode, partnerId });
    res.json({ success: true, data: r });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── SOL checkout (wires the human rake into the real product flow) ──
// A human booking an agent pays in SOL; 1% skims to the fee wallet, rest settles.
// Returns a partial-signed tx for the payer to broadcast. chargeRake already persists a
// PENDING_CHARGE so confirm-rake can close the booking on broadcast.
// Stays open to any authenticated user deliberately: this is the real customer
// path where a client pays in SOL, so it cannot be admin-only. It does write a
// PENDING_CHARGE via chargeRake, which is what makes the admin gate on
// confirm-rake load-bearing — that gate is what stops anyone from minting a
// charge here and then declaring it settled against an unrelated signature.
router.post('/sol-checkout', authenticate, async (req, res) => {
  try {
    const { payer, solAmount, bookingRef, agentId, note, referralCode, partnerId } = req.body || {};
    if (!payer || !solAmount) return res.status(400).json({ success: false, error: 'payer + solAmount required' });
    const r = await autonomousEconomyService.chargeRake(payer, Number(solAmount), bookingRef, { referralCode, partnerId });
    res.json({ success: true, data: { ...r, feeWallet: process.env.FEE_TREASURY_WALLET, agentId: agentId || null, note: note || 'SOL checkout' } });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── Business dashboard (by referral code): posted gigs, bookings, rake earned ──
router.get('/business/:refCode', authenticate, async (req, res) => {
  try {
    const r = await autonomousEconomyService.businessDashboard(req.params.refCode);
    res.json({ success: true, data: r });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── Demo booking (no wallet): full booking cycle server-side, simulated:true ──
router.post('/demo-book', authenticate, authorize('ADMIN'), async (req, res) => {
  try {
    const { referralCode, partnerId, agentId, gigId, solAmount } = req.body || {};
    const r = await autonomousEconomyService.demoBook({ referralCode, partnerId, agentId, gigId, solAmount: solAmount ? Number(solAmount) : undefined });
    res.json({ success: true, data: r });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── Confirm human rake (closes the booking after the payer broadcasts) ──
router.post('/confirm-rake', authenticate, authorize('ADMIN'), async (req, res) => {
  try {
    const { bookingRef, txHash } = req.body || {};
    if (!bookingRef || !txHash) return res.status(400).json({ success: false, error: 'bookingRef + txHash required' });
    const r = await autonomousEconomyService.confirmRake(bookingRef, txHash);
    res.json({ success: true, data: r });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── Yield router (option Y): route USER external SOL → JitoSOL, platform skims entry fee ──
// Quote a yield route (no on-chain action)
router.post('/quote-yield', authenticate, async (req, res) => {
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
router.post('/route-yield', authenticate, authorize('ADMIN'), async (req, res) => {
  try {
    const { user, solAmount, bookingRef, partnerId } = req.body || {};
    if (!user || !solAmount) return res.status(400).json({ success: false, error: 'user + solAmount required' });
    const r = await autonomousEconomyService.routeToYield(user, Number(solAmount), bookingRef, { partnerId });
    res.json({ success: true, data: r });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Confirm a yield route after the user broadcasts the tx
router.post('/confirm-yield', authenticate, authorize('ADMIN'), async (req, res) => {
  try {
    const { bookingRef, txHash } = req.body || {};
    if (!bookingRef || !txHash) return res.status(400).json({ success: false, error: 'bookingRef + txHash required' });
    const r = await autonomousEconomyService.confirmYield(bookingRef, txHash);
    res.json({ success: true, data: r });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});


// ── Tier-2: referral + partner stats (read-only, zero treasury cost) ──
router.get('/referral/:code', async (req, res) => {
  try {
    const r = await autonomousEconomyService.referralStats(req.params.code);
    res.json({ success: true, data: r });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/partner/:id', authenticate, async (req, res) => {
  try {
    const r = await autonomousEconomyService.partnerStats(req.params.id);
    res.json({ success: true, data: r });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Public leaderboard (social proof): top referrers + partners by SOL earned
router.get('/leaderboard', async (_req, res) => {
  try {
    const r = await autonomousEconomyService.leaderboard();
    res.json({ success: true, data: r });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;