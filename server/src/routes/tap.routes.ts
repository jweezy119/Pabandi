import { Router } from 'express';
import { Connection, PublicKey, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import bs58 from 'bs58';

const router = Router();

const SOLANA_RPC = process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
const connection = new Connection(SOLANA_RPC, 'confirmed');

const TREASURY = process.env.TAP_TREASURY || process.env.NEXT_PUBLIC_PLATFORM_WALLET || process.env.PLATFORM_WALLET_ADDRESS;
const USDC_MINT = process.env.USDC_MINT_DEVNET || 'Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtCJr';

// NOTE: BCE, BACKUP_PAYMENT_PROVIDER, BINANCE_CHAIN, BSC_CONTRACT, and related
// box-checking keys were reviewed and are not required in the current demo contract.

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

    return res.json({ success: true, data: intent });
  } catch (err) {
    return res.status(500).json({ success: false, message: (err as Error).message });
  }
});

router.get('/.well-known/tap/:sellerId', (req, res) => {
  res.type('application/json');
  return res.json({
    service: 'tap',
    sellerId: req.params.sellerId,
    currencies: ['USDC', 'SOL'],
    checkoutPath: '/t/pay/:sellerId',
    apiBase: '/api/v1/tap',
    updatedAt: new Date().toISOString(),
  });
});

router.get('/.well-known/blinks.json', (req, res) => {
  const sellerId = String(req.query.sellerId || '').trim();
  res.type('application/json');
  return res.json({
    '$schema': 'https://github.com/solana-labs/blinks/blob/main/blinks.schema.json',
    blinks: [
      {
        id: `tap:${sellerId || ':sellerId'}`,
        name: `Tap Pay ${sellerId || ''}`,
        description: 'Payment Link',
        icon: 'https://pabandi.com/icon-192.png',
        url: `${process.env.FRONTEND_URL || 'https://pabandi.com'}/t/pay/${sellerId || ':sellerId'}`,
        metadata: { sellerId },
        actions: [
          {
            type: 'solana-action',
            title: 'Pay with Tap',
            description: 'Send USDC or SOL directly to the merchant.',
            parameters: [
              { name: 'amount', required: true },
              { name: 'currency', required: true },
              { name: 'memo', required: false }
            ],
            links: [
              { type: 'button', title: 'Pay now' }
            ]
          }
        ]
      }
    ],
    updatedAt: new Date().toISOString(),
  });
});

router.get('/actions/tap-pay/:sellerId', (req, res) => {
  const sellerId = req.params.sellerId;
  const amount = String(req.query.amount || '0');
  const currency = String(req.query.currency || 'USDC').toUpperCase();

  res.type('application/json');
  return res.json({
    '@context': ['https://schema.org', 'https://solana.com/schema'],
    type: 'Actions',
    name: `Tap Pay ${sellerId}`,
    description: 'Send payment to seller using Tap on Pabandi.',
    icon: 'https://pabandi.com/icon-192.png',
    data: {
      merchantId: sellerId,
      name: 'Tap Pay',
      description: 'Tap payment for merchant',
      amount: amount,
      currency: currency,
      button: {
        label: 'Pay with Tap',
        link: `${process.env.FRONTEND_URL || 'https://pabandi.com'}/t/pay/${sellerId}?amount=${encodeURIComponent(amount)}&currency=${encodeURIComponent(currency)}`
      },
      links: {
        actions: [
          {
            label: 'Open checkout',
            href: `${process.env.FRONTEND_URL || 'https://pabandi.com'}/t/pay/${sellerId}?amount=${encodeURIComponent(amount)}&currency=${encodeURIComponent(currency)}`
          }
        ]
      }
    }
  });
});

router.post('/verify', async (req, res) => {
  try {
    const { signature, sellerId, expectedAmount, mint } = req.body || {};
    if (!signature || !sellerId || !expectedAmount) {
      return res.status(400).json({ success: false, message: 'signature, sellerId, expectedAmount required' });
    }

    const tx = await connection.getTransaction(signature, { commitment: 'confirmed', maxSupportedTransactionVersion: 0 });
    if (!tx) return res.status(404).json({ success: false, message: 'Transaction not found or not confirmed' });

    return res.json({ success: !tx.meta?.err, data: { confirmedAt: new Date().toISOString() } });
  } catch (err) {
    return res.status(500).json({ success: false, message: (err as Error).message });
  }
});

export default router;
