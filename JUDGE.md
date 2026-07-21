# Pabandi — Alibaba CoCreate 2026 Judge Packet

## 0. Demo Screencast
- Captured screencast: `Screencast from 2026-07-21 09-40-19.webm`
- Frames extracted: `/home/peesee/Pabandi/.hermes/desktop-attachments/screencast-frames/`

## 1. What to open
- Open this exact URL on mobile first:
  - `https://pabandi-42c5b.web.app/business/2a3b4c5d-1111-2222-3333-444455556666`
- If that business is not seeded in the live database, use the public business profile search or `/business/:id` with any valid business ID from the Firebase console or backend admin panel.

## 2. Screenshot checklist (mobile right-handed flow)
1. Business profile hero — unclaimed banner + “Claim Listing” CTA visible
2. Tabs visible — Overview, Promotions, Reviews, Media
3. Claim Listing — tap → WhatsApp claim overlay modal
4. Pay with Tap — visible in hero or business detail
5. Hosted payment link card — copy, WhatsApp share, open checkout
6. Passport Dashboard — animated score, axes, compute/export actions
7. Developer Portal — endpoints list + risk engine docs section

## 3. Demo actions (fastest)
- Claim flow: tap Claim Listing → WhatsApp message pre-filled
- Checkout flow: tap Pay with Tap or open hosted payment card
- Trust flow: open `/passport/dashboard`, compute score, record stake

## 4. Judge-facing value statements
- Real checkout path is live and shareable via WhatsApp.
- Business profile ownership claim is zero-code and mobile-first.
- Passport Dashboard exposes a breakthrough multi-axis trust engine.
- OpenWA-first WhatsApp outreach is integrated into the outreach surface.

## 5. Live system status
- Frontend: `https://pabandi-42c5b.web.app`
- Backend API: `https://pabandi-backend-97129395003.asia-south1.run.app/api/v1`
- Health: `https://pabandi-backend-97129395003.asia-south1.run.app/health`
- Cloud Run deploy: `.github/workflows/deploy.yml`
- Live schema migration: `.github/workflows/manual-migrate.yml` + `marketing/add_passport_risk_signals.sql`
