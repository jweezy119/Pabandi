# Pabandi — Proactive Trust Web3 Execution Plan v3.1
> Plan-only grounded in current repo state. No implementation started.

## 1. Repo reality check
What actually exists:
- `server/src/services/passport-risk.service.ts`
- `passport.routes.ts` gated by `apiKeyAuth`
- `passport.service.ts` score assembly
- `trustAttestation.service.ts` signed attestation issuance
- `trust.controller.ts` + `trust.routes.ts`
- `blockchain.service.ts` + BSC escrow scaffolding
- `cryptoService.ts` BSC escrow call placeholders
- `reservation.controller.ts` escrow release/refund calls
- `shopify-integration.routes.ts` cart JSON → escrow checkout flow
- `shopify.controller.ts` + `shopify.routes.ts`
- `live-seller.service.ts` + `livesell.routes.ts`
- `UniversalCheckoutPage.tsx` with live-aware params
- `BusinessDashboard.tsx`, `LiveSellerPanel.tsx`, `LiveSellingPage.tsx`, `LiveSellCustomerPage.tsx`
- `client/public/shopify-widget.js` standalone script
- OpenWA plugin/after-hours/chat-flow modules

What does NOT exist:
- DAE calculator module with category-aware curve
- PoP service/route/controller
- Calibrated reasoning exposed to checkout
- TrustKeyring component
- Checkout wiring for Web3 verified + dynamic escrow
- `passport.routes.ts` mounting for DAE/PoP
- Evidence packages tied to dispute flows
- Shopify no-code install path beyond script fallback

## 2. North Star
Make trust proactive and verifiable:
- Escrow adapts in real time, not as a punishment
- Presence/intent evidence is automatic
- Wallet becomes a trust keyring, not just login
- Category-specific passports feel native

## 3. Advanced plan

### 3.1 DAE Core
- New backend service or module: `dynamic-escrow.service.ts`
  - Inputs: user id, category, transaction value, web3 stake count, streak count
  - Outputs: suggestedEscrowPercentage, trustFrictionScore, reasoning
- Route: `POST /api/v1/checkout/dynamic-escrow`
- Frontend:
  - Fetch DAE in `UniversalCheckoutPage.tsx`
  - Render adaptive deposit preview with countdown/release rule
  - Show tier/Web3 badge before final submit

### 3.2 PoP Layer
- New service/route/controller: `pop.service.ts`, `pop.routes.ts`, `pop.controller.ts`
- Events:
  - INTENT via WhatsApp button
  - ARRIVED via merchant/nav geofence-ish coarse timestamp
  - NO_SHOW after 15-minute window
- Evidence package:
  - Attach to Dispute via `disputeId` or `reservationId`
- UX:
  - One-tap “I’m on my way” in universal checkout
  - Merchant one-tap start/fulfill in dashboard

### 3.3 Wallet-First Trust Keyring
- New component: `TrustKeyring.tsx`
- Backend endpoints:
  - GET `/api/v1/wallet/trust-keyring`
  - POST `/api/v1/wallet/connect`
- State:
  - KYC-light attestation
  - pledge status
  - category attestations array
- Displays:
  - Active attestations
  - Web3 status
  - deposit reduction estimates by category

### 3.4 Category-Specific Passport Wiring
- Extend `MyPassportResult` to include domain modules:
  - live_selling reliability metrics
  - freelancer milestone metrics
  - hospitality punctuality metrics
  - ecommerce escrow fulfillment metrics
- Backend uses new `passport-score-axis` query
- Frontend shows category module breakdown in Passport Dashboard

### 3.5 Shopify Trust Experience
- Remove script-only path from the page
- Add merchant install flow using OAuth paths
- Order callback annotates trust and escrow state
- Checkout UI shows Pabandi Protection badge + DAE amount

### 3.6 Live Seller Escrow Snapshot
- `UniversalCheckoutPage` accepts `showId`, `itemId`
- API: `/api/v1/livesell/:platform/checkout-preview`
- Checkout snapshot includes live-show trust flavor

## 4. Execution order
1. DAE backend module + route + checkout wiring
2. PoP events + dispute attachment
3. Trust Keyring component + wallet endpoints
4. Category passport expansion
5. Shopify install UX replacement
6. Live checkout preview

## 5. Next decision
1. Start DAE now
2. Start DAE + PoP together
3. Start wallet keyring + DAE together
