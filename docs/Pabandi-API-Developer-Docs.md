# Pabandi API — Developer Beta
## Reliability Score as Portable Identity
**Version:** 0.1 (Beta)  
**Base URL:** `https://pabandi-42c5b.web.app/api/v1`  
**Auth:** Bearer token (contact team for access)  
**Docs last updated:** June 2026

---

# Welcome, Builder

Pabandi is building a portable reliability layer for Pakistan's informal economy.

If you run a platform where trust between strangers matters — live selling, wholesale markets, freelance gigs, rentals, clinic bookings — this API gives you access to that trust without building it from scratch.

**One score. Every platform. Real behavior, not self-reported claims.**

---

# How Pabandi Differs From Other Reputation Projects

The Web3 reputation space is crowded. Most projects score wallets, social accounts, or DeFi usage. Pabandi scores something fundamentally different: real-world reliability.

| | Pabandi | Ethos Network | Orange Protocol | Fuero | cheqd |
|---|---------|--------------|-----------------|-------|-------|
| **Data source** | AI-observed real-world behavior (bookings, payments, no-shows) | Social / X/Twitter account signals | Web2 + Web3 aggregator (protocol usage, credentials) | Traditional credit bureau data | Decentralized identity credentials |
| **Score type** | Reliability — will this person show up and pay? | Credibility — is this account trustworthy? | Reputation — aggregated trust signals | Creditworthiness — loan repayment history | Identity verification — are you who you say you are? |
| **AI layer** | ✅ Yes — predicts behavior from patterns | ❌ No | ❌ No | ❌ No | ❌ No |
| **Merchant API** | ✅ Yes — real-time verification for sellers | ❌ No | ❌ No | ❌ No | ❌ No |
| **Target market** | Pakistan's $15B informal economy | Crypto-native users | Web3 ecosystem | US DeFi borrowers | Enterprise identity |
| **On-chain** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Portable** | ✅ | Partial | ✅ | ✅ | ✅ |

**The key distinction:** Ethos scores your Twitter activism. Orange scores your token swaps. Fuero scores your loan repayments. Pabandi scores whether you showed up to your 2 PM salon appointment and paid the deposit.

No other project has access to the data layer Pabandi is building. That data is proprietary by design — it comes from merchant relationships, AI predictions, and on-chain transaction records that only Pabandi creates.

---

# What You Can Build With This API

| Type | Use Case | Example |
|------|----------|---------|
| **Live selling** | Verify buyer reliability before accepting pay-on-delivery | Instagram/TikTok live checkout |
| **Booking platforms** | Flag high-risk appointments before confirmation | Salon, clinic, driver booking apps |
| **Marketplaces** | Weight offers/bids by seller reliability score | Bazaar, OLX-style local marketplaces |
| **Freelance tools** | Port reputation from Pabandi into gig platforms | Fiverr-style Pakistan freelance platforms |
| **Subscription gating** | Require minimum score for premium/vetted access | Community groups, wholesale access |

---

# Quick Start (30 seconds)

```bash
# 1. Get your API key from the Pabandi team
# Email: team@pabandi.com (placeholder — update when live)

# 2. Verify a user's reliability score
curl \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"wallet_address":"68AQPHecjT3Fjy1i6R7W2xpxajj2ZfDbHZvRmX2MwPKs"}' \
  https://pabandi-42c5b.web.app/api/v1/verify
```

---

# Core Concept: The Passport Object

Every verified Pabandi user has a **Passport**. It is a single snapshot of their on-chain reliability history.

```json
{
  "wallet_address": "68AQPHecjT3Fjy1i6R7W2xpxajj2ZfDbHZvRmX2MwPKs",
  "trust_score": 742,
  "score_tier": "Gold",
  "total_actions": 148,
  "punctuality_rate": 0.94,
  "completed_bookings": 139,
  "missed_bookings": 9,
  "disputes_lost": 1,
  "disputes_won": 2,
  "first_seen": "2025-08-12T00:00:00Z",
  "last_updated": "2026-06-20T18:32:00Z",
  "flags": ["repeat_no_show_resolved", "high_value_buyer"]
}
```

