import { Router, Response } from 'express';
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import {
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  createTransferCheckedInstruction,
  getAssociatedTokenAddress,
} from '@solana/spl-token';
import { optionalAuthenticate, AuthRequest } from '../middleware/auth.middleware';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { advanceBookingEscrow } from '../services/booking-escrow.service';

const router = Router();

export type SolanaStableAsset = 'USDC' | 'CASH';

const SOLANA_CLUSTER = (process.env.SOLANA_CLUSTER || 'devnet').toLowerCase();
const SOLANA_RPC_URL =
  process.env.SOLANA_RPC_URL ||
  (SOLANA_CLUSTER === 'mainnet-beta' || SOLANA_CLUSTER === 'mainnet'
    ? 'https://api.mainnet-beta.solana.com'
    : 'https://api.devnet.solana.com');

const SOLANA_ESCROW_PROGRAM_ID =
  process.env.SOLANA_ESCROW_PROGRAM_ID || 'EUSLC8q2b2SezvMQFhvU98EFrWkEasTdvrjqdJgYn2qc';

const ASSET_CONFIG: Record<
  SolanaStableAsset,
  { mint: PublicKey; decimals: number; tokenProgramId: PublicKey; label: string }
> = {
  USDC: {
    mint: new PublicKey(
      process.env.SOLANA_USDC_MINT ||
        (SOLANA_CLUSTER === 'mainnet-beta' || SOLANA_CLUSTER === 'mainnet'
          ? 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
          : '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU')
    ),
    decimals: 6,
    tokenProgramId: TOKEN_PROGRAM_ID,
    label: 'USDC (SPL Token)',
  },
  CASH: {
    // Phantom CASH stablecoin on Solana (Token-2022, 6 decimals)
    mint: new PublicKey(
      process.env.SOLANA_CASH_MINT || 'CASHx9KJUStyftLFWGvEVf59SGeG9sh5FfcnZMVPCASH'
    ),
    decimals: 6,
    tokenProgramId: TOKEN_2022_PROGRAM_ID,
    label: 'CASH by Phantom (Token-2022)',
  },
};

const DEFAULT_ESCROW_VAULT =
  process.env.ESCROW_VAULT_ADDRESS ||
  process.env.SOLANA_TREASURY_WALLET ||
  'GsbwXfJraMomNxBcjYLcG3mxkBUiyWXAB32fGbSQQRre';

function resolveAsset(input: unknown): SolanaStableAsset {
  if (typeof input === 'string' && input.trim().toUpperCase() === 'CASH') {
    return 'CASH';
  }
  return 'USDC';
}

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

/**
 * Mirrors the on-chain DRPE formula in `contracts/solana/pabandi_escrow/programs/pabandi_escrow/src/lib.rs`.
 */
export function calculateDrpeQuote(trustScore: number, totalAmount: number) {
  const clampedScore = Math.max(0, Math.min(100, Math.floor(trustScore)));
  let tier: 'Platinum' | 'Gold' | 'Standard' | 'New';
  let depositBps: number;
  let feeBps: number;

  if (clampedScore >= 95) {
    tier = 'Platinum';
    depositBps = 1000; // 10%
    feeBps = 30; // 0.30%
  } else if (clampedScore >= 80) {
    tier = 'Gold';
    depositBps = 2500; // 25%
    feeBps = 80; // 0.80%
  } else if (clampedScore >= 50) {
    tier = 'Standard';
    depositBps = 10000; // 100%
    feeBps = 150; // 1.50%
  } else {
    tier = 'New';
    depositBps = 10000; // 100%
    feeBps = 250; // 2.50%
  }

  const totalRaw = BigInt(Math.round(totalAmount * 1_000_000));
  const depositRaw = (totalRaw * BigInt(depositBps)) / 10_000n;
  const feeRaw = (totalRaw * BigInt(feeBps)) / 10_000n;
  const baselineDepositRaw = totalRaw;
  const capitalSavedRaw = baselineDepositRaw - depositRaw;

  return {
    trustScore: clampedScore,
    tier,
    depositPercent: depositBps / 100,
    feePercent: feeBps / 100,
    feeBps,
    totalAmount,
    depositRequired: Number(depositRaw) / 1_000_000,
    platformFee: Number(feeRaw) / 1_000_000,
    capitalUnlocked: Number(capitalSavedRaw) / 1_000_000,
    programId: SOLANA_ESCROW_PROGRAM_ID,
    cluster: SOLANA_CLUSTER,
    supportedAssets: ['USDC', 'CASH'] as SolanaStableAsset[],
  };
}

