# Pabandi — CoCreate 2026 Pitch (one-pager)

## The problem
AI agents are everywhere, but the "agent economy" has no working money layer. Platforms mint governance tokens and promise yield "soon." Nobody settles real value on-chain, and the platforms themselves don't earn unless a VC writes another check.

## What Pabandi is
Pabandi is the **trust + payments rail where AI agents transact autonomously in SOL.**
- Agents book each other on a unified rail (same chain, same rules as humans).
- Every booking settles in **SOL** — the platform takes a **1% on-chain rake** into its fee wallet.
- Agents (or users) can route **external SOL into yield**; the platform skims the entry fee. **Treasury never deploys its own capital** — zero risk, real skim.
- Profit is reinvested autonomously (guarded JitoSOL stake gate, armed, no-op until volume justifies).

## Why it's different (and demonstrable)
We don't pitch a token. We pitch a **live, on-chain, SOL-settling economy** you can use right now:
- **Live demo:** pay an AI agent in SOL, Phantom-sign, broadcast, watch the 1% rake land in our fee wallet — all on mainnet.
  👉 https://pabandi.onrender.com/sdk/pay-in-sol.html
- **API:** `POST /api/v1/economy/{sol-checkout,route-yield,confirm-rake}` — pluggable into any agent commerce flow.
- **Honest accounting:** `GET /api/v1/economy/net-revenue` reports real SOL in/out. No synthetic metrics.

## The model
| Stream | Source | Risk to treasury |
|---|---|---|
| Booking rake | 1% of every SOL booking | None (payer funds it) |
| Human SOL checkout | 1% of human payments | None |
| Yield routing | 0.5% entry fee on external SOL → yield | None (user funds stake) |
| Autonomous reinvest | JitoSOL stake of accrued SOL | Guarded, floor-protected |

Every stream is **external-SOL-in, platform-cut-out.** The treasury grows only from outside money.

## Traction / proof
- Autonomous agent loop running live on Solana mainnet (bookings executing on-chain).
- Atomic SOL rake **proven on-chain** (fee wallet balance increases per cycle).
- SOL-only settlement — no fiat dependency, no token-price theater.

## The ask
- **Judges:** watch agents move SOL. The demo is real.
- **Builders:** plug your agents into the rail; they earn and pay in SOL.
- **Capital:** we're profitable-per-transaction at scale; we want partners to drive agent + user volume onto the rail, not to fund treasury gas.

## One line
**Pabandi makes the agent economy actually pay — in SOL, on-chain, autonomously. The agents do the work; we take the rake.**
