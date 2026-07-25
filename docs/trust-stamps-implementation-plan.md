# Pabandi Trust Stamps & Sybil-Resistant Trust Layer
## Elaborate Implementation Plan — Full User Lifecycle, Escrow-Only Users, Ease of Use, Customer Obsession

---

## 1. Strategic Context

Human Passport teaches us that trust scales best when it is:
- **Composable** — multiple lightweight signals, not one heavy gate
- **Tunable** — each action can require a different trust level
- **Portable** — users carry their trust, not just their account
- **Transparent** — users see exactly why they are trusted or limited
- **Low-friction** — good users never notice the checks; abusers get soft blocks with clear remediation

Pabandi already has strong primitives: reliability score, trust tier, connected socials, E2EE dietary passport, PoP (proof of presence), AI risk scoring, dynamic deposit, and web3 wallet verification. The missing layer is a **unified, composable trust-stamp model** that turns these signals into verifiable, user-owned, action-bound credentials.

This plan defines that layer, maps it onto the **full lifecycle of a Pabandi user**, and explicitly accounts for users who only use Pabandi for **escrow** rather than the full marketplace.

---

## 2. Trust Stamp Taxonomy

### 2.1 Stamp Categories

| Category | Stamp | Signal Source | Anti-Sybil Value | UX Friction | Weight |
|---|---|---|---|---|---|
| **Identity** | Phone Verified | SMS OTP | Medium — binds account to real SIM | Low | 15 |
| Identity | Email Confirmed | Email link | Low — easy to rotate | Very Low | 5 |
| Identity | Government ID Verified | ZK-compatible ID provider | High — strong uniqueness signal | Medium | 30 |
| Identity | Biometric Liveness | Selfie/liveness check | High — hard to farm | Medium | 25 |
| Identity | Proof of Clean Hands | Attestation provider | High — sanctions/watchlist exclusion | Low | 20 |
| **Wallet** | Wallet Connected | Web3 wallet signature | Medium — on-chain identity | Low | 10 |
| Wallet | On-Chain Age | Wallet tx history / age | Medium — mature wallets stronger | Low | 10 |
| Wallet | $PAB Staked | Stake amount | High — economic commitment | Low-Medium | 15 |
| **Behavior** | Booking History | Completed bookings | High — real service consumption | Auto | 15 |
| Behavior | Reliability Tier | Internal score | High — long-term platform trust | Auto | 20 |
| Behavior | No-Show Record | Cancellations/no-shows | Negative weight | Auto | -15 |
| Behavior | Review Authenticity | Verified booking + review | Medium | Auto | 5 |
| Behavior | PoP Completion | Arrival check-in | High — physical-world proof | Auto | 10 |
| **Social** | Social Connected | OAuth provider | Low-Medium — easy to rotate | Low | 5 |
| Social | Social Age | Account creation date | Low | Low | 5 |
| **Commitment** | Business Profile Complete | Data completeness | Low-Medium — skin in game | Low | 5 |
| Commitment | Referral Code Generated | AM activation | Medium — partner commitment | Low | 5 |
| Commitment | Waitlist / Early Access | Registration date | Low — early adopter signal | Auto | 5 |

### 2.2 Score Architecture

```
Unique Trust Score = Base Score + Sum(Stamp Weights) - Decay(Stamps older than 180 days) - Penalties(Sybil flags, chargebacks, fraud)

Threshold Tiers:
- Bronze (Score 0-19): Browse, view public profiles, join waitlist
- Silver (Score 20-49): Create bookings, leave reviews, use TapPay
- Gold (Score 50-99): Instant checkout, concierge booking, high-value escrow,create business profile
- Platinum (Score 100+): Merchant tools, partner dashboard, API access, governance voting
```

This maps directly to Human Passport's threshold concept: default passing score of 20, tunable per use case.

### 2.3 1 Person = 1 Action Enforcement

