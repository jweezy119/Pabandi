# Whitepaper ↔ code reconciliation

Every claim in whitepaper v4.0 checked against the codebase, with the evidence.
The point is not to score the paper — most of it is real and well-designed — but
to find the places where a reader who *checks* would find a different answer.

**Status key:** ✅ built and verifiable · ⚠️ real but materially overstated ·
❌ not what the paper says · 🔵 not built yet

---

## Addendum — finding #2 is now closed in the paper

This document is kept rather than deleted, on purpose: the fact that we shipped a
paper describing four models that did not exist, and that an internal review
caught it before a customer did, is part of the record. A trust product's
credibility is not something we get to assert; it is something a reader can
check. Editing the finding away would remove the checkable part.

**Finding #2 (the four AI models) has been resolved in `whitepaper.md`.** §9.3 now
describes the weighted ensemble that actually computes the score, with the
formula, the weights and a worked derivation for each example. §9.3.1 demotes the
four models to a roadmap and attaches the gate they have to clear.

What changed underneath, because it is the part that makes the paper true rather
than merely reworded:

- `reliabilityScore` had seven writers on three scales. There is now one
  (`trust-core.service.ts`) on one scale (0–100), and a test that fails if a
  second writer appears.
- The specific harm this document predicted — "perfectly calibrated" being a
  testable claim that a delta table cannot satisfy — is gone. We no longer claim
  calibration anywhere.
- The fix this document recommended, *"lead with explainability rather than model
  count,"* is what §9.3 leads with.

**The gate is weaker than it sounds, and the paper says so.** The holdout set is
five labelled examples. That is enough to pin the baseline and not enough to
evaluate a model against it — `expertHoldoutGate.test.ts` contains a test
recording that its own aggregate metric does not catch an expert that ignores
payment behaviour. That finding is published in the paper rather than resolved
quietly, because the honest version of "each expert must beat the baseline" is
"each expert must beat the baseline, on a holdout set we have not built yet."

---

## Summary

| | Count |
|---|---|
| ✅ Claims that hold | 14 |
| ⚠️ Real, overstated | 5 |
| ❌ Contradicted by the code | 4 |
| 🔵 Roadmap, not yet built | 6 |

The four ❌ are the ones that matter. Three are consumer-facing guarantees about
money and one is a compliance claim about religious finance.

---

## ❌ Contradicted by the code

### 1. Escrow does not hold funds

> **§16 FAQ:** *"Is my money safe? Escrow is held in audited Solana smart
> contracts. No one — including Pabandi — can move funds without meeting the
> conditions."*
>
> **§2:** *"Deposit releases instantly when you check in."*
>
> **§11.6:** *"Funds are locked on-chain... Release is automatic when conditions
> are met."*

**Reality.** Deposits are collected into the **merchant's own Square account**.
`resolveSquareCredentials` (`square-connection.service.ts:144`) prefers the
merchant's OAuth token over the platform token, and the payment link is created
against that merchant's credentials. `UniversalEscrow` is a row with a `status`
column; no transfer occurs on any transition.

**Release is not automatic.** `releaseOnAttendance` requires a *verified*
check-in and a buyer or admin action. An unverified check-in routes to
`disputed` deliberately.

**Why it matters.** This is the strongest safety claim in the paper and it is the
one a merchant or regulator would test first. It is also the reason the codebase
was designed the way it is: merchant-owned means no custody, no float, no
money-transmitter exposure — the deliberate choice given zero capital. **The
architecture is right; the sentence is wrong.**

**Fix.** "Deposits are collected by the business's own payment account. Pabandi
records the commitment and the evidence behind every decision, and never handles
the funds itself." Then add the deposit-protection explainer as a feature rather
than a custody claim.

---

### 2. The four AI models do not exist

> **§7:** *"Instead of one mysterious algorithm, we use four specialist models
> that vote on your score. Expert 1: Pattern Detective (Gradient Boosted Trees)...
> Expert 2: Memory Keeper (Temporal Graph Neural Network)... Expert 3: Subtle Cue
> Catcher (Wide & Deep Neural Network)... Expert 4: Fair Arbiter (Calibrated
> Meta-Learner)... Perfectly calibrated — if it says 30% risk, that means exactly
> 30%, no more, no less."*

