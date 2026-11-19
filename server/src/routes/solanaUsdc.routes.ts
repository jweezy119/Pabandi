import { Router, Response } from 'express';
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import {
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferInstruction,
  getAssociatedTokenAddress,
} from '@solana/spl-token';
import { optionalAuthenticate, AuthRequest } from '../middleware/auth.middleware';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { advanceBookingEscrow } from '../services/booking-escrow.service';

const router = Router();

const USDC_MINT = new PublicKey(
  process.env.SOLANA_USDC_MINT || 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
);
const DEFAULT_ESCROW_VAULT =
  process.env.ESCROW_VAULT_ADDRESS ||
  process.env.SOLANA_TREASURY_WALLET ||
  'GsbwXfJraMomNxBcjYLcG3mxkBUiyWXAB32fGbSQQRre';
const SOLANA_RPC_URL =
  process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const USDC_DECIMALS = 6;

function parsePublicKey(value: unknown, field: string): PublicKey {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`${field} is required`);
  }
  try {
    return new PublicKey(value.trim());
  } catch {
    throw new Error(`${field} is not a valid Solana public key`);
  }
}

function extractBookingIdFromReference(referenceId?: string | null): string | null {
  if (!referenceId) return null;
  const colonMatch = referenceId.match(/^pabandi:booking:([A-Za-z0-9_-]+)$/);
  if (colonMatch) return colonMatch[1];
  const dashMatch = referenceId.match(/^booking-([A-Za-z0-9_-]+)$/);
  if (dashMatch) return dashMatch[1];
  return null;
}

// POST /api/v1/solana-usdc/transfer/build
// Builds an unsigned SPL USDC transfer transaction (base64) for Privy or Phantom to sign.
router.post('/transfer/build', optionalAuthenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { fromWallet, toWallet, amountUsdc } = req.body ?? {};
    const amount = Number(amountUsdc);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ success: false, error: 'amountUsdc must be a positive number' });
    }

    const fromPubkey = parsePublicKey(fromWallet, 'fromWallet');
    const toPubkey = parsePublicKey(toWallet || DEFAULT_ESCROW_VAULT, 'toWallet');

    const rawUnits = BigInt(Math.round(amount * 10 ** USDC_DECIMALS));
    if (rawUnits <= 0n) {
      return res.status(400).json({ success: false, error: 'amountUsdc is too small' });
    }

    const fromAta = await getAssociatedTokenAddress(USDC_MINT, fromPubkey);
    const toAta = await getAssociatedTokenAddress(USDC_MINT, toPubkey);

    const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');

    const tx = new Transaction({
      feePayer: fromPubkey,
      recentBlockhash: blockhash,
    });

    tx.add(
      createAssociatedTokenAccountIdempotentInstruction(
        fromPubkey,
        toAta,
        toPubkey,
        USDC_MINT
      ),
      createTransferInstruction(fromAta, toAta, fromPubkey, rawUnits)
    );

    const serialized = tx.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });

    return res.json({
      success: true,
      transaction: serialized.toString('base64'),
      blockhash,
      lastValidBlockHeight,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Could not build Solana USDC transfer';
    const status = message.includes('is required') || message.includes('not a valid') ? 400 : 500;
    logger.error('[SolanaUSDC] build error:', message);
    return res.status(status).json({ success: false, error: message });
  }
});

// POST /api/v1/solana-usdc/transfer/record
// Records a submitted Solana USDC transaction and reconciles matching booking deposits.
router.post('/transfer/record', optionalAuthenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { fromWallet, toWallet, amountUsdc, txHash, type, referenceId } = req.body ?? {};
    const txSignature = typeof txHash === 'string' ? txHash.trim() : '';
    const amount = Number(amountUsdc);

    if (!txSignature) {
      return res.status(400).json({ success: false, error: 'txHash is required' });
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ success: false, error: 'amountUsdc must be a positive number' });
    }

    const refKey = `solana:${txSignature}`;
    const payment = await prisma.cryptoPayment.upsert({
      where: { reference: refKey },
      create: {
        type: typeof type === 'string' && type.trim() ? type.trim() : 'FUNDING',
        amount,
        currency: 'USDC',
        status: 'SUBMITTED',
        reference: refKey,
        payerId: req.user?.id ?? null,
        txSignature,
        metadata: {
          fromWallet: fromWallet ? String(fromWallet) : null,
          toWallet: toWallet ? String(toWallet) : DEFAULT_ESCROW_VAULT,
          referenceId: referenceId ? String(referenceId) : null,
        } as any,
      },
      update: {
        status: 'SUBMITTED',
        txSignature,
      },
    });

    const bookingId = extractBookingIdFromReference(referenceId ? String(referenceId) : null);
    if (bookingId) {
      await prisma.booking
        .update({
          where: { id: bookingId },
          data: {
            depositPaid: true,
            depositStatus: 'paid',
            status: 'confirmed',
            paymentRef: txSignature,
            paidVia: 'solana',
          },
        })
        .catch(() => {});

      await advanceBookingEscrow(bookingId, 'funded', {
        source: 'solana-usdc-record',
        rail: 'solana_pay',
        txHash: txSignature,
        receiptRef: refKey,
      }).catch(() => {});
    }

    return res.json({ success: true, data: payment });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Could not record Solana USDC transfer';
    logger.error('[SolanaUSDC] record error:', message);
    return res.status(500).json({ success: false, error: message });
  }
});

export default router;