**Score tiers:**
- **Platinum:** 850–1000 | Top 5% of users | Eligible for highest-value transactions, no deposit required
- **Gold:** 700–849 | Reliable | Eligible for COD/live-sale transactions without staking
- **Silver:** 500–699 | Proven track record | Eligible with reduced deposit
- **Bronze:** 300–499 | New or inconsistent | Eligible with standard deposit
- **Unrated:** <300 or no history | Must deposit or pay upfront

---

# API Endpoints

## 1. Verify a User

Returns the full Passport object for a given wallet address.

```http
POST /api/v1/verify
Content-Type: application/json
Authorization: Bearer YOUR_API_KEY
```

```json
{
  "wallet_address": "68AQPHecjT3Fjy1i6R7W2xpxajj2ZfDbHZvRmX2MwPKs"
}
```

**Success (200):**
```json
{
  "status": "ok",
  "passport": {
    "wallet_address": "68AQPHecjT3Fjy1i6R7W2xpxajj2ZfDbHZvRmX2MwPKs",
    "trust_score": 742,
    "score_tier": "Gold",
    "total_actions": 148,
    "punctuality_rate": 0.94,
    "completed_bookings": 139,
    "missed_bookings": 9,
    "disputes_lost": 1,
    "disputes_won": 2,
    "first_seen": "2025-08-12T00:00:00Z",
    "last_updated": "2026-06-20T18:32:00Z",
    "flags": ["repeat_no_show_resolved", "high_value_buyer"]
  }
}
```

**Below threshold (402):**
```json
{
  "status": "below_threshold",
  "message": "User score does not meet the required tier for this transaction.",
  "required_tier": "Gold",
  "actual_tier": "Silver",
  "action_required": "deposit_required"
}
```

**Not found (404):**
```json
{
  "status": "not_found",
  "message": "No Pabandi Passport found for this address.",
  "onboarding_link": "https://pabandi-42c5b.web.app"
}
```

---

## 2. Check Eligibility (Lightweight)

For high-traffic surfaces (live selling feeds, search results) where you just need yes/no without the full Passport.

```http
POST /api/v1/eligibility
Content-Type: application/json
Authorization: Bearer YOUR_API_KEY
```

```json
{
  "wallet_address": "68AQPHecjT3Fjy1i6R7W2xpxajj2ZfDbHZvRmX2MwPKs",
  "required_tier": "Gold"
}
```

**Success (200):**
```json
{
  "status": "eligible",
  "score_tier": "Gold"
}
```

**Not eligible (402):**
```json
{
  "status": "not_eligible",
  "score_tier": "Silver",
  "action_required": "deposit_required"
}
```

---

## 3. Verify With Threshold (One-Call Decision)

Combined check: fetch Passport and enforce a minimum tier in a single call.

```http
POST /api/v1/verify
Content-Type: application/json
Authorization: Bearer YOUR_API_KEY
```

```json
{
  "wallet_address": "68AQPHecjT3Fjy1i6R7W2xpxajj2ZfDbHZvRmX2MwPKs",
  "required_tier": "Gold"
}
```

**Response:**
```json
{
  "status": "eligible",
  "passport": { /* Passport object */ }
}
```

or

```json
{
  "status": "not_eligible",
  "message": "Score too low.",
  "score_tier": "Silver",
  "action_required": "deposit_required"
}
```

---

## 4. Report an Incident (Dispute / No-Show / Fraud)

Platforms can report incidents that affect a user's score. Requires platform auth.

```http
POST /api/v1/incidents
Content-Type: application/json
Authorization: Bearer YOUR_API_KEY
```

```json
{
  "subject_wallet": "68AQPHecjT3Fjy1i6R7W2xpxajj2ZfDbHZvRmX2MwPKs",
  "incident_type": "no_show" | "fraud" | "dispute_lost" | "dispute_won",
  "reference_id": "txn_abc123",  // your internal order/booking ID
  "notes": "Buyer did not collect order #4532 from live sale.",
  "platform_id": "instagram_seller_xyz"
}
```