Actions limited to one per verified identity (not per account):
- Airdrop claims
- Waitlist registrations
- Referral code activations
- Reviews on a single business
- Beauty/commerce voting rounds
- Event RSVPs

Enforcement stack:
1. Wallet signature hash
2. Verified identity hash (phone or ID attestation)
3. Stable device/browser fingerprint
4. Behavioral biometrics cadence (optional)
5. Rate limiting + anomaly detection

If any two of the above match across accounts, soft flag the lower-trust account and require additional verification before the action completes.

---

## 3. Full User Lifecycle — Trust Stamp Integration

### 3.1 Personas

**Persona A — Full Marketplace User**
- Discovers Pabandi via social, SEO, or referral
- Browses businesses, books reservations, leaves reviews, earns rewards
- May become business owner, growth partner, or developer

**Persona B — Escrow-Only User**
- Discovers Pabandi via merchant link, TapPay QR, or checkout redirect
- Only goal: pay securely for a booking or live purchase
- Never creates an account, never browses catalog
- Values: speed, trust badges, dispute resolution, payment proof

**Persona C — Business User**
- Onboards business profile
- Uses dashboard, webhooks, live-selling, concierge
- Needs: fast verification, clear trust signals, chargeback protection

**Persona D — Power User / Partner**
- AM, developer, or merchant with API access
- Needs: trust portability, attribution, audit logs

### 3.2 Lifecycle Map — Persona A

#### Stage 1: Landing
- User sees Pabandi value prop
- Existing trust signals on page: “Trusted by X businesses,” “$Y secured in escrow”
- **Optimization**: Show aggregate trust stamps of community, not just raw numbers

#### Stage 2: First Interaction (No Account)
- Actions allowed: browse businesses, view trust badges, scan TapPay QR
- Trust stamps shown: merchant verification tier, number of honored appointments, $PAB rewards history
- No friction; stamps are passive signals

#### Stage 3: Signup / Login
- OAuth or email/password
- **Auto-award stamps**: Email Confirmed, Social Connected
- Prompt at moment of value: “Verify phone to unlock booking”
- Show progress bar: “Your Trust Score: 5/20 — verify phone to reach 20”
- Social auth auto-connects and stamps

#### Stage 4: First Booking
- Pre-booking: show merchant trust badges
- Booking form: if user trust < Bronze threshold, show “Complete booking with escrow protection — verify phone instantly”
- **Soft gate**: do not block; show trust requirement with one-click verification path
- Post-booking: award Booking History stamp, PoP intent recorded

#### Stage 5: Check-in / PoP
- Arrival check-in: record PoP, award PoP Completion stamp
- If no-show: negative stamp weight applied

#### Stage 6: Review / Social
- Leave review: requires Silver trust (score 20+)
- Review authenticity stamp awarded automatically

#### Stage 7: Repeat Use
- Reliability tier auto-updates
- Stamps decay if user becomes inactive >180 days; re-engagement email explains decay and gives one-click path to restore
- Trust score becomes a “trust resume”

#### Stage 8: Business Upgrade
- Upgrade to business owner: Business Profile Complete stamp awarded
- Onboarding checklist driven by missing stamps

#### Stage 9: Partner / Power User
- Referral code / AM: Referral Code Generated stamp
- API access: requires Gold trust + Business Profile Complete

### 3.3 Lifecycle Map — Persona B (Escrow-Only User)

#### Entry Point: Merchant Link / TapPay QR
- User lands on checkout page
- Merchant trust badges prominently displayed: tier, honored appointments, escrow history
- User sees: “Your payment is protected by Pabandi escrow”
- **No account required for basic escrow**: guest checkout path

#### Guest Checkout Flow
- Name, email, phone — minimal fields
- Phone verification = instant Trust Stamp (Phone Verified)
- Email confirmation = Trust Stamp (Email Confirmed)
- Payment via Safepay / Solana / BSC / PayPal
- Deposit held in escrow
- Post-payment: confirmation page with escrow reference, expected release time
- **Trust signal at moment of fear**: “Pabandi holds your $X deposit until [merchant] confirms — or you get a full refund”

