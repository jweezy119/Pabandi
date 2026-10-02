# Whitepaper v6.0 — Proposed Corrections

**Status: draft for review. This file replaces nothing.**

Companion to `docs/whitepaper-reconciliation.md`. That document records every claim in
v6.0 checked against the code, with evidence. This one contains rewritten prose for the
sections that failed, ready to drop in.

Why a separate file rather than editing `whitepaper.md`: three of these corrections change
the document's central claims. §16 is the escrow thesis and the strongest claim in the
paper; §7 is the technical credibility argument; §9.3 underpins the fairness promise.
Rewriting them is a positioning decision, not a copyedit. Nothing in `whitepaper.md` has
been modified.

Read `whitepaper-reconciliation.md` first — it has the file-and-line evidence for each
claim below.

---

## Shipped / in progress / roadmap

The single largest source of contradiction in v6.0 is that it does not distinguish these
three. Almost every discrepancy traces to a shipped feature being described in the present
tense as if designed but unbuilt, or a roadmap item described as if built.

Recommend a convention applied throughout:

| Label | Meaning |
|---|---|
| **Shipped** | In production. Named file and line in `whitepaper-reconciliation.md`. |
| **In progress** | Actively being built. Named, with a rough shape. |
| **Roadmap** | Intended. No date. Explicitly not a commitment. |

This preserves every ambition in the paper while removing the exposure. It is the cheapest
of the fixes here by an order of magnitude.

---

## §7 / §9.3 — The four AI models

### The problem

v6.0 §9.3 describes four specialist models voting on a score:

> **Expert 1: The Pattern Detective (Gradient Boosted Trees)**
> **Expert 2: The Memory Keeper (Temporal Graph Neural Network)**
> **Expert 3: The Subtle Cue Catcher (Wide & Deep Neural Network)**
> **Expert 4: The Fair Arbiter (Calibrated Meta-Learner)** — *"Perfectly calibrated: If it
> says 30% risk, that means exactly 30% — no more, no less"*

None of the four exist. What runs is a fixed delta table:

```ts
// server/src/trust/trust-core.ts:79
const deltaMap: Record<string, { field: string; delta: number }> = {
  'invoice.paid_on_time': { field: 'paymentScore', delta: +10 },
  'invoice.paid_late':   { field: 'paymentScore', delta: -5 },
  'invoice.overdue':     { field: 'paymentScore', delta: -15 },
  'delivery.on_time':    { field: 'deliveryScore', delta: +10 },
  'delivery.late':       { field: 'deliveryScore', delta: -5 },
  'delivery.missed':     { field: 'deliveryScore', delta: -20 },
  'booking.no_show':     { field: 'showUpScore', delta: -20 },
  'delivery.checked_in': { field: 'showUpScore', delta: +5 },
};
```

A separate `noShowPredictor` service does import `@tensorflow/tfjs` and looks more like the
paper's description. It is not. `this.model` is declared at line 95 and **never assigned** —
there is no `fit`, no `loadLayersModel`, no checkpoint. The ML branch is unreachable behind
`if (!this.isModelLoaded) return this.ruleBasedPrediction(...)` at line 161. The live path is
either a DashScope `qwen-turbo` API call or the rule-based fallback.

So: no ensemble, no training, and no calibration. The calibration claim is the one to cut
first — it is a quantitative promise about a system with no calibration stage, and it is the
sentence a technical reader will test.

### Correction

Replace the four models with what the system does, honestly. The delta table is genuinely
defensible: it is transparent, auditable, appeals are meaningful because the customer can
see every input, and it cannot silently drift. That is a real design choice, not a shortfall.

