/**
 * Single-Wallet Treasury Architecture
 * ===================================
 *
 * THE MODEL:
 * =========
 * One platform wallet (your Phantom) funds everything.
 * All disbursements, collections, and recycling happen from this single address.
 * Internal accounting tracks every dollar across buckets.
 *
 * WALLET BREAKDOWN:
 * ================
 *
 * Platform Wallet (Phantom address: 0x5d838a...)
 * ├── OPERATING    — funds available for agent projects
 * ├── AGENT_ESCROW — funds locked in active projects
 * ├── PLATFORM_REV — fees collected (2% of each tx)
 * ├── YIELD        — DeFi yield earned on idle capital
 * └── RESERVE      — emergency fund (5% of revenue)
 *
 * FLOW:
 * =====
 * 1. You fund: USDC/SOL → platform wallet
 * 2. System records: +$X to OPERATING
 * 3. Agent project funded: OPERATING → AGENT_ESCROW (-$X)
 * 4. Agent completes: AGENT_ESCROW → agent wallet (-$X + 2% fee)
 * 5. Fee collected: → PLATFORM_REV (+$Y)
 * 6. Recycle: PLATFORM_REV → OPERATING (profits fund more projects)
 *
 * API ENDPOINTS (mounted at `/api/v1/treasury`):
 * - `GET  /address` — get platform wallet public address
 * - `POST /fund` — record incoming funds {amountUsd, txHash, note}
 * - `GET  /breakdown` — get bucket balances
 * - `POST /recycle` — move revenue back to operating {amountUsd}
 * - `POST /reserve` — allocate to emergency reserve {amountUsd}
 *
 * SERVICE: `server/src/services/singleWalletTreasury.service.ts`
 * - `fundWallet({ amountUsd, txHash, note })` — record incoming funds
 * - `disburseToAgent({ agentId, projectId, amountUsd, platformFeeUsd, txHash })` — pay agent, collect fee
 * - `collectRevenue({ amountUsd, source, referenceId, txHash })` — record fee/yield/arbitrage
 * - `lockInEscrow({ projectId, agentId, amountUsd })` — move to escrow
 * - `recycleProfitsToOperating({ amountUsd })` — revenue → operating
 * - `allocateToReserve({ amountUsd })` — revenue → emergency
 * - `getFullBreakdown()` → { operating, agentEscrow, platformRevenue, yield, reserve, total }
 *
 * CONTROLLER: `server/src/controllers/singleWalletTreasury.controller.ts`
 *
 * GOING LIVE:
 * ==========
 * 1. Set `PLATFORM_WALLET_ADDRESS=<your-phantom-public-key>` in Render env
 * 2. Fund the wallet with USDC on Solana
 * 3. Record funding via POST /treasury/fund
 * 4. System handles the rest: disbursements, fees, recycling
 * 5. Revenue accumulates in PLATFORM_REV, recycle to OPERATING for velocity
 *
 * WHAT'S STILL NEEDED:
 * - Solana SPL token transfer integration (actual on-chain USDC movement)
 * - Phantom wallet adapter on frontend for transaction signing
 * - Agent wallet addresses must be valid Solana addresses (not dummy values)
 *
 * CURRENT STATE:
 * - Internal accounting is fully functional
 * - All demo/simulation scripts work end-to-end
 * - No real on-chain transactions yet — that requires SPL token integration
 *
 * SAFETY:
 * - Private key NEVER leaves the client
 * - Backend only knows public address
 * - All internal ledger entries are immutable (TreasuryPosition rows)
 * - Full audit trail for every dollar
 */
export declare const singleWalletReference: {
    version: string;
    model: string;
};
//# sourceMappingURL=singleWalletTreasury.reference.d.ts.map