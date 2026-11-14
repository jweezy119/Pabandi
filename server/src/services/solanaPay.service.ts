import crypto from 'crypto';
import { Keypair, PublicKey } from '@solana/web3.js';
import { prisma } from '../utils/database';
import { logger } from '../utils/logger';
import { cnftService } from './cnft.service';
import { cryptoService } from './cryptoService';
import { openwaService } from './openwa.service';
import { openwaTemplateService } from './openwa.template.service';

export const USDC_MINT_MAINNET = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
export const PAB_TOKEN_MINT =
  process.env.PAB_TOKEN_MINT || 'PABtkn1111111111111111111111111111111111111';

const SOLANA_RPC_URL = process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com';
const DEFAULT_PLATFORM_TREASURY =
  process.env.PLATFORM_WALLET ||
  process.env.PABANDI_TREASURY_WALLET ||
  'GsbwXfJraMomNxBcjYLcG3mxkBUiyWXAB32fGbGbSQQRre'.slice(0, 44);

export interface SolanaPayTransferRequest {
  bookingId: string;
  businessId: string;
  businessName: string;
  serviceName: string;
  recipient: string;
  amount: number;
  currency: 'USDC' | 'PAB' | 'SOL';
  splToken: string | null;
  reference: string;
  memo: string;
  solanaPayUrl: string;
  blinkUrl: string;
  estimatedSettlementMs: number;
  cnftAssetId?: string;
}

export interface SolanaPayVerificationResult {
  verified: boolean;
  signature?: string;
  slot?: number;
  blockTime?: number | null;
  amountSettled?: number;
  reference: string;
  bookingId: string;
  cnftUpdated?: boolean;
  pabRewardMinted?: boolean;
  error?: string;
}

/**
 * Deterministically derive a valid Ed25519 Solana PublicKey reference for a bookingId.
 * Because Solana Pay `findReference` queries `getSignaturesForAddress(referencePubkey)`,
 * deterministic derivation means no state is lost across server restarts and each booking
 * has a globally unique on-chain reference key.
 */
export function deriveReferencePublicKey(bookingId: string): PublicKey {
  const seed = crypto
    .createHash('sha256')
    .update(`pabandi-solana-pay-ref:v1:${bookingId}`)
    .digest();
  return Keypair.fromSeed(seed).publicKey;
}

function resolveRecipientWallet(businessWallet?: string | null): string {
  if (businessWallet) {
    try {
      return new PublicKey(businessWallet).toBase58();
    } catch {
      // Fallback if business wallet is an EVM address or placeholder
    }
  }
  try {
    return new PublicKey(DEFAULT_PLATFORM_TREASURY).toBase58();
  } catch {
    const fallbackSeed = crypto.createHash('sha256').update('pabandi-treasury-vault').digest();
    return Keypair.fromSeed(fallbackSeed).publicKey.toBase58();
  }
}

export class SolanaPayService {
  /**
   * Build a spec-compliant Solana Pay transfer request URI + reference key for a reservation.
   * Replaces manual screenshot upload with 400ms on-chain `findReference` detection.
   */
  async createTransferRequest(params: {
    bookingId: string;
    currency?: 'USDC' | 'PAB' | 'SOL';
    overrideAmount?: number;
  }): Promise<SolanaPayTransferRequest> {
    const reservation = await prisma.reservation.findUnique({
      where: { id: params.bookingId },
      include: {
        business: {
          include: { owner: { select: { walletAddress: true } } },
        },
        services: { include: { service: true } },
      },
    });

    if (!reservation) {
      throw new Error(`Reservation ${params.bookingId} not found`);
    }

    const currency = params.currency || 'USDC';
    const serviceName =
      reservation.services?.map((s: any) => s.service?.name).filter(Boolean).join(', ') ||
      'Appointment Reservation';

    // Calculate remaining balance or deposit amount in USDC
    const rawTotal = Number(
      params.overrideAmount ??
        reservation.totalAmount ??
        reservation.depositAmount ??
        10
    );
    // If business currency is PKR and amount > 200, convert at ~278 PKR/USDC unless overridden
    const businessCurrency = (reservation.business as any)?.currency || 'PKR';
    const amountUsdc =
      businessCurrency === 'PKR' && rawTotal > 200 && !params.overrideAmount
        ? Math.max(1, Number((rawTotal / 278).toFixed(2)))
        : Math.max(0.5, Number(rawTotal.toFixed(2)));

    const recipient = resolveRecipientWallet(reservation.business?.owner?.walletAddress);
    const referencePubkey = deriveReferencePublicKey(reservation.id).toBase58();
    const splToken =
      currency === 'USDC'
        ? USDC_MINT_MAINNET
        : currency === 'PAB'
        ? PAB_TOKEN_MINT
        : null;

    const label = reservation.business?.name || 'Pabandi Merchant';
    const message = `${serviceName} (#${reservation.id.slice(-6).toUpperCase()})`;
    const memo = `pabandi:${reservation.id}`;

    const query = new URLSearchParams();
    query.set('amount', amountUsdc.toFixed(2));
    if (splToken) query.set('spl-token', splToken);
    query.set('reference', referencePubkey);
    query.set('label', label);
    query.set('message', message);
    query.set('memo', memo);

    const solanaPayUrl = `solana:${recipient}?${query.toString()}`;
    const blinkUrl = `https://pabandi.com/book/${reservation.businessId}?bookingId=${reservation.id}&reference=${referencePubkey}`;

    const cnftCheck = await cnftService.verifyCredential(reservation.id);

    return {
      bookingId: reservation.id,
      businessId: reservation.businessId,
      businessName: label,
      serviceName,
      recipient,
      amount: amountUsdc,
      currency,
      splToken,
      reference: referencePubkey,
      memo,
      solanaPayUrl,
      blinkUrl,
      estimatedSettlementMs: 400,
      cnftAssetId: cnftCheck.credential?.assetId,
    };
  }

