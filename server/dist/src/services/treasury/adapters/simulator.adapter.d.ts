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
import { FiatCurrency, ITreasuryAdapter, SweepResult, VirtualAccountDetails } from './base.adapter';
export declare class SimulatorAdapter implements ITreasuryAdapter {
    readonly providerName = "SIMULATOR";
    issueVirtualAccount(userId: string, currency?: FiatCurrency): Promise<VirtualAccountDetails>;
    handleIncomingWire(accountId: string, amountUsd: number): Promise<{
        accepted: boolean;
    }>;
    sweepToWeb3(amountUsd: number, destinationWallet: string): Promise<SweepResult>;
}
//# sourceMappingURL=simulator.adapter.d.ts.map