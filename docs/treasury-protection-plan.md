# Treasury Yield & Coin Price Protection Strategy
## Current State
- PAB rewards already mint into `Wallet.balance` via `CryptoService.creditPab()`.
- `StakingController` has placeholder `12.5%` yield and only tracks positions in local DB.
- No treasury vault, no price-defense automation, no quantitative rebalancing.

## Layer 1 — Treasury Vault (Implementable Now)
### A. Platform Fee Tribute
- Deduct 5-10% of **every PAB fee/reward mint** as platform revenue.
- Credit this tribute to a new `treasuryWallet` account instead of user/owner.
- Schema addition:
  ```prisma
  model TreasuryPosition {
    id          String   @id @default(cuid())
    createdAt   DateTime @default(now())
    updatedAt   DateTime @updatedAt
    bucket      String   // TREASURY | LP_PROVISION | YIELD_REINVEST | EMERGENCY
    amount      Float
    txHash      String?
    status      String   @default("PENDING")
    meta        Json?
  }
  ```
- Routes to add in `server/src/routes/treasury.routes.ts`:
  - `POST /api/v1/treasury/tribute` — internal service call only.
  - `POST /api/v1/treasury/deploy-yield` — moves idle cash into yield-generating instruments.
  - `GET /api/v1/treasury/summary` — admin only, used by dashboard.

### B. Split Into Operative Buckets
1. **OPERATING** — 20% kept in stablecoins/USDC in hot wallet for payouts and daily ops.
2. **TREASURY** — 30% stays idle as defense reserve.
3. **LP_PROVISION** — 25% sent to Solana PAB/USDC liquidity pool.
4. **YIELD_REINVEST** — 25% sent into low-risk yield instruments (see Layer 2).

## Layer 2 — Yield Engines (Partial Now, Full Requires External)
### A. Conservative Base (no external integrations needed)
1. **Stablecoins/Neutral Yield**
   - Route idle PAB proceeds to USDC/USDT lending pools on Solana (e.g., Solend, MarginFi, Drift) with auto-compound.
   - Risk: Very low if bluechip pools, smart-contract risk still exists.

2. **PAB/USDC Liquidity Pool**
   - Provide liquidity on Raydium or Orca.
   - Capture swap fees (~0.1-0.3% per trade).
   - Maintain a **price-ratio guard**: never let PAB fall below minimum liquidity depth.

### B. Quantitative Layer (External Integration)
3. **Quantitative Rebalancer**
   - Use a **lower-volatility crypto market-making strategy** on orderbook edges.
   - System continuously rebalances between stable assets and PAB liquidity to capture spread while protecting price floor.
   - Implementation: off-chain Python script with exchange API credentials stored in `OPENWA_API_KEY` or separate `QUANT_API_KEY` env var.

4. **Trend-Following / Mean-Reversion**
   - When PAB price moves outside 2 std devs from 30-day moving average, system automatically:
     - **Buys back** from treasury if below lower band (price support).
     - **Takes profit** into stablecoins if above upper band (defense).

### C. Quantum-Inspired / Quantum-Resistant Layer (Longer Horizon)
5. **Monte Carlo Stress Testing**
   - Run quarterly simulations with 10,000 scenarios.
   - Optimize allocation mix so wealth preservation stays >95% under historical crashes (COVID, Luna, FTX).
   - Triggers manual policy changes after quarterly review.

6. **Quantum-Resistant Custody**
   - Store treasury private keys in a **quantum-resistant wallet** (e.g., ECDSA on BLS12-381 or Dilithium-backed multisig).
   - Prevents future quantum-decryption attacks on Pabandi’s treasury reserves.
   - This is defense-in-depth, not revenue-generating, but critical for long-term trust.

## Layer 3 — Price Defense “Kill Switch”
### A. Circuit Breakers
1. **Treasury Buyback Trigger**
   ```
   IF price < floor_price AND treasury > buffer THEN
       Execute market buy with 10% of OPERATING bucket
   END
   ```
   - Floor price: dynamic, e.g., `last_7day_avg × 0.90` with guard against cascades.

2. **LP Replenishment**
   - If LP depth ratio drops below `2.0`, inject extra funds from `LP_PROVISION` bucket.

3. **Stop-Loss on Yield Instruments**
   - If any yield instrument returns < 0% over 30 days, rotate capital to next instrument.

### B. Anti-Fraud / Anti-Drain
1. **Velocity Limit**: maximum 3% of treasury spendable per hour.
2. **Multisig**: every treasury action requires ≥ 2 approvals (CEO + CTO).
3. **Liveness Proof**: weekly snapshot of balances shown to auditors/community.
4. **Replay / Timelock**: 4-hour timelock before any large action executes.

## Implementation Sequence
| Phase | What | Files To Touch | Time |
|---|---|---|---|
| 1 | Treasury DB schema | `server/prisma/schema.prisma` | 30 min |
| 2 | Treasury routes + controller | `server/src/routes/treasury.routes.ts`, `server/src/controllers/treasury.controller.ts` | 2h |
| 3 | Platform fee tribute in `CryptoService` | `server/src/services/cryptoService.ts` | 1h |
| 4 | Dashboard wallet integration | `client/src/pages/WalletDashboard.tsx` | 1h |
| 5 | Stablecoin yield router | new `server/src/services/yield.service.ts` | 2h |
| 6 | Price-feed cron + circuit break | `server/src/cron/treasury-cron.ts` | 2h |
| 7 | Quant script (optional, external) | new `tools/quant_rebalancer.py` | 3h |
| 8 | Quantum-resistant custody audit | docs/contracts research | external |
| **Total** | | | ~12h internal |

## Risks
- Smart-contract exploits on LP/yield protocols.
- Impermanent loss during PAB volatility spikes.
- Regulatory risk if treasury is seen as unlicensed investment fund.
- Quantum resistance only protects against future attacks, not current price.

## Revenue Estimate at $16 Coin Price with $100k Treasury
| Instrument | APY | Risk | Est. Annual |
|---|---|---|---|
| Blue-chip stable yield | 5-12% | Low | $5k–$12k |
| PAB/USDC LP fees | 10-30% | Medium | $10k–$30k |
| Quant market making | 15-40% | Medium-High | $15k–$40k |
| **Total** | | | **$30k–$82k/year** |

This additional revenue can be used for:
1. Buyback/burn to support price.
2. Ecosystem incentives to burn more PAB over time.
3. Covering operating costs without minting more tokens.