**Reality.** A deterministic delta table (`trust/trust-core.ts:79`):

```ts
'invoice.paid_on_time': { field: 'paymentScore',  delta: +10 },
'booking.no_show':     { field: 'showUpScore',   delta: -20 },
'delivery.missed':     { field: 'deliveryScore',  delta: -20 },
```

`trustFlux.service.ts` is a time-series utility, not an ensemble. No GBT, no
GNN, no Wide & Deep, no meta-learner.

**Why it matters.** "Perfectly calibrated" is a testable claim and it is the one
line most likely to be checked by anyone technical who reads the paper. A delta
table is *explainable* — which is a genuine and marketable property — but it is
not calibrated, and no amount of arithmetic on a 0–1000 scale makes it so.

**Fix.** Lead with explainability rather than model count: *"Every score change is
a named, auditable event with a fixed weight. A customer can see exactly which
action moved their score and by how much."* That is true today and arguably a
stronger selling point for a trust product than four black boxes.

---

### 3. The deposit table does not match the code

> **§4:** *Score 70–100 → 0% · 40–69 → 5–15% · 0–39 → 20–50%. "Never more than
> 50% deposit."*

**Reality** (`config/deposit-policy.rules.ts`, thresholds on a 0–1000 scale):

| Band | Score | Multiplier |
|---|---|---|
| A | 800+ | 0 |
| B | 600+ | 0.5 |
| C | 400+ | 1.0 |
| D | <400 | **1.25** |