**Response (202 Accepted):**
```json
{
  "status": "recorded",
  "incident_id": "inc_9f3k2",
  "updated_score": 694,
  "updated_tier": "Silver"
}
```

---

## 5. Webhooks — Real-Time Score Changes

Subscribe to score changes for a user so you can react instantly (e.g., lock a seller account if score drops to Bronze).

```http
POST /api/v1/webhooks/subscribe
Content-Type: application/json
Authorization: Bearer YOUR_API_KEY
```

```json
{
  "wallet_address": "68AQPHecjT3Fjy1i6R7W2xpxajj2ZfDbHZvRmX2MwPKs",
  "callback_url": "https://yourplatform.com/api/pabandi-webhook",
  "events": ["score_changed", "tier_changed", "incident_recorded"],
  "secret": "your_webhook_secret_here"
}
```

**Webhook payload:**
```json
{
  "event": "score_changed",
  "wallet_address": "68AQPHecjT3Fjy1i6R7W2xpxajj2ZfDbHZvRmX2MwPKs",
  "old_score": 742,
  "new_score": 694,
  "old_tier": "Gold",
  "new_tier": "Silver",
  "trigger": "incident_recorded",
  "incident_id": "inc_9f3k2",
  "timestamp": "2026-06-20T18:32:00Z"
}
```

---

## 6. Onboarding Redirect — First-Time Users

If a wallet has no Passport yet, send them to Pabandi to build one.

```http
GET https://pabandi-42c5b.web.app/onboard?wallet=68AQPHecjT3Fjy1i6R7W2xpxajj2ZfDbHZvRmX2MwPKs&return_to=https://yourplatform.com
```

Returns: onboarding flow where user connects wallet + starts building reliability.

---

# Rate Limits & Quotas (Beta)

| Plan | Requests/day | Webhooks | Support |
|------|-------------|----------|---------|
| **Sandbox** | 1,000 | 1 event type | Community |
| **Growth** | 50,000 | 10 wallets | Email |
| **Enterprise** | Unlimited | Unlimited | Dedicated |

All beta plans are free. Enterprise pricing activates at 100K monthly requests.

---

# Errors

| Code | Meaning | Action |
|------|---------|--------|
| `400` | Missing or invalid `wallet_address` | Check request body |
| `401` | Missing or invalid Bearer token | Contact team for API key |
| `402` | User score below required tier | Return deposit requirement to user |
| `404` | No Passport found | Redirect user to onboarding |
| `429` | Rate limit exceeded | Backoff and retry |
| `500` | Server error | Retry after 30s; contact team if persistent |

---

# SDKs & Examples

We're building SDKs for the most common use cases. Let us know which one you need first.

| SDK | Status | Use case |
|-----|--------|----------|
| **Node.js / Express** | ✅ Beta | Server-side verification |
| **Next.js** | ✅ Beta | Frontend "Verify with Pabandi" button |
| **Python / FastAPI** | 🔄 Roadmap | Backend integration |
| **React Native** | 🔄 Roadmap | Mobile app redirection |
| **WordPress / WooCommerce** | 🔄 Roadmap | Pakistani e-commerce stores |

---

# Example: Live Selling Integration

**Scenario:** Instagram seller running a live dropshipping session. Only buyers with Gold+ score can pay on delivery.

