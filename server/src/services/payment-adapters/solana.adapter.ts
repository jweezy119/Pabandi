import { PaymentAdapter } from './types';
import { PublicKey } from '@solana/web3.js';
import crypto from 'crypto';
import {
  SolanaStableAsset,
  verifySolanaTokenTransfer,
} from '../../routes/solanaUsdc.routes';

const SOLANA_CLUSTER = (process.env.SOLANA_CLUSTER || 'devnet').toLowerCase();
const IS_MAINNET = SOLANA_CLUSTER === 'mainnet-beta' || SOLANA_CLUSTER === 'mainnet';

// CAIP-2 Solana network identifiers per x402 Solana spec
const SOLANA_CAIP2_NETWORK = IS_MAINNET
  ? 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp'
  : 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1';

const USDC_MINT =
  process.env.SOLANA_USDC_MINT ||
  (IS_MAINNET
    ? 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
    : '4zMMC9srt5Ri5X14GAgXhaHii3GnPAEERYPJgZJDncDU');

// Phantom CASH stablecoin on Solana (Token-2022, 6 decimals)
const CASH_MINT =
  process.env.SOLANA_CASH_MINT || 'CASHx9KJUStyftLFWGvEVf59SGeG9sh5FfcnZMVPCASH';

const DEFAULT_MERCHANT_WALLET =
  process.env.SOLANA_MERCHANT_WALLET ||
  process.env.SOLANA_TREASURY_WALLET ||
  'GsbwXfJraMomNxBcjYLcG3mxkBUiyWXAB32fGbSQQRre';

function resolveMint(asset: SolanaStableAsset) {
  return asset === 'CASH'
    ? { mint: CASH_MINT, tokenProgram: 'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb', decimals: 6 }
    : { mint: USDC_MINT, tokenProgram: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA', decimals: 6 };
}

export class SolanaAdapter implements PaymentAdapter {
  id = 'solana';
  supportsEscrow = true;

  async authorize(amount: number, currency: string, metadata: any = {}) {
    const asset: SolanaStableAsset = currency?.toUpperCase() === 'CASH' ? 'CASH' : 'USDC';
    const recipient = metadata.recipient || DEFAULT_MERCHANT_WALLET;
    if (metadata.txSignature) {
      const { mint, decimals } = resolveMint(asset);
      const minRawAmount = BigInt(Math.round(amount * 10 ** decimals));
      const check = await verifySolanaTokenTransfer({
        txSignature: metadata.txSignature,
        expectedRecipient: recipient,
        expectedMint: mint,
        minRawAmount,
        expectedSender: metadata.fromWallet,
      });
      if (!check.verified) {
        return { success: false, error: check.reason || 'On-chain verification failed' };
      }
      return { success: true, authId: `solana:${metadata.txSignature}` };
    }
    return { success: true, authId: `sol_intent_${crypto.randomUUID()}` };
  }

  async capture(authId: string, _amount?: number) {
    if (authId.startsWith('solana:')) {
      return { success: true, captureId: authId };
    }
    return { success: true, captureId: `sol_cap_${crypto.randomUUID()}` };
  }

  async refund(_captureId: string, _amount?: number) {
    return { success: true, refundId: `sol_ref_${crypto.randomUUID()}` };
  }

  async verifyX402Settlement(params: {
    txSignature: string;
    amount: number;
    asset?: SolanaStableAsset;
    recipient?: string;
    payer?: string;
  }) {
    const asset: SolanaStableAsset = params.asset === 'CASH' ? 'CASH' : 'USDC';
    const recipient = params.recipient || DEFAULT_MERCHANT_WALLET;
    const { mint, decimals } = resolveMint(asset);
    const minRawAmount = BigInt(Math.round(params.amount * 10 ** decimals));

    return verifySolanaTokenTransfer({
      txSignature: params.txSignature,
      expectedRecipient: new PublicKey(recipient).toBase58(),
      expectedMint: mint,
      minRawAmount,
      expectedSender: params.payer ? new PublicKey(params.payer).toBase58() : undefined,
    });
  }

  async createAgentCheckout(protocol: 'acp' | 'x402' | 'ap2' | 'ucp', metadata: any = {}) {
    const asset: SolanaStableAsset =
      typeof metadata.asset === 'string' && metadata.asset.toUpperCase() === 'CASH'
        ? 'CASH'
        : 'USDC';
    const { mint, tokenProgram, decimals } = resolveMint(asset);
    const recipient = metadata.recipient || DEFAULT_MERCHANT_WALLET;
    const amount = Number(metadata.amount || 0);
    const atomicAmount = BigInt(Math.max(1, Math.round(amount * 10 ** decimals))).toString();
    const reference = metadata.reference || crypto.randomUUID();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    if (protocol === 'x402') {
      return {
        success: true,
        challenge: {
          x402Version: 2,
          protocol: 'x402',
          scheme: 'exact',
          network: SOLANA_CAIP2_NETWORK,
          cluster: SOLANA_CLUSTER,
          asset,
          mint,
          tokenProgram,
          decimals,
          amount,
          maxAmountRequired: atomicAmount,
          payTo: recipient,
          recipient,
          reference,
          resource: metadata.resource || '/mcp',
          description: metadata.description || 'Pabandi verified service & trust settlement',
          expiresAt,
          acceptedAssets: [
            { asset: 'USDC', ...resolveMint('USDC') },
            { asset: 'CASH', ...resolveMint('CASH') },
          ],
        },
      };
    }

    const params = new URLSearchParams({
      amount: String(amount),
      'spl-token': mint,
      label: 'Pabandi Trust Escrow',
      message: metadata.description || `Ref ${reference}`,
    });

    return {
      success: true,
      checkoutUrl: `solana:${recipient}?${params.toString()}`,
    };
  }
}
