# Pabandi — CoCreate 2026 Submission Summary

## What Pabandi Does
Pabandi is a trust-first booking and payments platform for the informal economy: restaurants, live sellers, freelancers, and hospitality venues. It combines booking, reputation, WhatsApp-native outreach, Web3 deposits, and a multi-axis “passport” trust engine in one mobile-first product.

## CoCreate Positioning
- Business opportunity: informal economy businesses have no portable trust layer.
- Breakthrough: Pabandi Passport Risk Engine scores users across multiple axes beyond identity.
- Wedge: zero-code hosted payment links + Shopify integration for merchants who can’t edit code.
- Distribution: OpenWA-first WhatsApp gateway with plugin-aware messaging.

## Demo Path (fastest)
1. Open `https://pabandi-42c5b.web.app/business/2a3b4c5d-1111-2222-3333-444455556666`
2. Explore tabs: Overview, Promotions, Reviews, Media
3. Use “Claim Listing” → WhatsApp claim flow
4. Use “Pay with Tap” / payment link card for hosted checkout
5. Open `/passport/dashboard`

## Live Artifacts
- Frontend: https://pabandi-42c5b.web.app
- Backend: https://pabandi-backend-97129395003.asia-south1.run.app/api/v1
- OpenWA: local gateway with active session ready
- Firebase Hosting, Cloud Run backend

## Recommended Hooks
- Seller → Business Dashboard → Passport Dashboard
- Buyer → reservation → success receipt → WhatsApp share
- Admin/Dev → Developer Portal docs
- Judge attention: real checkout path + mobile claim UX + visible trust scores
