/**
 * Simulated treasury adapter.
 *
 * Mirrors the real fiat-to-crypto flow (virtual account → incoming wire →
 * stablecoin sweep) WITHOUT any banking partner. Used for:
 *   - Local dev / demo
 *   - Building & testing the full Pabandi UI + DB ledger
 *   - Generating the profitability report end-to-end before connecting real rails
 *
 * Swap to the MELD / BRIDGE / STRIPE_TREASURY adapter later by changing one line
 * in the orchestrator — nothing else changes.
 */

import { logger } from '../../../utils/logger';
import { prisma } from '../../../utils/database';
import {
  FiatCurrency,
  ITreasuryAdapter,
  SweepResult,
  VirtualAccountDetails,
} from './base.adapter';

// Deterministic-but-unique fake routing/account numbers per user.
function fakeRoutingFor(userId: string): string {
  let h = 0;
  for (let i = 0; i < userId.length; i++) h = (h * 31 + userId.charCodeAt(i)) >>> 0;
  return String(100000000 + (h % 899999999)).padStart(9, '0').slice(0, 9);
}
function fakeAccountFor(userId: string): string {
  let h = 7;
  for (let i = 0; i < userId.length; i++) h = (h * 37 + userId.charCodeAt(i)) >>> 0;
  return String(100000000000 + (h % 899999999999)).padStart(12, '0').slice(0, 12);
}

export class SimulatorAdapter implements ITreasuryAdapter {
  readonly providerName = 'SIMULATOR';

  async issueVirtualAccount(
    userId: string,
    currency: FiatCurrency = 'USD'
  ): Promise<VirtualAccountDetails> {
    const details: VirtualAccountDetails = {
      routingNumber: fakeRoutingFor(userId),
      accountNumber: fakeAccountFor(userId),
      bankName: 'Pabandi Virtual Bank (Simulated)',
      currency,
    };
    logger.info(`[Simulator] Issued virtual account for ${userId}: ${details.routingNumber}/${details.accountNumber}`);
    return details;
  }

  async handleIncomingWire(accountId: string, amountUsd: number): Promise<{ accepted: boolean }> {
    // In the real adapter this is a webhook from the banking partner.
    // Here we just record intent; the orchestrator decides what to do.
    logger.info(`[Simulator] Incoming wire ${amountUsd} USD for virtual account ${accountId} (simulated)`);
    return { accepted: true };
  }

  async sweepToWeb3(amountUsd: number, destinationWallet: string): Promise<SweepResult> {
    // Simulated 1:1 USD→USDC conversion + on-chain send.
    // No gas, no real tokens — just ledger bookkeeping.
    logger.info(`[Simulator] Sweeping ${amountUsd} USD → ${amountUsd} USDC → ${destinationWallet} (simulated)`);
    return {
      success: true,
      txHash: `sim_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
      amountStable: amountUsd,
      destinationWallet,
      simulated: true,
    };
  }
}
