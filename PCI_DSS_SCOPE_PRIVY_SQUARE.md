# PCI DSS Scope Assessment: Privy + Square Integration

## Overview

This document outlines the PCI DSS (Payment Card Industry Data Security Standard) scope for the Pabandi platform's payment integrations with **Privy** (embedded wallets/auth) and **Square** (payment processing).

**Key Finding**: Pabandi does **not** directly handle, process, store, or transmit cardholder data (CHD) or sensitive authentication data (SAD). Both Privy and Square are PCI DSS Level 1 Service Providers that handle all card data processing, keeping Pabandi's systems out of PCI DSS scope.

---

## Architecture Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                        PABANDI PLATFORM                          │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐  │
│  │   Frontend   │    │    Backend   │    │   Database       │  │
│  │  (React)     │◄───►│  (Express)   │◄───►│   (PostgreSQL)   │  │
│  └──────┬───────┘    └──────┬───────┘    └──────────────────┘  │
│         │                   │                                     │
│         │ 1. Embedded       │ 2. Webhooks                       │
│         ▼                   ▼                                     │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              PRIVY (Embedded Wallets/Auth)                │   │
│  │  • User authentication (email, SMS, social)              │   │
│  │  • Embedded wallet creation (EOA / Smart Contract)       │   │
│  │  • NO card data handling                                 │   │
│  └──────────────────────────────────────────────────────────┘   │
│         │                   │                                     │
│         │ 3. Payment        │ 4. Webhooks                       │
│         ▼                   ▼                                     │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    SQUARE (Payment Processing)            │   │
│  │  • Card tokenization (client-side)                       │   │
│  │  • Payment processing (server-side)                      │   │
│  │  • Refunds, disputes, payouts                            │   │
│  │  • PCI DSS Level 1 Certified                             │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Privy Integration Analysis

### What Privy Handles
- User authentication (email/password, SMS, social login)
- Embedded wallet creation and management (EOA and Smart Contract wallets)
- Transaction signing (user-authorized, via RPC providers)
- Key management (MPC-based key shards)
- Session management

### What Privy Does NOT Handle
- ❌ Credit/debit card numbers (PAN)
- ❌ CVV/CVC codes
- ❌ Card expiration dates
- ❌ Track data (magnetic stripe/chip)
- ❌ PINs or PIN blocks
- ❌ Any cardholder data (CHD)
- ❌ Any sensitive authentication data (SAD)

### PCI DSS Impact
**Privy is NOT a payment processor.** It provides authentication and wallet infrastructure only. Since no card data flows through Privy, it has **zero PCI DSS scope impact** on Pabandi.

### Compliance Notes
- Privy is SOC 2 Type II certified
- Privy uses MPC (Multi-Party Computation) for key management
- No cardholder data ever touches Privy's systems

---

## Square Integration Analysis

### What Square Handles (PCI DSS Level 1 Service Provider)
Square is a **PCI DSS Level 1 Certified Service Provider** (highest level). They handle:

1. **Card Tokenization (Client-Side)**
   - Square Web Payments SDK / In-App Payments SDK
   - Card data entered directly into Square's iframes/mobile SDKs
   - Returns a **nonce** (single-use token) to Pabandi frontend
   - **Pabandi never sees raw card data**

2. **Payment Processing (Server-Side)**
   - Pabandi backend sends nonce to Square API
   - Square processes authorization/capture
   - Square handles 3D Secure, fraud detection, network routing

3. **Card Storage (Card on File)**
   - Square stores tokenized cards in their vault
   - Returns `card_id` for future payments
   - Pabandi stores only `card_id` (non-sensitive reference)

4. **Refunds, Disputes, Chargebacks**
   - Handled entirely by Square
   - Webhooks notify Pabandi of status changes

5. **Payouts to Bank Accounts**
   - Square manages merchant payouts
   - Pabandi triggers payout via API

### What Pabandi Stores (Non-Sensitive)
| Data | PCI Classification | Notes |
|------|-------------------|-------|
| `square_customer_id` | Non-sensitive | Reference to Square customer |
| `square_card_id` | Non-sensitive | Token reference, not PAN |
| `square_location_id` | Non-sensitive | Merchant location reference |
| `payment_amount` | Non-sensitive | Transaction amount |
| `payment_status` | Non-sensitive | pending/completed/failed/refunded |
| `square_payment_id` | Non-sensitive | Square's transaction ID |
| `square_refund_id` | Non-sensitive | Square's refund ID |
| Webhook signatures | Non-sensitive | For verification only |

### What Pabandi Does NOT Store
- ❌ Full PAN (Primary Account Number)
- ❌ CVV/CVC
- ❌ Expiration date
- ❌ Track data
- ❌ PIN data
- ❌ Cardholder name (from card)
- ❌ Any raw card data

### Square Webhooks (Server-to-Server)
- Verified via `Square-Signature` header (HMAC-SHA256)
- Payload contains: payment IDs, status, amounts, timestamps
- **No cardholder data in webhook payloads**

---

## Pabandi's PCI DSS Scope Determination

### Self-Assessment Questionnaire (SAQ) Type
**SAQ A** - Card-not-present merchants (e-commerce) that fully outsource all cardholder data functions to PCI DSS validated third parties.

