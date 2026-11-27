# Pabandi × Webacy: Full-Stack Trust & Settlement for Autonomous AI Agents on Solana

> **NotebookLM Source Brief** — Upload or paste this document into NotebookLM to generate an Infographic, Slide Deck, or Audio Overview for LinkedIn, X, and investor/partner outreach.

## 1. The Core Problem
Autonomous AI agents can already browse services, schedule bookings, and initiate crypto payments. Yet moving real money between autonomous agents and real-world service businesses fails for two distinct reasons:
1. **Behavioral / Real-World Risk:** Small service businesses lose revenue daily to no-shows, unverified bookings, and payment disputes. On-chain wallet safety alone cannot tell you whether a counterparty actually shows up and honors commitments.
2. **On-Chain Counterparty Risk:** Reputation history alone cannot tell you whether a Solana wallet interacting with a non-custodial escrow smart contract is linked to a drainer, exploit, or OFAC-sanctioned entity.

**Key Takeaway:** Safe autonomous commerce requires **both** off-chain behavioral trust AND on-chain security screening before funds ever lock in escrow.

---

## 2. The Joint Architecture: Pabandi × Webacy
Pabandi (پابندی) — the trust and settlement layer for the service economy and autonomous AI agents — integrated **Webacy's Solana Risk Intelligence API** directly into its production backend on Solana.

### Dual-Layer Trust Stack
- **Layer 1 — Behavioral Trust (Pabandi Trust Protocol / PTP):**
  - Portable, cryptographically signed Trust Passports (Ed25519 / BBS+ disclosures).
  - Verified check-ins, completed escrow track record, and predictive no-show risk scoring.
  - Non-custodial Solana Anchor deposit/milestone escrow that releases only upon verified completion.
- **Layer 2 — On-Chain Safety (Webacy Risk Intelligence on Solana):**
  - Real-time Solana (`chain=sol`) wallet threat scoring (`0–100`), KYW (*Know Your Wallet*) checks, drainer detection, and OFAC/sanctions screening via `GET https://api.webacy.com/addresses/{wallet}?chain=sol`.
  - Protected by local Base58 PublicKey validation, 15-minute LRU caching (`max: 2,000` addresses), in-flight request deduplication, and 30 req/min/IP rate limiting.

---

## 3. How the Production Flow Works (Step-by-Step)
1. **Agent Discovery & Pre-Check (MCP):** An LLM or autonomous AI agent connects to Pabandi's Streamable HTTP Model Context Protocol (MCP) server (`https://pabandi.onrender.com/mcp`) and calls:
   - `pabandi_verify_passport` → verifies Pabandi behavioral trust disclosure.
   - `pabandi_screen_wallet` → queries Webacy on-chain Solana risk intelligence in one tool call.
2. **Public Trust Passport Enrichment:** Viewing any public Pabandi Trust Passport with a linked Solana wallet automatically displays live, cached `onchainRisk` data (`provider: "webacy"`, `overallRisk`, `riskBand`, `isSanctioned`, `checkedAt`) alongside behavioral reputation—never fabricating a clean score if unconfigured or unavailable.
3. **Pre-Escrow Solana Anchor Oracle Gate (`signInitializeEscrowTx`):**
   - Before Pabandi's Tier-1 Attestation Oracle co-signs a Solana Anchor `initialize_escrow` transaction, it enforces `assertSolanaWalletSafeForEscrow(customerWallet)`.
   - **Hard-Block Rule:** If Webacy flags `isSanctioned === true` OR `overallRisk >= 75` (`CRITICAL`), the oracle **immediately rejects co-signing** (`WebacyRiskBlockedError`), preventing compromised or sanctioned wallets from entering escrow.
   - **Graceful Resilience:** If Webacy's free-tier API temporarily returns HTTP `429` or times out, the oracle defaults to fail-open with a structured warning (configurable via `WEBACY_FAIL_CLOSED=true` for strict mode) so rate limits never freeze legitimate local bookings.
4. **Conditional Settlement:** Verified, safe escrows lock USDC non-custodially on Solana Anchor and release automatically upon verified completion/check-in, minting a public Paid Proof and raising the provider's portable Trust Passport score.

---

## 4. Live Production Proof Points
- **Clickable Live Screening Endpoint:** `https://pabandi.onrender.com/api/v1/agents/wallet/screen/F5W934e6qJb8z2GZJj3kGjUfN6xLqK4W7CpHbBvRmN3D`
- **Live MCP Endpoint:** `POST https://pabandi.onrender.com/mcp` (`pabandi_screen_wallet` tool)
- **Agent Spec & Discovery:** `https://pabandi.com/llms.txt`
- **Ecosystem Synergy:** Both Webacy and Pabandi build for Solana and support **x402 USDC** agentic settlement, creating a natural full-stack safety blueprint for autonomous AI commerce.