#### Post-Experience
- If appointment honored: user prompted to create account and claim $PAB rewards
  - “Create account to receive X $PAB — takes 30 seconds”
  - Onboarding continues from merchant trust page; user’s escrow history becomes initial stamps
- If no-show / dispute:
  - Dispute resolution flow
  - User trust score adjusted based on outcome
  - Clear explanation: “Your dispute was resolved in X hours because your trust score was Y”

#### Critical Escrow-Only Optimization
- **Zero-friction first payment**: do not force account creation before payment
- **Progressive trust**: trust requirements increase only when user wants higher-value actions
- **Passive trust carryover**: if user later creates account, guest escrow history becomes Booking History stamp

### 3.4 Lifecycle Map — Persona C (Business)

#### Stage 1: Business Registration
- Business Join Page
- Auto-award stamps: Business Profile Complete
- If merchant also has individual account: link via Business Owner stamp

#### Stage 2: Verification
- Merchant verification tier awarded: Basic, Verified, Premium
- Premium requires: government ID + Proof of Clean Hands + active business registration
- Show merchant badge on public profile and checkout

#### Stage 3: Dashboard
- Trust Stamps Panel: “You have X/Y stamps — unlock instant checkout by connecting your wallet”
- Webhook / API access gated by Gold trust

#### Stage 4: Trust Portability
- Merchant can share trust attestation URL with partners
- Attestation queryable without Pabandi account

### 3.5 Lifecycle Map — Persona D (Power / Partner)

#### Stage 1: AM Activation
- Generate referral code
- Auto-award Referral Code Generated stamp

#### Stage 2: Partner Dashboard
- Lead scoring tied to trust stamp completeness
- “Referred businesses have 3x higher booking rates when they have Gold trust”

#### Stage 3: API Access
- Developer portal: requires Platinum trust + API key
- Rate limits and credit allocation tied to trust score

---

## 4. UX Blueprint — Customer Obsession Details

### 4.1 Trust Resume (Profile Page)

```
┌─────────────────────────────┐
│  TRUST RESUME               │
├─────────────────────────────┤
│  Unique Trust Score: 42/100  │
│  Tier: Silver ████████░░    │
│  Next tier in 8 points      │
├─────────────────────────────┤
│  STAMPS                     │
│  ✓ Phone Verified     +15   │
│  ✓ Email Confirmed    +5    │
│  ✓ Booking History    +15   │
│  ✓ PoP Completion     +10   │
│  ✗ Wallet Connected   0/10  │
│  ✗ ID Verified       0/30   │
├─────────────────────────────┤
│  Unlock more trust:         │
│  [Connect Wallet +10]       │
│  [Verify ID +30]            │
└─────────────────────────────┘
```

Design rules:
- Never punitive; always additive
- Show next reward, not missing penalty
- One-click actions from profile
- Decay warnings: “Your phone stamp expires in 14 days — renew now”

### 4.2 Soft Gates

Instead of: “You cannot book until you verify”
Say: “Verify phone to book with escrow protection — takes 15 seconds”
And: auto-open verification modal inline; do not redirect away from booking flow

Bad UX: hard block on checkout
Good UX: trust requirement presented as value unlock, with path to resolution visible and one click away

### 4.3 Escrow-Only Trust Path

Guest checkout trust ladder:
1. Enter email → Email Confirmed stamp
2. Enter phone → Phone Verified stamp (inline OTP)
3. Deposit created → Booking Intent stamp
4. Appointment honored → Trust Score 35+, auto-invite to create account
5. Account creation: all stamps carried over, $PAB rewards claimable

User who never returns: no spam, no password reset emails unless they opt in

### 4.4 Merchant Badge System

```
[PABANDI VERIFIED]        [Score: 42/100]
[Trust Tier: Gold]        [Booking Badge: ✓]
```

