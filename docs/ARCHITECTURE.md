# Pabandi Architecture Whitepaper

Deep technical architecture for the Pabandi settlement and trust layer. This document covers the ML efficiency theory, compute energy economics, and protocol-level mechanisms that power the platform.

---

## 1. The Iron Law of Agent Commerce

Every autonomous agent transaction faces a trilemma: **speed, trust, and cost**. You can optimize for any two, but never all three.

- **Speed**: Sub-second settlement requires optimistic execution (trust first, verify later).
- **Trust**: Verified identity and escrow-backed funds require synchronous checks that add latency.
- **Cost**: On-chain settlement for every micro-payment is prohibitively expensive.

Pabandi resolves this trilemma through **Session Abstraction**: a human or parent agent authorizes a budget (e.g., $50 for 24 hours), and sub-agents make unlimited API calls within that budget, settling the aggregated final state on Solana in a single transaction. The Iron Law is not broken — it is deferred, aggregated, and netted.

---

## 2. Amdahl's Law and the Session Bound

Amdahl's Law states that the speedup of a system is limited by its sequential fraction. In Pabandi, the sequential fraction is the **on-chain settlement**. Every on-chain transaction is a serial bottleneck.

By aggregating N micro-payments into a single session settlement, Pabandi reduces the sequential fraction from N transactions to 1. The theoretical speedup approaches N× as session depth increases. This is why Session Abstraction is the foundational primitive: it turns O(N) on-chain cost into O(1).

---

## 3. Jevons Paradox and Compute Energy

Jevons Paradox observes that increasing the efficiency of resource use tends to *increase* total consumption, not decrease it. Applied to AI agents: as MCP tool calls become cheaper and faster, agents will issue *more* calls, potentially overwhelming the server and draining compute budgets.

Pabandi mitigates this through **Compute Energy Quotas**:

- **Arbitration Execution Timeout**: Sulha AI calls are bounded by a 5-second Promise.race. On timeout, disputes escalate to human review rather than blocking indefinitely.
- **Small-Escrow Bypass**: Escrows below $10 bypass AI entirely and go directly to human review — the compute cost is not worth it.
- **Rate Limiting**: MCP and x402 endpoints are capped at 60 requests per minute per API key, returning 429 with an enterprise upsell message when exceeded.

These bounds ensure that efficiency gains do not translate into unbounded consumption.

---

## 4. Training-Serving Skew and Data Normalization

A critical source of model inaccuracy is training-serving skew: when features computed during training differ in type or scale from features served at inference.

Pabandi enforces **integer time metrics** across all AI-bound data:

- `account_age_days`: stored and passed as an integer (days), never a float
- `booking_frequency`: stored as an integer (bookings per 30 days)
- `days_since_activity`: integer days since last agent activity
- `days_since_commit`: integer days since last GitHub commit

All TrustPassport generation and Jev security scoring paths normalize time-based metrics to integers before passing them to the AI. This eliminates a class of silent skew bugs where a 0-100 scale value leaked into a 0-1000 field (or vice versa), causing incorrect tier gating.

---

## 5. Sulha: AI Dispute Resolution with OS Scheduler Metaphor

When a buyer rejects delivered work, funds are frozen and the case enters Sulha arbitration:

1. **EvidenceBundle**: Structured input (jobId, buyerClaim, sellerProof, oracleData) validated via Zod.
2. **Jev (Sulha AI)**: Reviews the evidence with the strict prompt: *"Review this evidence. Issue a verdict: RELEASE to seller, or REFUND to buyer. Provide reasoning."*
3. **Confidence Threshold**: >90% confidence → auto-execute (escrow released or refunded). ≤90% → escalate to human panel.
4. **Compute Quota**: 5-second timeout. On timeout → "OS Scheduler shift to Human User Space" (human review).
5. **Small Escrow Bypass**: <$10 → human review directly, no AI compute spent.

---

## 6. ERC-7710 Delegated Budgets

Replacing custom sessions with bounded ERC-7710 delegations:

- **MaxAmount**: Session budget cap (e.g., 50 USDC)
- **Expiry**: Session lifetime (e.g., 24 hours)
- **AllowedContracts**: Restrict agent to Pabandi Escrow contract only

Delegations are modeled in the database (`AgentDelegation`) with idempotent SHA-256 IDs. Every spend verifies caveats and debits `spentCents` atomically before touching the engine.

---

## 7. PabandiOS Module Architecture

| Module | Target User | Description |
| :--- | :--- | :--- |
| **ContactOS** | Businesses (Pro Mode) | CRM, pipeline, invoicing, escrow-backed deposits |
| **BookingOS** | Consumers (Standard Mode) | Public booking engine, GPS-verified check-in release |
| **Agent Marketplace** | AI Agents & Devs (M2M) | Bounties, bids, red-team gigs, auto-verifiable tasks |
| **TrustOS** | The Protocol | Trust Scores, VCAP, M2M API routing, session abstraction |

---

## 8. Security & Rate Limiting

- MCP and x402 endpoints: 60 requests/minute per API key
- 429 response: "Rate limit exceeded. Please upgrade to an Enterprise plan for higher limits."
- Rate limiters mounted before heavy AI logic to block traffic early
- API key-based key generation where available, IP-based fallback
