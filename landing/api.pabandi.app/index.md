# Pabandi Trust API — AI-Powered Reputation Infrastructure

> **Pricing that scales with trust.** The steeper your trajectory, the cheaper your $PAB.

## Overview

Pabandi's Trust API turns reputation into a programmable, revenue-generating layer. Three integrated products:

## Products

### 1. Trust Data Bundles (Brokerage)
Buy verifiable reputation data — no PII, no raw scores, just ZKP-attested signals.
- **$0.05** per standard bundle
- **$0.075** for rising-trust entities (velocity > 0.5)
- **15% bulk discount** at 100+ verifications/month

**Endpoint:** `POST /api/v1/monetization/trust-brokerage/bundle`

### 2. Trust API-as-a-Service
Recurring subscription: embed Pabandi trust verification into your platform.
| Tier | Price | Verifications/mo | $/verify |
|------|-------|------------------|----------|
| Starter | $99 | 1,000 | $0.099 |
| Growth | $799 | 10,000 | $0.0799 |
| Enterprise | $2,499 | Unlimited | custom |
| Pay-as-you-go | — | any | $0.15 |

**Endpoint:** `POST /api/v1/monetization/trust-api/verify`

### 3. Reputation Insurance
Get indemnified against booking no-shows, cancellations, and fraud.
- **0.5x premium** for rising-trust providers (as low as 1%)
- **5x premium** for declining-risk providers (up to 10%)
- Auto-claims backed by AI Trust Arbitrator

**Endpoint:** `POST /api/v1/monetization/insurance/underwrite`

## Quick Start

```bash
# 1. Subscribe to the API
curl -X POST https://api.pabandi.app/api/v1/monetization/trust-api/subscribe \
  -H "Content-Type: application/json" \
  -d '{"buyerId": "your-company", "buyerName": "Your Co", "tier": "STARTER"}'

# 2. Verify an entity
curl -X POST https://api.pabandi.app/api/v1/monetization/trust-api/verify \
  -H "Content-Type: application/json" \
  -d '{"apiKey": "<your-key>", "entityId": "user_123", "entityType": "CUSTOMER"}'

# 3. Underwrite insurance on a booking
curl -X POST https://api.pabandi.app/api/v1/monetization/insurance/underwrite \
  -H "Content-Type: application/json" \
  -d '{"providerId": "biz_456", "reservationId": "res_789", "coverageAmount": 500}'
```

## Live Endpoints

| Service | URL |
|---------|-----|
| API | https://api.pabandi.app |
| Trust Flux | https://api.pabandi.app/api/v1/trust/flux/:userId |
| Trust Veil | https://api.pabandi.app/api/v1/trust/veil/issue |
| Insurance | https://api.pabandi.app/api/v1/monetization/insurance/underwrite |

## How It Works

```
TrustFlux (velocity) → Pabond ($PAB price) → Insurance Premium
    ↓                   ↓                      ↓
  Rising trust      Cheaper $PAB          Lower insurance
  makes providers   → stake more          → lower rates
  better risks      → higher multiplier
```

**Contact:** partnerships@pabandi.app
