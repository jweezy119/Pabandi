import { Router, Request, Response } from 'express';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import nacl from 'tweetnacl';
import { PublicKey } from '@solana/web3.js';

const router = Router();

// ── POST /api/v1/auth/wallet/verify ──────────────────────────────────────────
// Verify a Solana wallet signature (Phantom, Solflare, etc.).
// Client signs a message server provides; server verifies the signature.
router.post('/verify', async (req: Request, res: Response) => {
  try {
    const { walletAddress, signature, message } = req.body;

    if (!walletAddress || !signature || !message) {
      return res.status(400).json({
        success: false,
        error: 'walletAddress, signature, and message are required',
      });
    }

    // Verify the signature is valid for this wallet + message.
    try {
      const pubKey = new PublicKey(walletAddress);
      const msgBytes = new TextEncoder().encode(message);
      const sigBytes = Buffer.from(signature, 'base64');
      const valid = nacl.sign.detached.verify(msgBytes, sigBytes, pubKey.toBytes());

      if (!valid) {
        return res.status(401).json({ success: false, error: 'Invalid signature' });
      }
    } catch (e: any) {
      return res.status(400).json({ success: false, error: 'Invalid wallet address or signature' });
    }

    // Find or create user by wallet address.
    let user = await prisma.user.findFirst({ where: { walletAddress } });

    if (!user) {
      // Create a wallet-only user.
      user = await prisma.user.create({
        data: {
          email: `${walletAddress.slice(0, 8)}@wallet.pabandi.com`,
          passwordHash: '', // wallet auth, no password
          firstName: 'Wallet',
          lastName: walletAddress.slice(-4),
          walletAddress,
          role: 'CUSTOMER',
        },
      });
    }

    // Generate a simple session token (in production, use JWT).
    const token = Buffer.from(`${user.id}:${Date.now()}`).toString('base64');

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          walletAddress: user.walletAddress,
          trustScore: user.trustScore,
          role: user.role,
        },
      },
    });
  } catch (e: any) {
    logger.error('Wallet verify failed:', e);
    res.status(500).json({ success: false, error: e.message });
  }
});

// ── GET /api/v1/auth/wallet/nonce ────────────────────────────────────────────
// Get a nonce (challenge message) for the wallet to sign.
router.get('/nonce/:walletAddress', async (req: Request, res: Response) => {
  try {
    const { walletAddress } = req.params;
    const timestamp = Date.now();
    const message = `Sign this message to verify your identity with Pabandi.\n\nWallet: ${walletAddress}\nTimestamp: ${timestamp}\nNonce: ${Math.random().toString(36).slice(2)}`;

    res.json({
      success: true,
      data: {
        message,
        timestamp,
      },
    });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