/**
 * Verifies an SPL Token or Token-2022 transfer on Solana RPC using maxSupportedTransactionVersion: 1.
 */
export async function verifySolanaTokenTransfer(params: {
  txSignature: string;
  expectedRecipient: string;
  expectedMint: string;
  minRawAmount: bigint;
  expectedSender?: string;
}): Promise<{ verified: boolean; reason?: string; receivedRaw?: bigint; slot?: number }> {
  const connection = new Connection(SOLANA_RPC_URL, 'confirmed');
  const tx = await connection.getTransaction(params.txSignature, {
    commitment: 'confirmed',
    maxSupportedTransactionVersion: 1,
  });

  if (!tx) {
    return { verified: false, reason: 'Transaction not found or not yet confirmed on Solana' };
  }
  if (tx.meta?.err) {
    return { verified: false, reason: `Transaction failed on-chain: ${JSON.stringify(tx.meta.err)}` };
  }

  const preBalances = tx.meta?.preTokenBalances ?? [];
  const postBalances = tx.meta?.postTokenBalances ?? [];

  const sumByOwner = (balances: typeof preBalances, owner: string) => {
    let total = 0n;
    for (const b of balances) {
      if (b.mint === params.expectedMint && b.owner === owner) {
        total += BigInt(b.uiTokenAmount?.amount || '0');
      }
    }
    return total;
  };

  const recipientBefore = sumByOwner(preBalances, params.expectedRecipient);
  const recipientAfter = sumByOwner(postBalances, params.expectedRecipient);
  const receivedRaw = recipientAfter - recipientBefore;

  if (receivedRaw < params.minRawAmount) {
    return {
      verified: false,
      reason: `On-chain transfer to ${params.expectedRecipient} for mint ${params.expectedMint} was ${receivedRaw.toString()} base units, below required ${params.minRawAmount.toString()}`,
    };
  }

  if (params.expectedSender) {
    const senderBefore = sumByOwner(preBalances, params.expectedSender);
    const senderAfter = sumByOwner(postBalances, params.expectedSender);
    const spentRaw = senderBefore - senderAfter;
    if (spentRaw < params.minRawAmount) {
      return {
        verified: false,
        reason: `Expected sender ${params.expectedSender} did not debit at least ${params.minRawAmount.toString()} base units in this transaction`,
      };
    }
  }

  return { verified: true, receivedRaw, slot: tx.slot };
}

// GET /api/v1/solana-usdc/drpe/quote
// Returns live Dynamic Risk-Pricing Engine (DRPE) terms matching the on-chain Anchor program.
router.get('/drpe/quote', (req, res: Response) => {
  const trustScore = Number(req.query.trustScore ?? 50);
  const amount = Number(req.query.amount ?? 100);
  if (!Number.isFinite(trustScore) || trustScore < 0 || trustScore > 100) {
    return res.status(400).json({ success: false, error: 'trustScore must be between 0 and 100' });
  }
  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ success: false, error: 'amount must be a positive number' });
  }
  return res.json({
    success: true,
    data: calculateDrpeQuote(trustScore, amount),
  });
});

// POST /api/v1/solana-usdc/transfer/build
// Builds an unsigned SPL USDC or Token-2022 CASH transfer transaction (base64) for Phantom / Privy signing.
router.post('/transfer/build', optionalAuthenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { fromWallet, toWallet, amountUsdc, amount: bodyAmount, asset: rawAsset } = req.body ?? {};
    const amount = Number(amountUsdc ?? bodyAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ success: false, error: 'amountUsdc must be a positive number' });
    }

    const asset = resolveAsset(rawAsset);
    const cfg = ASSET_CONFIG[asset];

    const fromPubkey = parsePublicKey(fromWallet, 'fromWallet');
    const toPubkey = parsePublicKey(toWallet || DEFAULT_ESCROW_VAULT, 'toWallet');

    const rawUnits = BigInt(Math.round(amount * 10 ** cfg.decimals));
    if (rawUnits <= 0n) {
      return res.status(400).json({ success: false, error: 'Transfer amount is too small' });
    }

    const fromAta = await getAssociatedTokenAddress(
      cfg.mint,
      fromPubkey,
      false,
      cfg.tokenProgramId
    );
    const toAta = await getAssociatedTokenAddress(
      cfg.mint,
      toPubkey,
      false,
      cfg.tokenProgramId
    );

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
        cfg.mint,
        cfg.tokenProgramId
      ),
      createTransferCheckedInstruction(
        fromAta,
        cfg.mint,
        toAta,
        fromPubkey,
        rawUnits,
        cfg.decimals,
        [],
        cfg.tokenProgramId
      )
    );

    const serialized = tx.serialize({
      requireAllSignatures: false,
      verifySignatures: false,
    });

    return res.json({
      success: true,
      asset,
      mint: cfg.mint.toBase58(),
      tokenProgram: cfg.tokenProgramId.toBase58(),
      cluster: SOLANA_CLUSTER,
      transaction: serialized.toString('base64'),
      blockhash,
      lastValidBlockHeight,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Could not build Solana transfer';
    const status = message.includes('is required') || message.includes('not a valid') ? 400 : 500;
    logger.error('[SolanaUSDC] build error:', message);
    return res.status(status).json({ success: false, error: message });
  }
});