Badges are:
- Visual (inline SVG)
- Queryable JSON endpoint
- Embeddable on merchant’s own site
- Shareable on social

### 4.5 Dispute / Resolution UX

“Trust score impact: your score will decrease by 10 points if this dispute is ruled against you. To appeal, upload evidence below.”

Shows:
- Current score
- Projected score
- Remediation path
- Time to recover

---

## 5. Technical Architecture

### 5.1 Backend — Trust Service

New module: `server/src/services/trust.service.ts`

Responsibilities:
- Stamp issuance and verification
- Score computation with decay and penalties
- Threshold enforcement
- Action-rate limiting per identity
- Attestation issuance and validation
- Audit logging

### 5.2 Data Model

```
User Trust Stamps:
- id, userId, stampType, issuer, weight, issuedAt, expiresAt, attestationHash, revoked

User Trust Score:
- userId, score, tier, computedAt, expiresAt

Trust Attestation:
- id, userId, stampType, attestationHash, publicUrl, revoked, issuedAt, expiresAt

Action Limit:
- id, actionType, identityHash, limit, used, windowStart, windowEnd
```

### 5.3 Trust Stamp Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/trust/stamps` | List user stamps |
| POST | `/api/v1/trust/stamps/:type/issue` | Issue new stamp |
| POST | `/api/v1/trust/stamps/:type/verify` | Verify external stamp |
| GET | `/api/v1/trust/score` | Current score + tier |
| GET | `/api/v1/trust/attestation/:stampId` | Public attestation URL |
| GET | `/api/v1/trust/requirements/:action` | Threshold for action |
| POST | `/api/v1/trust/action/:actionType` | Enforce 1-person-1-action |

### 5.4 Decay Model

| Stamp Type | Decay Period | Decay Weight |
|---|---|---|
| Phone Verified | 180 days | 0 on first renewal, penalty if expired |
| Email Confirmed | 365 days | 0 |
| ID Verified | 365 days | 0 with renewal |
| Booking History | No decay | N/A |
| No-Show Record | 180 days gradual recovery | -15 → 0 |
| PoP Completion | 180 days | 0 |

Decay formula:
```
effectiveWeight = stamp.weight * max(0, 1 - (daysSinceIssue - decayPeriod) / decayPeriod)
```

### 5.5 Sybil Detection Heuristics

Flag when ≥2 of:
- Same phone hash across accounts
- Same device fingerprint across accounts
- Similar naming patterns / timing
- Wallet clustering
- IP overlap > N accounts

Action: soft limit with remediation path, not hard ban

### 5.6 Privacy

- Store attestation hashes, not raw PII
- ZK-compatible stamp providers preferred
- Users can revoke stamps
- GDPR data-portable trust profile export

---

## 6. Frontend Implementation

### 6.1 Design System Additions

New primitives in `client/src/design-system/index.tsx`:
- `TrustBadge` — compact badge for merchant cards, profiles
- `TrustStampsPanel` — profile panel showing stamp list + next actions
- `TrustGate` — soft gate component for action protection
- `SoftGateModal` — inline modal explaining trust requirement and one-click fix

### 6.2 Pages to Modify

| Page | Changes |
|---|---|
| `ProfilePage.tsx` | Add Trust Stamps Panel |
| `BusinessJoinPage.tsx` | Show trust requirements for business tier |
| `BookingPage.tsx` | Soft gate on “Request Reservation” |
| `CheckoutSuccessPage.tsx` | Award stamps, show trust progression |
| `AuthPage.tsx` | Progressive trust prompts at login/signup |
| `BusinessDashboard.tsx` | Trust stamps overview + remediation |
| `PublicPassportPage.tsx` | Public trust badge for verifiable URL |
| `TapPayPage.tsx` | Merchant trust badge + guest trust ladder |
| `UniversalCheckoutPage.tsx` | Guest trust path inline |

### 6.3 Trust Resume Component

