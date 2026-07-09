# Pabandi API — 1-Page Developer Summary

## What Is This?

Pabandi exposes a portable reliability score for the global service economy.  
Use it to reduce fraud on live sales, marketplaces, bookings, and freelance platforms.

**Base URL:** `https://pabandi.com/api/v1`  
**Auth:** Bearer token  
**Contact:** team@pabandi.com

---

## Core Idea

Users build a Trust Score through real behavior (showing up, paying on time, completing bookings).  
Platforms verify that score before allowing high-risk transactions.

No KYC. Behavior-based reputation on-chain.

---

## The Passport

```json
{
  "wallet_address": "...",
  "trust_score": 742,
  "score_tier": "Gold",
  "total_actions": 148,
  "punctuality_rate": 0.94,
  "completed_bookings": 139,
  "missed_bookings": 9
}
```

**Tiers:**
- **Platinum** (850–1000) — no deposit
- **Gold** (700–849) — COD/live-sale OK
- **Silver** (500–699) — reduced deposit
- **Bronze** (300–499) — standard deposit
- **Unrated** (<300) — prepay only

---

## API

| Call | Purpose |
|---|---|
| `POST /api/v1/verify` | Full Passport + optional tier check |
| `POST /api/v1/eligibility` | Yes/no tier check only |
| `POST /api/v1/incidents` | Report no-show / fraud |
| `POST /api/v1/webhooks/subscribe` | Real-time score-change alerts |

**Quick test:**

```bash
curl \
  -H "Authorization: Bearer ***" \
  -H "Content-Type: application/json" \
  -d '{"wallet_address":"68AQPHecjT3Fjy1i6R7W2xpxajj2ZfDbHZvRmX2MwPKs","required_tier":"Gold"}' \
  https://pabandi.com/api/v1/verify
```

---

## Revenue Model

- Per-verification call (~$0.001 after beta)
- $PAB staking for buyers
- Fraud-report rewards in $PAB
- Seller subscriptions

---

## Why Now

The global service economy is $15T+ with fragmented trust infrastructure. Booking platforms, marketplaces, and freelance workflows all run on reputation with no portable verification layer. Pabandi turns that trust into a verified, portable, on-chain asset.

**Commitment, secured.**