> ### 9.3 How Your Score Is Actually Computed
>
> We use a transparent scoring model, not a black box.
>
> Your Passport carries three scores — **Payment**, **Delivery**, and **Show-up** — each out
> of 1000. Every event adjusts them by a fixed, published amount:
>
> | Event | Change |
> |---|---|
> | Invoice paid on time | Payment **+10** |
> | Invoice paid late | Payment −5 |
> | Invoice overdue | Payment −15 |
> | Delivery on time | Delivery **+10** |
> | Delivery late | Delivery −5 |
> | Delivery missed | Delivery −20 |
> | Booking no-show | Show-up −20 |
> | Checked in | Show-up +5 |
>
> Scores are clamped to 0–1000. The deposit multiplier comes from the band your Show-up score
> puts you in (§9.4).
>
> **Why this way.** A published table is auditable in a way a model is not. You can see every
> input that moved your score, which is what makes the appeal in §9.5 meaningful. We will add
> learned components when we have enough check-in data to train and validate them, and we
> will not ship a probability we cannot honestly calibrate.

If the ensemble is genuinely planned, it belongs under **Roadmap** with the data requirement
stated — not as the current system.

---

## §9.4 — Deposit examples

### The problem

Three separate mismatches, not one:

1. **Mechanism.** v6.0 presents deposits as a percentage of the booking *derived from risk*.
   The system applies a **band multiplier** to a **base deposit the merchant sets**. The
   customer does not choose a risk percentage; the merchant sets a base and the customer's
   band scales it.
2. **Thresholds.** Paper: score 92 → 0%, 58 → 10%, 35 → 25%. Code bands are A ≥ 800, B ≥ 600,
   C ≥ 400, D < 400 (`deposit-policy.rules.ts`). A paper score of 92 has no defined mapping.
3. **Ceiling.** The paper's own §4 promises deposits are *"never more than 50%"*. The D band
   multiplier is **1.25**, so the promise holds for any merchant base up to **40%** of the
   booking — a base above that breaches it. The promise is not currently false, but it is not
   guaranteed either: nothing clamps it, so a single merchant setting a 60% base breaks it.

### Correction

> ### 9.4 Deposits — Real Scenarios
>
> Your deposit is the **merchant's base deposit**, scaled by a multiplier set by your trust
> band. The merchant decides the base; your history decides the multiplier.
>
> | Your show-up score | Band | Multiplier | Example, on a ₹2,000 booking with a 20% base |
> |---|---|---|---|
> | 800 and above | A | 0× | **₹0** |
> | 600–799 | B | 0.5× | **₹200** |
> | 400–599 | C | 1× | **₹400** |
> | Below 400 | D | 1.25× | **₹500** |
>
> Reaching band A removes the deposit entirely, whatever the merchant's base.

**On the 50% ceiling — decided and implemented.** Option (a): the code now honours the
promise. The applied deposit is clamped to 50% of the booking value
(`DEPOSIT_CEILING_RATIO` in `deposit-policy.rules.ts`).

Worth noting *why* it is a separate clamp rather than a tighter multiplier. The band
multiplier is a statement about the **customer** — how much extra to ask of someone with a
poor record. The ceiling is a statement about the **merchant** — a floor under Pabandi's own
promise, whoever they are. Collapsing the two would make the promise hold by penalising
every honest D-band customer for one merchant's misconfiguration, which is the wrong
person to bill for it.

The clamp engages only when the booking's value is known. A business using a flat
`depositAmount` can be quoted before the booking cost exists, and the ceiling is defined
against that cost — so an unknown value leaves the quote unclamped and flagged rather than
guessing at a cap. A 60% base on a D-band booking now asks 50% instead of 75%; a 20% base
is untouched at 25%, so no merchant sees their ordinary quotes change.

§4 needs no edit. The paper is now correct, which was the better outcome — the alternative
was quietly weakening a published customer protection to match code.

**Also note the internal contradiction.** §2 promises never to guilt a customer about a
deposit, and §4 mandates one. Rewriting §2's deposit sentence resolves it — see below.

---

## §16 — Escrow does not hold funds

### The problem

The most serious discrepancy in the paper. v6.0 §16 promises:

> audited smart contracts where *"no one — including Pabandi — can move funds without meeting
> the conditions"*