```
File: client/src/components/TrustStampsPanel.tsx
Props: userId, stamps[], score, tier, onVerify
Shows: score ring, stamp checklist, next-action chips
```

### 6.4 Soft Gate Component

```
File: client/src/components/TrustGate.tsx
Props: action, currentScore, requiredScore, children
Behavior: if currentScore >= required => render children
         else => render SoftGateModal with onVerify callback
```

---

## 7. Escrow-Only User — Deep Optimization

### 7.1 Guest Escrow Flow

```
1. Merchant sends link: /s/{sellerId}?item=X&price=Y
2. Guest lands:
   - Merchant trust badge visible immediately
   - “Checkout with Pabandi escrow — no account needed”
3. Guest enters:
   - Name, email, phone (phone optional but encouraged)
4. If phone entered → inline OTP → Phone Verified stamp awarded
5. If email entered → confirmation email sent → Email Confirmed stamp
6. Payment: Safepay / Solana / BSC / PayPal
7. Deposit locked:
   - Reference shown
   - SMS + email confirmation
   - Escrow release ETA displayed
8. Appointment day:
   - PoP intent, arrived check-ins
   - Merchant confirms
9. Post-appointment:
   - If honored: “Create account to receive X $PAB”
   - If no-show/dispute: clear resolution UI
```

### 7.2 Trust Carryover on Account Creation

When guest creates account:
- All guest stamps convert to full stamps (weight preserved)
- Booking history becomes permanent Bookings stamp
- If guest never returns: stamps expire gracefully, no spam

### 7.3 Escrow-Only Metric Targets

- Guest checkout completion rate > 92%
- Guest-to-account conversion > 25%
- Time-to-first-booking < 60 seconds for return users
- Dispute resolution NPS > 70

---

## 8. Trust Portability

### 8.1 Pabandi Trust URL

Format: `https://pabandi.com/trust/{userId}.json`

Content:
```json
{
  "userId": "abc123",
  "trustScore": 42,
  "tier": "silver",
  "stamps": [
    { "type": "PHONE_VERIFIED", "weight": 15, "issuedAt": "2026-07-24", "expiresAt": "2027-01-20" },
    { "type": "BOOKING_HISTORY", "weight": 15, "issuedAt": "2026-07-24" }
  ],
  "attestations": [
    { "hash": "abcd...", "issuer": "pabandi", "type": "PHONE_VERIFIED" }
  ]
}
```

Enables:
- Merchant embeds on their site
- Partner API queries
- Cross-app reuse

### 8.2 Cross-Pabandi Products

Trust stamps flow across:
- Hospitality
- Live-selling
- Marketplace
- TapPay checkout
- Freelance / gig
- Business dashboard

One verified identity, one trust score, all contexts.

---

## 9. Phased Rollout Plan

### Phase 0 — Foundation (Week 1-2)
- [ ] Define trust stamp types and weights in design doc
- [ ] Design Trust Resume UI in Figma
- [ ] Backend schema for stamps and scores
- [ ] Trust service skeleton + unit tests
- [ ] Define action thresholds table

**Deliverable**: Immutable taxonomy and trust-service shell

### Phase 1 — Core Stamps + Profile (Week 3-4)
- [ ] Implement 6 core stamps:
  - Email Confirmed
  - Phone Verified
  - Wallet Connected
  - Booking History
  - PoP Completion
  - No-Show Record
- [ ] Score computation with decay
- [ ] Trust Stamps Panel on ProfilePage
- [ ] Trust Badge components
- [ ] API endpoints: stamps list, score, requirements

**Deliverable**: Users can view stamps and see trust score

### Phase 2 — Soft Gates + Guest Path (Week 5-6)
- [ ] Trust Gate component
- [ ] Soft gate on booking, review, TapPay
- [ ] Guest escrow trust ladder
- [ ] Stamp carryover on account creation
- [ ] Progressive prompts at login/signup

**Deliverable**: Trust gates active on all value actions; guest checkout optimized

