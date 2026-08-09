# Pabandi — Pakistan Regulatory & Policy Compliance (Builders & Property Owners)

> **Scope:** Operating Pabandi's trust-gated escrow rails for **builders, property
> owners / managers, and their customers in Pakistan**. This is an addendum to
> `COMPLIANCE.md` (which covers US/GDPR). Pakistan is Pabandi's primary market, so
> this is the operative regulatory baseline — not the US doc.
>
> **Status:** Research/architecture baseline (2026). This is engineering guidance,
> **not legal advice**. Engage Pakistan-qualified counsel (SECP/SBP-licensed) before launch.
>
> **Entities referenced:** State Bank of Pakistan (SBP), Securities & Exchange
> Commission of Pakistan (SECP), Pakistan Virtual Assets Regulatory Authority
> (PVARA, established under the Virtual Assets Act 2026), Financial Monitoring Unit
> (FMU / goAML), Federal Board of Revenue (FBR), Provincial Revenue Departments
> (e.g. Sindh/Bahria LOP-NOC authorities), NADRA.

---

## 1. The core problem: you are handling other people's money + tokens

Pabandi takes **deposits/escrow** from customers and releases them to builders/property
owners against milestones, and it issues/transfers **$PAB** (a crypto token) on Solana.
In Pakistan both activities are **regulated financial activity**:

| Pabandi activity | Pakistani regulator | License required? |
|---|---|---|
| Holding customer deposits / releasing on milestone | SBP + SECP (NBFC) | **Yes** — cannot custody PKR like a bank without authorization |
| $PAB issuance, on-chain escrow, wallet analytics | PVARA (Virtual Assets Act 2026) | **Yes** — VASP license; unlicensed = up to 7 yrs / PKR 10M |
| Background checks, identity, trust scoring | PECA 2016 + pending PDPA + NADRA | Consent + data-security controls; FMU reporting |
| Dispute arbitration / clawbacks | Contract law + SBP escrow rules | Must follow escrow-release rules, not arbitrary |

**Bottom line:** a "demo" is fine; operating live with real PKR deposits or tradable
$PAB in Pakistan **requires licensing**. The product must be architected so it can run
either (a) **through a licensed partner** (SBP-approved escrow bank / licensed VASP),
or (b) **as a licensed entity** (NBFC + PVARA VASP).

---

## 2. Escrow & deposits — SBP builder-escrow rules (the most relevant)

SBP's housing-finance guidelines already mandate **escrow for builder/developer payments**:
- All payments to a builder/developer must be routed through an **escrow account
  maintained by the bank / lead DFI** of the consortium.
- The **seller has no direct access** to funds until construction milestones are met.
- The core principle: *buyer money is only spent on completion of the unit.*

**What this means for Pabandi's "Protected Deposit" / milestone escrow:**
1. **Do not custody PKR yourself.** Pabandi should integrate a **SBP-approved escrow
   account** (bank or DFI) as the settlement layer. Pabandi is the *orchestration /
   trust* layer (verification, milestone attestation, dispute gating), not the money
   custodian. This avoids unlicensed deposit-taking (NBFC territory).
2. **Milestone release logic must mirror SBP rules** — funds release on verified
   milestone, not on a timer. Your `EscrowEvent` / milestone-draw model already does
   staged release; document that release conditions follow SBP escrow principles.
3. **For property owners (rentals/deposits):** tenant security deposits are also
   increasingly expected to be held in escrow, not the owner's operating account.
   Same pattern — route via escrow, release on exit/condition.

**Action:** define a `SETTLEMENT_PROVIDER` abstraction so the PKR leg settles in a
licensed escrow account (Safepay/branch partner) while Pabandi controls *release
conditions* via its trust verdicts. Keep the Solana/on-chain leg as the *audit &
  token-incentive* layer, clearly disclosed as not holding PKR.

---

## 3. NBFC license — when Pabandi itself takes deposits (SECP)

If Pabandi ever holds customer funds in its own name (not a bank escrow), it is a
**Non-Banking Finance Company (NBFC)** under SECP and needs a license:
- Incorporate as a public limited company; apply to SECP Licensing Dept (Islamabad).
- Relevant NBFC classes: **Investment Finance Services (IFS)**, **Housing Finance
  Services (HFS)**, or **Microfinance** depending on product.
- Requires minimum capital, fit-and-proper checks, AML program, reporting.

**Recommendation:** prefer the **partner-escrow model (§2)** to avoid NBFC licensing
for v1. Revisit NBFC only if Pabandi becomes the balance-sheet lender.

---

## 4. Virtual Assets — PVARA / Virtual Assets Act 2026 (the $PAB problem)

This is the **highest-risk gap**. As of 2025–2026:
- The **Virtual Assets Regulatory Authority (PVARA)** was established; the **Virtual
  Assets Act 2026** provides the licensing framework. SBP lifted the crypto-banking ban
  (May 2026) **for licensed VASPs only**.