Deposits settle **into the merchant's own Square account**. Pabandi never holds them.
`UniversalEscrow` is a status column plus timestamps — no transfer executes on any transition.
Release is also not automatic: it requires a verified check-in plus a buyer action.

This is simultaneously the strongest claim in the paper and the most likely to be tested
first. A customer who reads §16, loses a deposit, and asks "where are the smart contracts"
gets no answer.

**The architecture is right. The sentence is wrong.** Merchant-owned payment means no
custody, no float, no money-transmitter licensing, no insolvency exposure, and no ability
for Pabandi to touch a customer's money. That is a materially better position than an escrow
account, and it should be sold as such rather than described as escrow.

### Correction

> ## 16. Deposits, and Why Pabandi Never Holds Your Money
>
> **Deposits go directly to the merchant. We never touch them.**
>
> When you leave a deposit, it is charged to your card and paid to the merchant's own Square
> account. Pabandi records that it exists and what state it is in. We cannot move it, and we
> do not want to.
>
> This is a deliberate design choice, and it is the reason Pabandi does not need to be a
> licensed escrow operator, does not hold your money while disputes are open, and cannot lose
> it if we fail.
>
> **What we do keep is the record.** Pabandi holds the deposit's state — placed, funded,
> conditions met, released, refunded, or disputed — along with the evidence behind each
> transition: the verified check-in, both parties' confirmations, timestamps.
>
> **What this means in practice.** Releasing your deposit is a record update plus an
> instruction to the merchant, not an on-chain settlement. It is quick, and it is as final as
> the merchant's own payment processing. If a dispute reaches us, we can adjudicate the record
> and instruct a refund from the merchant account — we cannot unilaterally claw funds back out
> of it.
>
> A true escrow requires either a licensed escrow agent or a custodied wallet. If we ever add
> one, it will be opt-in per merchant and it will change this section.

Also correct §5's "Three Pieces, One System" and §2's deposit promise to match, and drop
"smart contract" wherever it appears.

---

## §11 — The flywheel arithmetic

### The problem

v6.0 §11 shows 1,000 merchants at $2,000/month arriving at **$144,000/year** in fees and
token buybacks. Two errors compound:

- 1,000 × $2,000 × 12 = **$24,000,000** in gross merchant volume, not $2.4M.
- The $144,000 figure implies a **0.6%** platform fee. The shipped rate is **3.5%**.

At the real rate: **$840,000/year** in platform fees — **5.8× the figure in the paper**. Note
the error runs in both directions: the paper's $144,000 for the *buyback* is larger than the
correct $84,000, so it is not simply a stale multiplier. It needs re-deriving from
scratch, not scaling.

### Correction

> | | |
> |---|
> | Merchants | 1,000 |
> | Monthly volume per merchant | $2,000 |
> | Annual merchant volume | **$24,000,000** |
> | Platform fee (3.5%) | **$840,000** |
> | PAB buyback (10% of fees, above the $50,000 threshold) | **$84,000** |

State the fee rate inline. A reader who has to infer 3.5% from elsewhere is a reader who
thinks you made an arithmetic error.

---

## §11 — Emission schedule

### The problem

v6.0 promises **2.5 → 1.25 → 0.5 → 0.25** PAB per check-in. The implementation floors to
**10 → 5 → 2 → 1**.

The 1.25 step is the real issue: it is not an integer, so it needs a rounding rule, and that
rounding rule is exactly where "fixed supply" quietly becomes "fixed plus an unbounded dust
tail". Confirmed live — the endpoint reports `10 -> 5 -> 2 -> 1`.

### Correction

Adopt the shipped integers and drop the decimals:

> | Period | PAB per verified check-in | Check-ins to exhaust the community tranche |
> |---|---|---|
> | Years 1–2 | 10 | 50,000,000 |
> | Years 3–4 | 5 | 100,000,000 |
> | Years 5–6 | 2 | 250,000,000 |
> | Years 7+ | 1 | 500,000,000 |
>
> Each row is independent — the check-in count that would exhaust the full 500,000,000 tranche
> **at that period's rate**, not a cumulative step. All four rows therefore yield the same
> 500,000,000 PAB, which is what makes the fixed-supply claim hold.