Three separate problems: different thresholds, a different mechanism (multiplier
on the business's base rather than a percentage of service value), and **1.25
violates the paper's own "never more than 50%" ceiling.**

**Also contradictory on its face:** §2 promises *"We never make you feel guilty
for a high deposit"* while §4 mandates 20–50% for a score under 40.

**Fix.** Publish the table that is implemented, drop the "never more than 50%"
line (it is not true), and reconcile the "no guilt" promise with whatever the
real floor is.

---

### 4. Mudarabah profit-sharing is described but not implemented as stated

> **§12:** *"Pabandi collects 0.5% escrow commission + API fees into the epoch
> pool... Reward = Pool × (Your Stake / Total Staked)"*

**Reality.** `MudarabahPool`, `MudarabahInvestment`, `MudarabahProfitDistribution`
exist, so the structure is real. But:

- The formula **was** over-paying and is only now correct — a pool of $15,000
  with 3 PAB staked paid each of ten holders $50, claiming $500 against $150.
  Fixed in `distributeEpochCents`, which pays from a running remainder.
- The reward *source* is specified as escrow commission. The escrow commission
  does not exist — fees are a 3.5% platform fee (`config/fees.ts`), and the 0.5%
  figure is `X402_PRICING.ESCROW_INITIATION`, an x402 API price.

**Why it matters.** AAOIFI Standard 13 is a *compliance* claim with real
governance behind it. Describing a revenue source that does not exist is the kind
of thing a Shariah scholar, an auditor, or a securities regulator would find, and
"AAOIFI compliant" is not a marketing phrase to leave loose.

**Fix.** Either implement the epoch funding from actual revenue, or restate: the
pool is funded from **30% of net platform revenue** (subscriptions + fees), which
is what `STAKING_POOL_BPS` now models. Have the compliance claim reviewed by
someone qualified before publication.

---

## ⚠️ Real, but materially overstated

### 5. Supply and emission

The 1B supply is now real and checkable — `config/pab-supply.ts`, with
`assertAllocationsReconcile()` proving the tranches sum to both 10,000 bps and
1,000,000,000 tokens.

**The emission rate is not implementable as written.** §12 gives
10 → 5 → 2.5 → **1.25**. A 1.25 award cannot be added to a wallet holding whole
tokens without a rounding rule, and that rounding rule is exactly where "fixed,
no further minting" becomes "fixed, plus dust". Implemented as 2 → 1, preserving
the halving shape.

**The flywheel figure is wrong by twelvefold.** §12: *"1,000 merchants × $2,000
average volume → $144K/year in PAB buyback."* Its route is
`1,000 × $2,000/mo = "$24M/month = $288M annual"`. That is **$24M/year**. It then
assumes a 0.5% platform fee, which the schedule no longer uses because 0.5% loses
money against a 2.9% processor.

Corrected at the real 3.5%: **$24M/year volume → $840,000 fees → $84,000 buyback.**

### 6. Tenant isolation

> **§15:** *"Tenant isolation: Every query filtered by businessId via Prisma
> extension."*

The extension exists (`src/lib/prisma-tenant.ts`) and is wired in
`src/lib/prisma.ts`. But `src/routes/bookings.routes.ts` contains **20 unscoped
`where: { id }` lookups**, and ownership is checked in handlers rather than
enforced by the data layer. The mechanism is described as a guarantee; it is
currently a helper that depends on every call site remembering to use it.

### 7. "No risk bands" vs. bands

§11.2 promises Low/Medium/High risk bands with ZK proofs. `pabandiTools.service.ts`
describes a real Noir circuit and there are 25 files touching `zk`. This is
genuinely further along than most, but the paper presents it as shipped across all
agents.

### 8. Badge distribution

§8 calls every embedded badge "a free distribution channel for Pabandi." The
endpoint is real (`routes/badge.routes.ts`). "Free distribution channel" is an
assertion about growth that has not been demonstrated.

### 9. Uptime and support commitments

§19 promises 99.9% uptime on paid tiers and *"a real human fixes it within 24
hours."* Neither is measurable from the codebase, and both are contractual.

---

## ✅ Claims that hold

These are real and verifiable, and several are genuinely strong:

| Claim | Evidence |
|---|---|
| Onchain attestations | `onchain-attestation.service.ts` — `sendTransaction` + `confirmTransaction`, Solscan link |
| Scoped scores (5 dimensions) | `TrustPassport` — payment, show-up, delivery, tenancy, freight |
| Context-scoped scoring | `trust-core.ts` keys deltas by context; fraud transfers globally |
| Mudarabad *structure* | `MudarabahPool`, `MudarabahInvestment`, `MudarabahProfitDistribution` |
| x402 payments | `x402.service.ts`, live pricing, USDC on Solana |
| MCP server | 21 files; `mcpHandler` mounted |
| Trust API | `/trust/resolve`, `/trust/score`, `/bulk-check`, `/trust/credential` |
| Badge endpoint | `routes/badge.routes.ts` — real SVG |
| Sign in with Pabandi | `routes/oauth.routes.ts` |
| Verifiable credentials | `/.well-known/pabandi-keys.json` |
| Fixed supply, checkable | `config/pab-supply.ts`, reconciled in tests |
| Clamodularity | Prisma models per vertical, `Business.category` enum |
| Fee engine | `config/fees.ts`, profitable at every size $5–$50,000 |

---

## 🔵 Roadmap — honest, but not built

| Claim | Reality |
|---|---|
| A2A messaging (§11.3) | **Zero files.** No discovery, negotiation, or cryptographic commitment |
| Four scoring models (§7) | Delta table (see ❌2) |
| DeFi reputation lending | Not started |
| Insurance partnership | No code |
| Anonymised data insights | No code |
| Multi-chain | Solana only |

§17's roadmap dates these to Q1–Q4 2027, so the roadmap is honest. The issue is
that §11 and §13 present them as current capability.

---

## What I'd fix before this goes to anyone

**Non-negotiable — these are consumer-facing money guarantees:**

1. The escrow claim. Say what actually happens.
2. The "never more than 50%" line, which the code violates.
3. The 2.5 → 1.25 emission, which cannot be implemented as written.

**Before a technical reader:** the four AI models, and the tenant-isolation
guarantee.

**Before an investor:** the $144K flywheel figure and the Mudarabah revenue
source. Both are one division away from a much larger claim than the business
supports.

**One structural suggestion:** the paper's voice shifts between what is built,
what is planned, and what is desired. Three explicit labels — *shipped*,
*in progress*, *roadmap* — would let it keep the ambition without the exposure.
Most of the ❌ items are a shipped/planned boundary problem, not a substance
problem.

---

## Keeping this honest

`GET /api/v1/tokenomics/summary` is public and reports `reconciles`, so anyone can
verify the supply arithmetic rather than taking it on trust.

For the rest, the durable fix is a CI check that fails when a documented figure
changes without the code changing with it. The tests in `tests/pab-supply.test.ts`
already assert both the correct flywheel figure and the incorrect one, so neither
can quietly replace the other.
