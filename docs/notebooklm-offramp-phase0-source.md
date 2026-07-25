# Phase 0 Video Overview Source — Offramp Links v1 + AI Payment-Proof Verifier
**For NotebookLM consumption only. Internal.**

---

## Executive Summary
Pabandi is building a real offramp: USDC in, PKR out, no 45-minute P2P drama, no screenshots-with-your-cousin-as-witness. We replace "trust me bro" with a smart contract and a Qwen vision model that reads Raast receipts better than your aunt reads bank SMS forwards.

---

## The Problem We're Solving
Pakistani freelancers currently do this dance:
1. Open Binance P2P.
2. Hope the merchant isn't a scammer.
3. Send USDC.
4. Screenshot the payment.
5. Screenshot the merchant's "sent."
6. Screenshot the Raast notification.
7. Screenshot the merchant saying "bro, wait 5 min."
8. Screenshot their own soul leaving their body.
9. Wait 20–40 minutes.
10. Finally get PKR.

We compressed steps 1–10 into: customer requests intent, LP sends PKR, AI verifies receipt in 10 seconds, USDC releases. That's it.

---

## The "Do Not Publish" Rule
This plan is execution-ready only. No marketing. No public leaks. All risk controls remain internal.

---

## Architecture Change
We are deleting the setTimeout(..., 3000) mock. There is no going back.

### Models
- **OfframpIntent** — the customer's "I want $500 to my JazzCash" order. Tracks amount, destination, FX rate, status, and whether it's still alive or expired.
- **OfframpProof** — the LP's "I sent it, here's the receipt" submission. Stores base64 image, AI parse result, confidence score, and acceptance state.
- **LiquidityProvider** — the local market maker. Tracks wallet, PKR accounts, collateral, trust score, tier, daily limits, and whether they're allowed in the cafeteria.

### State Machine
PENDING_LP -> MATCHED -> PROOF_SUBMITTED -> SETTLED
                -> REFUNDED (no LP found)
                -> EXPIRED   (everyone fell asleep)

---

## The AI Verifier (Alibaba/Qwen, not Google)
We already have DASHSCOPE_API_KEY wired up. We're using Qwen2-VL to read the LP's payment proof screenshot.

The model gets:
- the base64 image
- the expected amount in PKR
- the expected destination

The model returns strict JSON:
- transfer_amount_number
- recipient_account_or_raast
- bank_or_wallet_name
- currency
- transaction_date_or_time

If anything doesn't match, the proof is rejected. The LP gets to try again. The customer never loses funds.

Fallback: no API key = deterministic stub validator for CI. No exceptions, no excuses.

---

## API Endpoints
- POST /api/v1/offramp/intent — Customer requests an offramp, gets a PKR quote, USDC locks.
- POST /api/v1/offramp/lp/submit-proof — LP uploads receipt image, AI verifies, contract either releases or rejects.

Both are real routes. No mock responses. No "demo mode" if DEMO_MODE=false.

---

## Income Mechanics Built Into Phase 0
Every successful settlement instantly records:
- Protocol fee: 0.85%
- Split ledger: treasury_protocol, lp_reward, yield_reserve
- Provenance hash for FBR reconciliation later

Target flow time:
- Intent -> LP match: 30 seconds p50
- Proof submit -> AI verify: 10 seconds
- End-to-end: 60 seconds p90

If it takes longer, smart contract refunds protocol fee automatically. Customer wins. LP still gets paid. We still look honest.

---

## Execution Sequence
1. Add Prisma schema for OfframpIntent, OfframpProof, LiquidityProvider.
2. Build Qwen-VL payment verifier.
3. Build offramp state machine (service).
4. Add controller + routes.
5. Wire into index.ts.
6. Type-check and migrate.
7. Deploy.
8. Recruit 1 LP, 5 beta freelancers, burn the mocks.

---

## Tone Notes for Scriptwriter
This isn't a charity demo. This is a protocol that makes money by removing the middleman between "I sent crypto" and "did I actually get paid?" The narration should feel like explaining to a friend why Binance P2P is a scammer's paradise and how a 10-second AI check replaces the 45-minute scream fest.

Sarcasm targets:
- Screenshot culture as evidence.
- "Trust me, bro" reputation systems.
- The 20-minute P2P stare-down.
- P2P merchants named "CryptoKing99" with 10,000 trades and zero bank account.

Energy: fast, punchy, confident, slightly bitter about the status quo, excited about the code.
