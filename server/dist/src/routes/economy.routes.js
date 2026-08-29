"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const autonomousEconomy_service_1 = require("../services/autonomousEconomy.service");
const router = (0, express_1.Router)();
// Net platform SOL revenue (profitability report)
router.get('/net-revenue', async (_req, res) => {
    try {
        const r = await autonomousEconomy_service_1.autonomousEconomyService.netSolRevenue();
        res.json({ success: true, data: r });
    }
    catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
// Quote a human SOL rake (no on-chain action)
router.post('/quote-rake', async (req, res) => {
    try {
        const { payer, solAmount } = req.body || {};
        if (!payer || !solAmount)
            return res.status(400).json({ success: false, error: 'payer + solAmount required' });
        const q = await autonomousEconomy_service_1.autonomousEconomyService.quoteRake(payer, Number(solAmount));
        res.json({ success: true, data: q });
    }
    catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
// Charge a human SOL rake — returns a base64 tx for the payer to sign + broadcast
router.post('/charge-rake', async (req, res) => {
    try {
        const { payer, solAmount, bookingRef, referralCode, partnerId } = req.body || {};
        if (!payer || !solAmount)
            return res.status(400).json({ success: false, error: 'payer + solAmount required' });
        const r = await autonomousEconomy_service_1.autonomousEconomyService.chargeRake(payer, Number(solAmount), bookingRef, { referralCode, partnerId });
        res.json({ success: true, data: r });
    }
    catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
// ── SOL checkout (wires the human rake into the real product flow) ──
// A human booking an agent pays in SOL; 1% skims to the fee wallet, rest settles.
// Returns a partial-signed tx for the payer to broadcast. chargeRake already persists a
// PENDING_CHARGE so confirm-rake can close the booking on broadcast.
router.post('/sol-checkout', async (req, res) => {
    try {
        const { payer, solAmount, bookingRef, agentId, note, referralCode, partnerId } = req.body || {};
        if (!payer || !solAmount)
            return res.status(400).json({ success: false, error: 'payer + solAmount required' });
        const r = await autonomousEconomy_service_1.autonomousEconomyService.chargeRake(payer, Number(solAmount), bookingRef, { referralCode, partnerId });
        res.json({ success: true, data: { ...r, feeWallet: process.env.FEE_TREASURY_WALLET, agentId: agentId || null, note: note || 'SOL checkout' } });
    }
    catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
// ── Business dashboard (by referral code): posted gigs, bookings, rake earned ──
router.get('/business/:refCode', async (req, res) => {
    try {
        const r = await autonomousEconomy_service_1.autonomousEconomyService.businessDashboard(req.params.refCode);
        res.json({ success: true, data: r });
    }
    catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
// ── Demo booking (no wallet): full booking cycle server-side, simulated:true ──
router.post('/demo-book', async (req, res) => {
    try {
        const { referralCode, partnerId, agentId, gigId, solAmount } = req.body || {};
        const r = await autonomousEconomy_service_1.autonomousEconomyService.demoBook({ referralCode, partnerId, agentId, gigId, solAmount: solAmount ? Number(solAmount) : undefined });
        res.json({ success: true, data: r });
    }
    catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
// ── Confirm human rake (closes the booking after the payer broadcasts) ──
router.post('/confirm-rake', async (req, res) => {
    try {
        const { bookingRef, txHash } = req.body || {};
        if (!bookingRef || !txHash)
            return res.status(400).json({ success: false, error: 'bookingRef + txHash required' });
        const r = await autonomousEconomy_service_1.autonomousEconomyService.confirmRake(bookingRef, txHash);
        res.json({ success: true, data: r });
    }
    catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
// ── Yield router (option Y): route USER external SOL → JitoSOL, platform skims entry fee ──
// Quote a yield route (no on-chain action)
router.post('/quote-yield', async (req, res) => {
    try {
        const { user, solAmount } = req.body || {};
        if (!user || !solAmount)
            return res.status(400).json({ success: false, error: 'user + solAmount required' });
        const q = await autonomousEconomy_service_1.autonomousEconomyService.quoteYield(user, Number(solAmount));
        res.json({ success: true, data: q });
    }
    catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
// Route a user's SOL into JitoSOL — returns a base64 tx for the user to sign + broadcast
router.post('/route-yield', async (req, res) => {
    try {
        const { user, solAmount, bookingRef, partnerId } = req.body || {};
        if (!user || !solAmount)
            return res.status(400).json({ success: false, error: 'user + solAmount required' });
        const r = await autonomousEconomy_service_1.autonomousEconomyService.routeToYield(user, Number(solAmount), bookingRef, { partnerId });
        res.json({ success: true, data: r });
    }
    catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
// Confirm a yield route after the user broadcasts the tx
router.post('/confirm-yield', async (req, res) => {
    try {
        const { bookingRef, txHash } = req.body || {};
        if (!bookingRef || !txHash)
            return res.status(400).json({ success: false, error: 'bookingRef + txHash required' });
        const r = await autonomousEconomy_service_1.autonomousEconomyService.confirmYield(bookingRef, txHash);
        res.json({ success: true, data: r });
    }
    catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
// ── Tier-2: referral + partner stats (read-only, zero treasury cost) ──
router.get('/referral/:code', async (req, res) => {
    try {
        const r = await autonomousEconomy_service_1.autonomousEconomyService.referralStats(req.params.code);
        res.json({ success: true, data: r });
    }
    catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
router.get('/partner/:id', async (req, res) => {
    try {
        const r = await autonomousEconomy_service_1.autonomousEconomyService.partnerStats(req.params.id);
        res.json({ success: true, data: r });
    }
    catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
// Public leaderboard (social proof): top referrers + partners by SOL earned
router.get('/leaderboard', async (_req, res) => {
    try {
        const r = await autonomousEconomy_service_1.autonomousEconomyService.leaderboard();
        res.json({ success: true, data: r });
    }
    catch (e) {
        res.status(500).json({ success: false, error: e.message });
    }
});
exports.default = router;
//# sourceMappingURL=economy.routes.js.map