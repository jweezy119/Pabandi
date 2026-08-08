/**
 * Base adapter interface for treasury provider integrations.
 * Pabandi is provider-agnostic: swap SIMULATOR for MELD/STRIPE_TREASURY/BRIDGE later
 * without touching the orchestrator or any downstream code.
 */

export type FiatCurrency = 'USD' | 'EUR' | 'GBP';

export interface VirtualAccountDetails {
  routingNumber: string;
  accountNumber: string;
  bankName: string;
  currency: FiatCurrency;
}

export interface SweepResult {
  success: boolean;
  txHash?: string;
  amountStable: number; // e.g. USDC minted/sent
  destinationWallet: string;
  simulated: boolean;
  error?: string;
}

/**
 * Every provider (Meld, Bridge, Stripe Treasury, or our simulator) implements this.
 */
export interface ITreasuryAdapter {
  readonly providerName: string;

  /** Open a virtual bank account tied to a Pabandi user. */
  issueVirtualAccount(userId: string, currency?: FiatCurrency): Promise<VirtualAccountDetails>;

  /** Incoming fiat wire handler (called by webhook or simulation). */
  handleIncomingWire(accountId: string, amountUsd: number): Promise<{ accepted: boolean }>;

  /** Convert held fiat to on-chain stablecoin and send to destinationWallet. */
  sweepToWeb3(amountUsd: number, destinationWallet: string): Promise<SweepResult>;
}