### Phase 3 — 1 Person = 1 Action (Week 7-8)
- [ ] Identity hashing (phone, wallet, device)
- [ ] Action limit middleware
- [ ] Sybil detection heuristics
- [ ] Remediation UX for soft flags

**Deliverable**: Sybil-resistant airdrop, review, referral, and waitlist actions

### Phase 4 — Attestations + Portability (Week 9-10)
- [ ] Attestation issuance and public URLs
- [ ] Merchant trust badge embed code
- [ ] Partner API for trust queries
- [ ] Cross-product trust sync

**Deliverable**: Trust is portable, embeddable, and partner-queryable

### Phase 5 — Advanced Verification (Week 11-12)
- [ ] ZK-compatible ID provider integration (modular)
- [ ] Proof of Clean Hands stamp
- [ ] Biometric liveness optional path
- [ ] Trust decay notifications

**Deliverable**: High-assurance stamps available; privacy-first verification

---

## 10. Trust Score Simulator

To tune weights and thresholds before production, build a simulator:

```python
# trust_sim.py
stamps = {
    'phone_verified': 15,
    'email_confirmed': 5,
    'wallet_connected': 10,
    'id_verified': 30,
    'booking_history': 15,
    'pop_completion': 10,
}

# Simulate user journey
user_stamps = ['email_confirmed', 'phone_verified', 'booking_history']
score = sum(stamps.get(s, 0) for s in user_stamps)

tiers = {
    'bronze': (0, 19),
    'silver': (20, 49),
    'gold': (50, 99),
    'platinum': (100, float('inf')),
}
```

Run against real booking data to validate thresholds.

---

## 11. Success Metrics

| Metric | Baseline | Target |
|---|---|---|
| User trust score average at signup | ~5 | >15 within 7 days |
| Phone verification rate | ~20% | >60% |
| Guest-to-account conversion | ~10% | >25% |
| Airdrop/review Sybil rate | unknown | <2% |
| Merchant trust badge CTR | 0% | >12% |
| Booking completion with trust gate | ~85% | >92% |
| Customer support tickets (trust-related) | baseline | -30% |
| Escrow dispute resolution time | baseline | <24 hours |

---

## 12. Risks and Mitigations

| Risk | Mitigation |
|---|---|
| New trust friction reduces signups | Soft gates + progressive prompts; measure A/B |
| Stamp weights create unintended bias | Tunable, audited, explainable; user-facing rationale |
| Privacy regulation concerns | ZK-compatible stamps; hash-only storage; user control |
| Sybil actors game stamps | Layered detection; not single-factor |
| Decay annoys good users | Notify 30/14/7 days before; simple one-click renew |
| Technical debt | Trust service isolated; feature flags on all gates |
| Guest flow breaks escrow payments | Extensive QA on guest checkout path before launch |

---

## 13. Why This Makes Pabandi Different

- **Human Passport** is identity-for-protocols. Pabandi is **trust-for-commerce**.
- Pabandi’s advantage: trust is already in the revenue path. A booking is a real-world event; a no-show has monetary consequences. Trust stamps don’t just prevent Sybil — they directly reduce revenue loss from no-shows, fraud, and disputes.
- This plan turns trust into a **first-class product**, not a compliance afterthought.
- Escrow-only users get trust unlocking as a byproduct of paying, not a separate onboarding hurdle.
- Businesses get verifiable trust badges that drive conversion.
- The platform gets reusable, auditable trust data that improves AI risk scoring and dynamic deposits.

---

## 14. Next Actions

1. Review and approve this plan
2. Create `server/src/services/trust.service.ts` with stamp taxonomy
3. Schema migration for trust stamps, scores, attestations, action limits
4. Build Trust Stamps Panel frontend component
5. Soft gate component + first gate on booking action
6. Guest escrow trust ladder inline on TapPay / UniversalCheckout
7. Trust simulator to tune weights/thresholds
8. A/B test phone verification prompt placement on auth flow
