/**
 * privy.service.ts — Server-side Privy integration
 *
 * Handles:
 * - Organization wallet creation via Privy API
 * - Webhook signature verification
 * - Gas sponsorship requests
 * - Wallet balance lookup
 */

import axios from 'axios';
import { logger } from '../utils/logger';

const PRIVY_APP_ID = process.env.PRIVY_APP_ID;
const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET;
const PRIVY_API_BASE = 'https://api.privy.io/v1';

if (!PRIVY_APP_ID || !PRIVY_APP_SECRET) {
  logger.warn('PRIVY_APP_ID or PRIVY_APP_SECRET not configured — Privy server features disabled');
}

export interface PrivyWallet {
  id: string;
  address: string;
  chain: string;
  status: 'active' | 'creating' | 'failed';
  organizationId?: string;
  createdAt: string;
}

export interface CreateOrgWalletPayload {
  organizationId: string;
  organizationName: string;
  chain?: string;
}

/**
 * Create an organization wallet via Privy API.
 * Returns the wallet address and Privy wallet ID.
 */
export async function createOrgWallet(payload: CreateOrgWalletPayload): Promise<PrivyWallet> {
  if (!PRIVY_APP_ID || !PRIVY_APP_SECRET) {
    throw new Error('Privy credentials not configured');
  }

  try {
    const resp = await axios.post(
      `${PRIVY_API_BASE}/organizations/${payload.organizationId}/wallets`,
      {
        chain: payload.chain || 'solana',
        organization_name: payload.organizationName,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${PRIVY_APP_SECRET}`,
          'Privy-Application-Id': PRIVY_APP_ID,
        },
      }
    );

    const wallet: PrivyWallet = {
      id: resp.data.data.id,
      address: resp.data.data.address,
      chain: resp.data.data.chain,
      status: resp.data.data.status,
      organizationId: payload.organizationId,
      createdAt: resp.data.data.created_at,
    };

    logger.info(`[Privy] Org wallet created: ${wallet.address} for org ${payload.organizationId}`);
    return wallet;
  } catch (err: any) {
    logger.error(`[Privy] Failed to create org wallet: ${err.message}`);
    throw err;
  }
}

/**
 * Verify a Privy webhook signature.
 * Returns true if the webhook is authentic.
 */
export async function verifyPrivyWebhook(
  body: Buffer,
  signature: string,
  timestamp: string
): Promise<boolean> {
  if (!PRIVY_APP_SECRET) return false;

  try {
    // Privy uses HMAC-SHA256 with the app secret
    const crypto = await import('crypto');
    const expectedSignature = crypto
      .createHmac('sha256', PRIVY_APP_SECRET)
      .update(`${timestamp}.${body.toString()}`)
      .digest('hex');

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  } catch (err) {
    logger.error(`[Privy] Webhook verification failed: ${err}`);
    return false;
  }
}

/**
 * Sponsor gas for a wallet via Privy API.
 */
export async function sponsorGas(walletAddress: string, chain: string = 'solana'): Promise<{ success: boolean; txHash?: string }> {
  if (!PRIVY_APP_ID || !PRIVY_APP_SECRET) {
    throw new Error('Privy credentials not configured');
  }

  try {
    const resp = await axios.post(
      `${PRIVY_API_BASE}/sponsorship`,
      {
        wallet_address: walletAddress,
        chain,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${PRIVY_APP_SECRET}`,
          'Privy-Application-Id': PRIVY_APP_ID,
        },
      }
    );

    return { success: true, txHash: resp.data.data?.txHash };
  } catch (err: any) {
    logger.error(`[Privy] Gas sponsorship failed: ${err.message}`);
    throw err;
  }
}

/**
 * Get wallet balance via Privy API.
 */
export async function getWalletBalance(walletAddress: string, chain: string = 'solana'): Promise<{ balance: string; unit: string }> {
  if (!PRIVY_APP_ID || !PRIVY_APP_SECRET) {
    throw new Error('Privy credentials not configured');
  }

  try {
    const resp = await axios.get(
      `${PRIVY_API_BASE}/wallets/${walletAddress}/balance`,
      {
        params: { chain },
        headers: {
          'Authorization': `Bearer ${PRIVY_APP_SECRET}`,
          'Privy-Application-Id': PRIVY_APP_ID,
        },
      }
    );

    return { balance: resp.data.data.balance, unit: resp.data.data.unit };
  } catch (err: any) {
    logger.error(`[Privy] Failed to get wallet balance: ${err.message}`);
    throw err;
  }
}
