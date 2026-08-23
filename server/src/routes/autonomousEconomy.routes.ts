/**
 * Autonomous Economy merchant routes — the treasury as a self-sustaining merchant.
 * Zero human interaction required: any wallet can buy/sell $PAB against the treasury
 * at the deterministic peg; the agent loop skims 2% on every booking.
 */
import { Router } from 'express';
import { PublicKey } from '@solana/web3.js';
import { autonomousEconomy } from '../services/autonomousEconomy.service';
import { logger } from '../utils/logger';

const router = Router();
const API_VERSION = process.env.API_VERSION || 'v1';

/** Quote how much $PAB a buyer gets for `solAmount` SOL (no on-chain action). */
router.post('/quote-buy', (req, res) => {
  try {
    const sol = parseFloat(req.body.solAmount);
    if (!sol || sol <= 0) return res.status(400).json({ error: 'solAmount required' });
    const lamports = Math.floor(sol * 1e9);
    const pabOut = autonomousEconomy.quotePabOut(lamports);
    res.json({ solAmount: sol, pabOut: pabOut / 1e9, usdValue: +(sol * 140).toFixed(2) });
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

/** BUY: a buyer sends SOL (signed client-side to the treasury) and the treasury sends $PAB.
 *  In this model the buyer submits the SOL-transfer tx separately (or we accept signed buy orders).
 *  Simplest autonomous form: buyer POSTs { buyerAddress, solAmount }; we return the treasury
 *  address to pay + expected PAB. The actual SOL→treasury + PAB→buyer happens when we observe the
 *  deposit via a follow-up /settle-buy with the tx signature. This keeps keys server-side. */
router.post('/buy-pab', async (req, res) => {
  try {
    const buyer = new PublicKey(req.body.buyerAddress);
    const sol = parseFloat(req.body.solAmount);
    if (!buyer || !sol || sol <= 0) return res.status(400).json({ error: 'buyerAddress + solAmount required' });
    // Return the treasury address + the PAB the buyer will receive, and the SOL tx they must sign.
    const lamports = Math.floor(sol * 1e9);
    const pabOut = autonomousEconomy.quotePabOut(lamports);
    const treasury = process.env.PABANDI_TREASURY_WALLET || process.env.TREASURY_WALLET;
    res.json({
      treasuryAddress: treasury,
      solAmount: sol,
      pabOut: pabOut / 1e9,
      instruction: 'Send `solAmount` SOL to `treasuryAddress`, then POST /settle-buy with the SOL tx signature to receive your PAB.',
    });
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

/** Settle a buy: given a confirmed SOL deposit tx to the treasury, send the buyer their $PAB. */
router.post('/settle-buy', async (req, res) => {
  try {
    const buyer = new PublicKey(req.body.buyerAddress);
    const solTx = req.body.solTx; // signature of the SOL transfer to treasury
    const sol = parseFloat(req.body.solAmount);
    if (!buyer || !solTx || !sol) return res.status(400).json({ error: 'buyerAddress + solTx + solAmount required' });
    // (In production: verify the tx actually landed SOL in the treasury via getTransaction.)
    const lamports = Math.floor(sol * 1e9);
    const result = await autonomousEconomy.buyPab(buyer, lamports);
    logger.info(`[Econ] settled buy for ${buyer.toBase58()}: ${result.pabOut / 1e9} PAB`);
    res.json({ success: true, ...result, pabOut: result.pabOut / 1e9 });
  } catch (e: any) { res.status(400).json({ error: e.message }); }
});

/** Net on-chain SOL revenue (inflow - outflow) — the profitability number. */
router.get('/net-revenue', async (_req, res) => {
  try { const r = await autonomousEconomy.netSolRevenue(30); res.json(r); }
  catch (e: any) { res.status(500).json({ error: e.message }); }
});

export default router;