- **Operating as a VASP without a license: up to 7 years imprisonment or PKR 10 million
  fine.**
- VASP obligations: **AML/CFT, KYC, Travel Rule (FATF), FMU goAML reporting**, and
  customer due diligence (CDD). Token offerings are treated as **high-risk**.

**What this means for $PAB + on-chain escrow:**
1. **$PAB issuance + tradability = VASP activity.** Before any live, transferable, or
   exchange-listed $PAB, Pabandi (or its token entity) needs a **PVARA VASP license**,
   or must restrict $PAB to a **closed-loop loyalty/incentive token** with no secondary
   trading and clear "no monetary value" disclosure (lowers, but does not eliminate,
   VASP scope).
2. **On-chain escrow / wallet analytics:** if it moves value, it is VASP activity.
   Keep a `REGULATED_MODE` flag: in Pakistan, settle value in the licensed escrow
   (§2) and use the chain only for attestation + non-transferable trust stamps.
3. **Travel Rule:** any VASP-to-VASP transfer must carry originator/beneficiary KYC
   data. Build KYV (Know-Your-VASP) before any external bridge.

**Action:** engage a PVARA-licensed VASP as the token/custody partner for v1, or file
for VASP licensing for the token entity. Do **not** market $PAB as an investment.

---

## 5. AML / KYC / CDD — FMU goAML + Travel Rule

Under Pakistan's AML/CFT/CPF Regulations (Regulation-2 CDD) and FATF commitments:
- **CDD at onboarding** for every builder, property owner, and (above thresholds)
  customer: identity, source of funds, beneficial ownership.
- **FMU goAML reporting** for suspicious transactions (STR) and large cash.
- **Travel Rule** for any virtual-asset transfer.

**Pabandi mapping (this is where your background-check play pays off):**
- The `BackgroundCheck` + `TrustPassport` + `KYC` flows are the **CDD engine**. Tie
  them to FMU reporting: a REJECT/REVIEW verdict on a builder should (a) hard-gate
  bookings (already built) **and** (b) be reviewable for STR if patterns look like
  layering/structuring.
- Maintain a **risk-based CDD** tiers: low-touch (small deposits) vs enhanced DD
  (large milestone draws, new builders, high-no-show/ dispute history).
- NADRA verification for Pakistani citizens (CNIC) should be the primary identity anchor
  for builders/property owners — integrate NADRA e-Sahuliyat / Verisys where available.

---

## 6. Data protection — PECA 2016 + pending PDPA (the gap)

Critical finding: **Pakistan has no enacted standalone data-protection law.** PECA 2016
is cybercrime law — it does **not** grant citizens data-access/consent/deletion rights,
and the **Personal Data Protection Bill 2023 is still pending**. DLA Piper and Privacy
International both confirm this.

**Implication for Pabandi's background-check / trust data:**
- Self-impose **GDPR-grade controls** (already in `COMPLIANCE.md`: consent, minimization,
  encryption, access, portability, deletion) — treat them as the *floor*, because the
  PDPA will likely land close to GDPR.
- **Explicit consent** for background checks, OSINT, wallet analytics, and trust scoring.
  The `BackgroundCheckPage` must capture consent + purpose + retention before running.
- **Biometric / CNIC data** (if NADRA-linked): treat as sensitive; minimize, encrypt,
  short-retention.
- Prepare a **Data Protection Officer** role and a PDPA-ready policy before the law lands.

---

## 7. Builder & property-owner specific obligations

Beyond payments, builders/property owners in Pakistan carry their own compliance:
- **LOP / NOC:** housing schemes need Layout Plan (LOP) approval + NOC from the
  provincial authority (e.g., CDA for Islamabad, Sindh/Bahria for Karachi). Pabandi
  should **collect and verify LOP/NOC** for any developer raising milestone escrow —
  a failed/forged NOC is a major fraud vector. Store document hashes on-chain as trust
  stamps.
- **Tax:** property transactions touch FBR (withholding tax on sale/transfer) and
  provincial stamp duty. Pabandi should surface tax/disclosure notices and issue
  proper receipts; consider FBR integration for large draws.
- **RERA-style registration:** several provinces are moving toward real-estate regulator
  (RERA) registration. Track and require registration where mandated.
- **Consumer protection:** clear cancellation/refund + dispute policy (already in ToS);
  for escrow, release rules must favor the buyer on unresolved dispute (your arbitration
  + juror model is the mechanism — ensure juror clawbacks follow SBP escrow release).

---

## 8. Required policies / artifacts before Pakistan launch

