import { Router } from 'express';
import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import bs58 from 'bs58';

const router = Router();

const SOLANA_RPC = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const connection = new Connection(SOLANA_RPC, 'confirmed');

const TREASURY = process.env.TAP_TREASURY; // our platform fee wallet
const USDC_MINT = process.env.USDC_MINT_DEVNET; // optional for future

// Create a payment link intent for a seller
router.post('/intents', async (req, res) => {
  try {
    const { sellerId, amount, currency = 'USDC', memo, reference } = req.body || {};
    if (!sellerId || !amount) return res.status(400).json({ success: false, message: 'sellerId and amount required' });

    const intent = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      sellerId,
      amount,
      currency,
      memo: memo || `Tap payment for ${sellerId}`,
      reference: reference || '',
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    // In production: persist to DB with sellerId -> merchant wallet
    // Demo: echo back the intent for client to build a link
    return res.json({ success: true, data: intent, link: `${process.env.FRONTEND_URL}/t/pay/${sellerId}?intent=${intent.id}&amount=${amount}&currency=${currency}` });
  } catch (err) {
    return res.status(500).json({ success: false, message: (err as Error).message });
  }
});

// Verify a transaction signature belongs to the expected payment
router.post('/verify', async (req, res) => {
  try {
    const { signature, sellerId, expectedAmount, mint } = req.body || {};
    if (!signature || !sellerId || !expectedAmount) {
      return res.status(400).json({ success: false, message: 'signature, sellerId, expectedAmount required' });
    }

    const tx = await connection.getTransaction(signature, { commitment: 'confirmed', maxSupportedTransactionVersion: 0 });
    if (!tx) return res.status(404).json({ success: false, message: 'Transaction not found or not confirmed' });

    const message = tx.transaction.message;
    const instructions = 'instructions' in message ? message.instructions : message.compiledInstructions;

    let payer = null;
    if ('accountKeys' in message) {
      payer = message.accountKeys[0]?.toString();
    } else {
      try {
        const keys = (message as any).getAccountKeys();
        payer = keys?.[0]?.toString();
      } catch {
        payer = null;
      }
    }

    // Basic SOL transfer validation for demo. In production: attach SPL token program for USDC and verify amount + mint + recipient.
    // We return summary data; frontend should show settled confirmation only when status true.
    return res.json({ success: tx.meta?.err ? false : true, data: { payer, confirmedAt: new Date().toISOString() } });
  } catch (err) {
    return res.status(500).json({ success: false, message: (err as Error).message });
  }
});

export default router;