```javascript
// Server-side Node.js example
import express from 'express';
const app = express();

app.post('/live-sale/checkout', async (req, res) => {
  const { buyer_wallet } = req.body;

  // Call Pabandi API
  const response = await fetch(
    'https://pabandi-42c5b.web.app/api/v1/verify',
    {
      headers: {
        'Authorization': `Bearer ${process.env.PABANDI_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        wallet_address: buyer_wallet,
        required_tier: 'Gold'
      }),
      method: 'POST'
    }
  );

  const result = await response.json();

  if (result.status === 'eligible') {
    // Accept order — enable "Pay on Delivery" button
    return res.json({
      checkout_allowed: true,
      tier: result.passport.score_tier,
      score: result.passport.trust_score
    });
  } else {
    // Block order — user must deposit upfront
    return res.json({
      checkout_allowed: false,
      reason: 'Score below Gold tier',
      required: result.action_required,
      deposit_amount_pab: 500
    });
  }
});
```

---

# FAQ

**Q: Is this KYC?**  
No. Pabandi is behavior-based, not identity-based. Users don't upload documents. Their score is built from actions they've already taken on the platform.

**Q: Is my user's data private?**  
You only receive the Passport object the user explicitly shares. You don't get access to their booking history or wallet transactions — only the score and tier they choose to reveal.

**Q: What if a user cheats the system?**  
Dispute resolution is handled on-chain. Sellers can report no-shows/fraud via the Incident API. Disputed cases go through a lightweight community-jury mechanism before scores are adjusted.

**Q: How do I get an API key?**  
Email team@pabandi.com with: your platform name, expected volume (requests/month), and use case. We're onboarding 10 beta partners for June 2026.

**Q: What does this cost?**  
Beta = free. Commercial pricing starts at $0.001 per verification call after beta ends.

---

# How We Protect What We Build

We're not just building an API. We're building a proprietary data and AI moat that competitors cannot replicate without years of real-world transaction history. Here is how we protect it:

## 1. The Data Moat

Pabandi's score is trained on:
- Merchant-verified booking outcomes (completed vs. no-show)
- Payment behavior (on-time vs. late vs. missed)
- AI-predicted risk signals adjusted by actual outcomes
- Cross-platform incident reports (fraud, disputes)

This dataset does not exist publicly. Ethos, Orange Protocol, and Fuero cannot access it because it is generated by Pabandi's merchant network — a network we are building exclusively.

**Protection:** The scoring model is proprietary. The training data is proprietary. The merchant relationships are proprietary.

## 2. The AI Layer

Our no-show prediction model is not a simple rule engine. It is a behavior-prediction system trained on Pakistan-specific patterns:
- Time-of-day reliability (8 PM bookings vs. 2 PM bookings)
- Service-type risk (wedding makeup vs. haircut)
- Client history weighting
- Seasonal / Ramadan / event spikes

These patterns are specific to Pakistan's service economy and are tuned by continuous feedback from real merchant outcomes.

**Protection:** Model weights and training data are kept server-side. The API exposes only the Passport output — never the underlying model or feature weights.

## 3. The On-Chain Anchor

Every Passport update is anchored on Solana. This creates an immutable audit trail that:
- Proves score history over time
- Allows anyone to verify the score hasn't been backdated or manipulated
- Enables community dispute resolution without trusting a centralized authority

**Protection:** While the API is REST, the source of truth is on-chain. Competing centralized reputation systems cannot prove their scores are tamper-proof without similar on-chain anchoring.

## 4. The Merchant Integration Layer

The API is designed for merchants, not just end users. Every live-selling platform, booking app, or marketplace needs to integrate the Passport check into their checkout or confirmation flow. We are building direct partnerships with these platforms first.

**Protection:** API access is gated. Beta keys are issued by the team. High-volume commercial access requires a partnership agreement. We do not open-source the integration layer or the merchant onboarding workflow.

## 5. The Network Effect Moat

Each new merchant makes the Passport more valuable:
- More merchants → more data points per user → more accurate score
- Better scores → more trust from partners → more merchants want to integrate
- More users → more transactions → better model

This flywheel is self-reinforcing. Once Pabandi is the standard for reliability verification in Pakistan's informal economy, switching costs for merchants and users become very high.

## 6. Defensive IP Strategy

| Asset | Protection Method |
|-------|-------------------|
| Scoring algorithm | Trade secret — model weights never exposed |
| Merchant partnerships | Contractual exclusivity in key verticals |
| API integrations | Bearer-token gated access |
| Brand / data model | Trademark on "Reliability Passport" and "Passport" object schema |
| Documentation | Public docs show product vision; source code remains private |
| On-chain registry | Immutable timestamped audit trail on Solana |

---

# Contact & Support

- **API access:** team@pabandi.com
- **Twitter:** @PabandiGlobal
- **Web:** https://pabandi-42c5b.web.app
- **Docs repo:** github.com/jweezy119/Pabandi

---

*Built for Pakistan. Not in Pakistan.*

*Wada pura karo. Inaam pao.*