| Artifact | Owner | Maps to |
|---|---|---|
| Pakistan Terms of Service (Urdu + English) | Legal | Contract law, SBP escrow |
| Pakistan Privacy Policy (consent for BC/trust) | DPO | PECA + PDPA-ready |
| Escrow & Milestone Release Policy | Ops + Legal | SBP builder-escrow rules |
| VASP / token disclosure ("$PAB is not investment") | Legal + Token | PVARA |
| AML/CFT Program + FMU goAML integration | Compliance | AML Regs, FATF |
| CDD / KYC tiers + NADRA integration plan | Compliance | CDD Reg-2 |
| LOP/NOC verification SOP for developers | Ops | Provincial authority |
| Licensing decision: partner-escrow vs NBFC vs VASP | Exec | SECP/SBP/PVARA |

---

## 9. Engineering guardrails — IMPLEMENTED

Decisions locked (founder, 2026): **partner for PKR escrow** (avoid SECP NBFC) and
**$PAB is tradable → PVARA VASP license required** (coin already launched; cannot be
un-launched). The following guardrails are now built into the codebase:

1. **`config/compliance.ts`** — single source of truth. `REGULATED_MODE` (env),
   `SETTLEMENT_PARTNER` (default `safepay`), `VASP_LICENSED` (env), `JURISDICTION=PK`,
   and the `$PAB disclaimer` string ("utility & incentive token, NOT an investment").
   Guards: `assertCompliantPkrSettlement()` (throws if REGULATED but no partner rail),
   `canMoveValueOnChain()` (false in REGULATED mode unless VASP-licensed → fail open).
2. **`services/settlement.service.ts`** — settlement-provider abstraction. PKR is
   collected/released ONLY via the licensed partner (Safepay → SBP-approved bank escrow).
   Pabandi never custodies PKR. $PAB transfers gated by `pabTransferAllowed()`.
3. **Consent gate on `BackgroundCheck`** — in REGULATED mode, `createCheck` requires
   `consent: true` (PECA/PDPA). The booking hard-gate passes `consent: true` with purpose
   + 30d retention; the client UI has an explicit consent checkbox (Run disabled until checked).
4. **(TODO) Verdict → STR hook** — REJECT/REVIEW on a builder should raise a reviewable
   flag for FMU goAML. Plumbing exists (verdict stored + hard-gate); wire to FMU next.
5. **(TODO) LOP/NOC document hash** stored as a trust stamp before a developer raises escrow.
6. **(TODO) Retention & deletion** jobs for personal data (PDPA-ready).

> Still TODO (not yet built): FMU goAML reporting, NADRA CNIC e-verification, LOP/NOC
> collection UI, automated retention/deletion. These are the remaining gaps before a
> fully audit-ready launch.

---

## 10. Locked decisions & your action items (US founder)

**Decisions made:**
- PKR escrow → **licensed partner** (Safepay / SBP-approved bank escrow). No self-custody.
- $PAB → **tradable utility token** → requires **PVARA VASP license** (or licensed VASP partner).
- Not "closed-loop only" — the coin is live and tradability is a deliberate selling point.

**What YOU need to do (you live in the USA):**
1. **Engage Pakistan-qualified counsel** (SECP/SBP-licensed firm) to (a) confirm the
   partner-escrow structure keeps Pabandi out of NBFC scope, and (b) plan the **PVARA VASP
   license** application for the token entity. This is the gating legal step.
2. **Entity structure**: the token/$PAB entity likely needs a Pakistan presence/agent for
   PVARA (VASP licensing is PK-jurisdiction). Decide: PK subsidiary, or license via a
   Pakistani VASP partner who lists/operates $PAB. Your US entity can own it but the VASP
   authorization is local.
3. **US side (you)**: if $PAB is offered/sold to US persons, that triggers **US securities
   (Howey) + FinCEN MSB + possibly a state money-transmitter** analysis. Keep $PAB marketed
   as utility, not investment, to US users; get US counsel on the token memo.
   (Your existing `COMPLIANCE.md` covers US consumer/CCPA; add a token-specific US memo.)
4. **FMU goAML + Travel Rule**: once VASP-licensed, stand up FMU reporting + Travel Rule
   (FATF). Engineering hook `#4` above is the start.
5. **NDRA / NADRA**: plan CNIC e-verification for Pakistani builders/property owners
   (highest-trust identity anchor). Engage a NADRA-approved verifier.
6. **Insurance**: E&O / escrow-failure cover for the partner-escrow model (satisfies
   provincial consumer-protection expectations).

> Engineering has made the product compliant-by-design for the partner-escrow + tradable
> VASP posture. The remaining items are **licensing + counsel + reporting integrations**,
> which are your external actions, not code.

---

*Researched 2026 against: SBP housing-finance/escrow guidelines (2021, still operative),
SECP NBFC licensing (2025 checklist), PVARA / Virtual Assets Act 2026, SBP crypto-banking
lift (May 2026), AML/CFT CDD Regulation-2, FMU goAML/Travel Rule, PECA 2016 + pending
Personal Data Protection Bill 2023. This document is engineering/compliance architecture,
not legal advice — confirm with Pakistan-qualified counsel before operating live.*