// POST /api/v1/solana-usdc/transfer/record
// Verifies a submitted Solana USDC or CASH transaction on-chain before reconciling booking deposits.
router.post('/transfer/record', optionalAuthenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { fromWallet, toWallet, amountUsdc, amount: bodyAmount, txHash, type, referenceId, asset: rawAsset } =
      req.body ?? {};
    const txSignature = typeof txHash === 'string' ? txHash.trim() : '';
    const amount = Number(amountUsdc ?? bodyAmount);

    if (!txSignature || !/^[1-9A-HJ-NP-Za-km-z]{64,96}$/.test(txSignature)) {
      return res.status(400).json({ success: false, error: 'Valid base58 txHash is required' });
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return res.status(400).json({ success: false, error: 'amountUsdc must be a positive number' });
    }

    const asset = resolveAsset(rawAsset);
    const cfg = ASSET_CONFIG[asset];
    const expectedRecipient = parsePublicKey(toWallet || DEFAULT_ESCROW_VAULT, 'toWallet').toBase58();
    const expectedSender = fromWallet ? parsePublicKey(fromWallet, 'fromWallet').toBase58() : undefined;
    const rawUnits = BigInt(Math.round(amount * 10 ** cfg.decimals));

    const refKey = `solana:${txSignature}`;

    // Prevent replaying an already-consumed signature against a different booking/reference
    const existing = await prisma.cryptoPayment.findUnique({ where: { reference: refKey } });
    const existingRefId = (existing?.metadata as Record<string, unknown> | null)?.referenceId;
    if (existing && referenceId && existingRefId && String(existingRefId) !== String(referenceId)) {
      return res.status(409).json({
        success: false,
        error: 'Transaction signature was already redeemed for a different referenceId',
      });
    }

    // Verify settlement directly from Solana chain state (never trust client callbacks blindly)
    const verification = await verifySolanaTokenTransfer({
      txSignature,
      expectedRecipient,
      expectedMint: cfg.mint.toBase58(),
      minRawAmount: rawUnits,
      expectedSender,
    });

    if (!verification.verified) {
      logger.warn(`[SolanaUSDC] rejected unverified tx ${txSignature}: ${verification.reason}`);
      return res.status(400).json({
        success: false,
        error: verification.reason || 'On-chain transaction verification failed',
      });
    }

    const payment = await prisma.cryptoPayment.upsert({
      where: { reference: refKey },
      create: {
        type: typeof type === 'string' && type.trim() ? type.trim() : 'FUNDING',
        amount,
        currency: asset,
        status: 'CONFIRMED',
        reference: refKey,
        payerId: req.user?.id ?? null,
        txSignature,
        metadata: {
          asset,
          mint: cfg.mint.toBase58(),
          cluster: SOLANA_CLUSTER,
          verifiedOnChain: true,
          slot: verification.slot ?? null,
          receivedRaw: verification.receivedRaw?.toString() ?? null,
          fromWallet: expectedSender ?? null,
          toWallet: expectedRecipient,
          referenceId: referenceId ? String(referenceId) : null,
        } as any,
      },
      update: {
        status: 'CONFIRMED',
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
            paidVia: asset === 'CASH' ? 'solana_cash' : 'solana',
          },
        })
        .catch(() => {});

      await advanceBookingEscrow(bookingId, 'funded', {
        source: 'solana-usdc-verified',
        rail: 'solana_pay',
        txHash: txSignature,
        receiptRef: refKey,
      }).catch(() => {});
    }

    return res.json({
      success: true,
      verifiedOnChain: true,
      slot: verification.slot,
      cluster: SOLANA_CLUSTER,
      asset,
      data: payment,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Could not verify/record Solana transfer';
    const status = message.includes('is required') || message.includes('not a valid') ? 400 : 500;
    logger.error('[SolanaUSDC] record error:', message);
    return res.status(status).json({ success: false, error: message });
  }
});

export default router;