Total **500,000,000** PAB, reconciling exactly against the 1,000,000,000 fixed supply —
`reconciles: true` on the live endpoint. Integer rates keep the fixed-supply claim exact.

One honest caveat worth adding: emission is currently **computed and bounded, not
minted**. The reward path enforces the cap, but no capped on-chain mint authority exists yet,
so "fixed supply" is enforced by application logic rather than by the token contract. Say so.

---

## §13 — Mudarabah pool

### The problem

The pool is specified as funded by **escrow commission**. There is no escrow commission.
Fees are 3.5% flat; the 0.5% figure is an x402 API price for a different service.

AAOIFI Standard 13 has real Sharia governance behind it, and "AAOIFI compliant" is not a
phrase to leave loose against a funding source that does not exist.

### Correction

Name an actual funding source. The Mudarabah pool is funded at **30% of net fee revenue**,
which is what the code does. If escrow commission is intended as a future line item, mark it
**Roadmap**.

Consider adding a short note that AAOIFI Standard 13 defines the structure and its governance,
and that describing Pabandi as "compliant" should be reviewed by a qualified scholar. The
standard is a specification for Sharia-board approval, not a self-certification.

---

## §13 — API and agent pricing

v6.0 quotes **$0.05/API call**, **0.5% escrow fee**, and **2% agent fee**. None of the three
matches shipped code, which has a separate agent and API layer in
`server/src/config/fees.ts`. A third set of numbers that disagrees with both the old and new
schedules is worse than one consistent set — reconcile all three against `config/fees.ts`,
which is the single source of truth.

---

## Missing: tenant isolation

v6.0 describes multi-tenant isolation as a Prisma-extension guarantee. It is a **helper
function**, and it holds only where every call site uses it. `bookings.routes.ts` contains
roughly 20 unscoped id lookups — a query by primary key alone, so a wrong id crosses tenants.

This is an architectural claim presented as an enforced invariant. Either wire the extension
or soften the claim. Worth doing properly — but if it is soft-landing for this revision, the
honest sentence is that scoping is enforced by convention and covered by tests, not by the
query layer.

---

## Suggested order of work

1. **§16 escrow** — highest risk, and the fix strengthens the story rather than weakening it.
2. **§9.3 models** — remove the calibration claim; publish the delta table.
3. ~~Deposit ceiling~~ — **done**, implemented in `deposit-policy.rules.ts`. §4 is now correct.
4. **Flywheel and emission arithmetic** — mechanical, no judgement calls.
5. **Mudarabah funding source and the AAOIFI wording.**
6. **Shipped / in progress / roadmap labels** — then apply throughout, starting with A2A.

Two decisions are now closed: the deposit ceiling is honoured in code, and A2A is
**Roadmap**. Items 1, 2, 4 and 5 are wording changes still awaiting sign-off.

---

## Not addressed here

- **A2A messaging — decided: Roadmap.** v6.0 describes it as a working capability; there
  are no files. Keep the section, move it under **Roadmap**, and correct the tense from
  present to intended. Deleting it was the other option and the worse one: the ambition was
  never the problem, only that it currently reads as shipped.
- **Payment rails** — v6.0 describes multi-rail support; Square and PayPal are live. Worth
  stating precisely which rails are **Shipped**.
- **SaaS tiers** — the $0/$49/$149 tiers are live in `config/subscriptions.ts` and do not
  appear in the paper. Subscription discounts on PAB fees are explicitly deferred and must not
  be implied anywhere.
- **Square Invoices** — usage-fee collection ships but requires `INVOICES_WRITE`, which is not
  yet in the OAuth scopes. Do not describe collection as fully live until merchants
  re-consent.