  /**
   * Solana Pay `findReference` implementation:
   * Queries the Solana RPC for confirmed transactions referencing `referencePubkey`.
   * Once found, automatically settles the reservation, updates the cNFT booking credential
   * to COMPLETED, mints $PAB check-in rewards, and sends a pure-utility WhatsApp receipt.
   */
  async findReferenceAndSettle(params: {
    bookingId: string;
    txSignature?: string;
  }): Promise<SolanaPayVerificationResult> {
    const reservation = await prisma.reservation.findUnique({
      where: { id: params.bookingId },
      include: {
        business: true,
        services: { include: { service: true } },
      },
    });

    if (!reservation) {
      throw new Error(`Reservation ${params.bookingId} not found`);
    }

    const referencePubkey = deriveReferencePublicKey(reservation.id).toBase58();
    let confirmedSig = params.txSignature?.trim() || null;
    let slot: number | undefined;
    let blockTime: number | null | undefined;

    // 1. Query Solana RPC `getSignaturesForAddress(referencePubkey)` if signature not supplied
    if (!confirmedSig) {
      try {
        const rpcRes = await fetch(SOLANA_RPC_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method: 'getSignaturesForAddress',
            params: [referencePubkey, { limit: 5, commitment: 'confirmed' }],
          }),
        });

        if (rpcRes.ok) {
          const data: any = await rpcRes.json();
          const sigs: any[] = data?.result || [];
          const validSig = sigs.find((s) => !s.err && s.signature);
          if (validSig) {
            confirmedSig = validSig.signature;
            slot = validSig.slot;
            blockTime = validSig.blockTime;
          }
        }
      } catch (rpcErr: any) {
        logger.warn(`[SolanaPay] findReference RPC query warning: ${rpcErr?.message}`);
      }
    }

    if (!confirmedSig) {
      return {
        verified: false,
        reference: referencePubkey,
        bookingId: reservation.id,
        error: 'Awaiting on-chain transaction for reference key',
      };
    }

    // 2. Mark reservation settled/completed in Prisma
    await prisma.reservation.update({
      where: { id: reservation.id },
      data: {
        status: 'COMPLETED',
        depositStatus: 'APPLIED_TO_SERVICE',
        cryptoDepositTxHash: confirmedSig,
      },
    });

    // 3. Upgrade cNFT Booking Credential status to COMPLETED
    const updatedCnft = await cnftService.updateCredentialStatus(
      reservation.id,
      'COMPLETED',
      confirmedSig
    );

    // 4. Mint $PAB verified check-in rewards to customer & business
    let pabRewardMinted = false;
    try {
      if (reservation.customerId) {
        await cryptoService.rewardReservationCompletion(reservation.customerId, reservation.id);
      }
      await cryptoService.rewardBusinessForCompletion(reservation.businessId, reservation.id);
      pabRewardMinted = true;
    } catch (rewardErr: any) {
      logger.warn(`[SolanaPay] PAB reward mint warning: ${rewardErr?.message}`);
    }

    // 5. Send strictly utility-compliant WhatsApp payment receipt (zero promotional copy)
    const serviceName =
      reservation.services?.map((s: any) => s.service?.name).filter(Boolean).join(', ') ||
      'Appointment Service';
    const amountFormatted = `${(reservation.business as any)?.currency || 'USDC'} ${
      reservation.totalAmount || reservation.depositAmount || 0
    }`;

    if (reservation.customerPhone) {
      try {
        const receiptText = openwaTemplateService.render('solana_pay_receipt', {
          customerName: reservation.customerName || 'Guest',
          businessName: reservation.business?.name || 'Pabandi Merchant',
          bookingId: reservation.id.slice(-8).toUpperCase(),
          serviceName,
          amount: amountFormatted,
          txSignature: `${confirmedSig.slice(0, 8)}...${confirmedSig.slice(-6)}`,
          cnftAssetId: updatedCnft?.assetId || 'Verified',
        });
        await openwaService.sendText(reservation.customerPhone, receiptText);
      } catch (waErr: any) {
        logger.warn(`[SolanaPay] Utility receipt WhatsApp delivery warning: ${waErr?.message}`);
      }
    }

    return {
      verified: true,
      signature: confirmedSig,
      slot,
      blockTime,
      amountSettled: reservation.totalAmount || reservation.depositAmount || 0,
      reference: referencePubkey,
      bookingId: reservation.id,
      cnftUpdated: !!updatedCnft,
      pabRewardMinted,
    };
  }
}

export const solanaPayService = new SolanaPayService();