**Rationale:**
1. All card data capture happens on Square's client-side SDKs (iframes/SDKs)
2. All card data processing/storage happens on Square's infrastructure
3. Pabandi only receives and stores non-sensitive tokens/references
4. No cardholder data touches Pabandi's systems, networks, or logs

### Attestation of Compliance (AoC)
- Pabandi completes **SAQ A** annually
- Square provides **AoC** as Level 1 Service Provider
- Privy provides **SOC 2 Type II** report (not PCI, but relevant for security posture)

---

## Data Flow Documentation

### 1. Customer Payment Flow
```
Customer Browser/App
       │
       ▼
┌──────────────────┐
│ Square Web SDK   │ ◄── Card data entered HERE (Square's iframe)
│ (Client-Side)    │
└────────┬─────────┘
         │ Returns nonce (token)
         ▼
┌──────────────────┐
│ Pabandi Frontend │ ◄── Receives nonce only
└────────┬─────────┘
         │ Sends nonce to backend
         ▼
┌──────────────────┐
│ Pabandi Backend  │ ◄── Receives nonce only
└────────┬─────────┘
         │ POST /v2/payments { nonce, amount, ... }
         ▼
┌──────────────────┐
│ Square API       │ ◄── Processes payment, returns payment_id
│ (Server-Side)    │
└──────────────────┘
```

### 2. Card on File Flow
```
Customer adds card
       │
       ▼
┌──────────────────┐
│ Square Web SDK   │ ◄── Card data entered in Square iframe
│ (Card Form)      │
└────────┬─────────┘
         │ Returns card_nonce
         ▼
┌──────────────────┐
│ Pabandi Backend  │ ◄── POST /v2/cards { card_nonce, customer_id }
└────────┬─────────┘
         │ Returns card_id
         ▼
┌──────────────────┐
│ Pabandi Database │ ◄── Stores card_id (NON-SENSITIVE)
└──────────────────┘
```

### 3. Webhook Flow
```
Square Event (payment.updated, refund.created, etc.)
       │
       ▼
┌──────────────────┐
│ Square Webhook   │ ◄── Signed with HMAC-SHA256
│ Delivery         │
└────────┬─────────┘
         │ POST /webhook/square { entity_id, event_type, ... }
         ▼
┌──────────────────┐
│ Pabandi Backend  │ ◄── Verifies signature, processes event
│ (Webhook Handler)│     NO card data in payload
└──────────────────┘
```

---

## Security Controls Implemented

### Network Security
- [x] TLS 1.2+ for all external communications
- [x] Square webhook endpoint validated via HMAC signature
- [x] API keys stored in environment variables (not code)
- [x] Rate limiting on payment endpoints

### Access Control
- [x] Role-based access to payment admin functions
- [x] MFA required for admin access
- [x] Audit logging for all payment operations

### Monitoring & Logging
- [x] Payment webhook processing logged (no card data)
- [x] Failed payment attempts logged
- [x] Anomaly detection on payment patterns

### Vulnerability Management
- [x] Dependency scanning (npm audit, Snyk)
- [x] Regular security updates
- [x] Square SDK kept up to date

---

## Compliance Checklist

| Requirement | Status | Evidence |
|-------------|--------|----------|
| **SAQ A Completed** | ☐ Planned | Annual self-assessment |
| **Square AoC Received** | ☐ Annual | Square provides via dashboard |
| **Privy SOC 2 Reviewed** | ☐ Annual | Privy provides via trust center |
| **Webhook Signature Verification** | ✅ Implemented | `webhookVerifier.ts` |
| **Token Storage Only** | ✅ Verified | Code review: only `card_id`, `customer_id` stored |
| **No Card Data in Logs** | ✅ Verified | Log sanitization in place |
| **TLS 1.2+ Enforced** | ✅ Configured | Helmet, server config |
| **Incident Response Plan** | ☐ Planned | Includes payment data breach procedures |

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Card data leakage via logs | Low | High | Structured logging excludes payment fields; log sanitization |
| Webhook replay attacks | Low | Medium | Timestamp validation, idempotency keys |
| Square account compromise | Low | High | MFA on Square dashboard; limited API permissions |
| Privy key compromise | Low | High | MPC key shards; no single point of failure |
| Dependency vulnerability | Medium | Medium | Automated scanning; weekly updates |

---

## Recommendations

1. **Annual Review**: Update this document annually or when integration changes
2. **Penetration Testing**: Include payment flows in annual pentest scope
3. **Vendor Monitoring**: Subscribe to Square and Privy security advisories
4. **Token Rotation**: Implement periodic card token refresh for stored cards
5. **Webhook Idempotency**: Ensure all webhook handlers are idempotent (already implemented)

---

## References

- [PCI DSS SAQ A](https://www.pcisecuritystandards.org/documents/SAQ-A-v3_2_1.pdf)
- [Square PCI Compliance](https://squareup.com/help/us/en/article/5069-pci-compliance-and-square)
- [Privy Security](https://docs.privy.io/security)
- [Square Web Payments SDK](https://developer.squareup.com/docs/web-payments/overview)
- [Square Webhooks](https://developer.squareup.com/docs/webhooks/overview)

---

## Document Control

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-11-25 | Kilo | Initial assessment for Privy + Square |