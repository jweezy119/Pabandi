# Sitara OS — Sprint 1 Build Status

## ✅ Backend (Sprint 1)

### Schema Changes (`schema.prisma`)
- Extended `PabandiReview` model: added `starPoints`, `upvoteCount`, and `upvotes` relation
- Added `StarPower` model: per-user point tracking with tier caching
- Added `StarPromo` + `StarPromoRedemption` models: business-to-reviewer promo system
- Extended `User` model: added `starPowerTier`, `starPowerPoints` cached fields

### API Endpoints (new + extended)
- `POST /api/v1/reviews` — create verified review, auto-awards star points + $PAB
- `POST /api/v1/reviews/:id/upvote` — upvote (requires verified check-in at same business)
- `GET /api/v1/reviews/:id/upvotes` — list upvotes on a review
- `GET /api/v1/reviews/star-power/:userId` — get user's Star Power profile
- `GET /api/v1/reviews/star-power/business/:businessId` — business leaderboard
- `GET /api/v1/sitara/star-finder` — operator finds top reviewers by tier
- `POST /api/v1/sitara/promos` — operator sends promo to a star tier
- `GET /api/v1/sitara/my-promos` — consumer sees promos matching their tier
- `POST /api/v1/sitara/redeem/:code` — consumer redeems a promo

### Controllers
- `pabandiReview.controller.ts` — full rewrite with Star Power logic
- `sitaraStarPower.routes.ts` — new routes for Star Finder + promo system

## ✅ Frontend (already scaffolded in previous session)
22 files for 3 sub-apps: consumer booking flow, operator dashboard, tenant portal

## ✅ Integration (Sprint 2 — verified 2026-09-09)
- Backend `tsc --noEmit` clean; schema validates; Prisma client regenerated.
  Deploy applies schema automatically (`prisma db push` in Dockerfile CMD).
- Sitara mounted at `/sitara/*` in main `App.tsx`; inner routes relative.
- All internal links prefixed (`/sitara/book/...`, `/sitara/operator/...`, `/sitara/tenant/...`).
- Client `tsc` clean + `vite build` passes (4134 modules, 5s).
- Fixed along the way: missing Prisma back-relations, `propertyActivity` wrong-shape write,
  star-finder/leaderboard querying a non-existent relation (rewritten as review aggregation),
  ConsumerLayout wrong import depth, `verification.ts` now dependency-free stub.

## ✅ Slice 2 — customer/promoter/business wiring (uncommitted)
- `sitara/api/sitaraApi.ts`: typed client over the shared auth apiClient.
- Customer: Promos Inbox (`/sitara/promos`, redeem by code/button), Star Card reads live
  Star Power with local fallback, My Bookings shows real platform reservations + local demo bookings.
- Promoter: `/sitara/promoter` dashboard (stats, referral link, recent bookings) on existing
  promoter backend; header/footer nav added. Full PromoterOS still at `/promoter`.
- Business: `/sitara/operator/customers` — CRM patrons + Star-ranked reviewers in one view,
  links out to full CRM at `/business/crm`; sidebar Customers entry.
- POS seam (no POS built): `POST /sitara/redemptions/:id/use` lets an operator mark a
  redemption consumed — the call a future POS will take over.
- Verified: server tsc clean, client tsc clean, vite build passes.

## ✅ Slice 3 — real booking loop + operator promos + brand mark (uncommitted)
- Backend: `GET /sitara/promos` (owner promo list w/ redemption counts).
- Consumer loop is real end-to-end: Discovery loads platform businesses (✓ Live badge,
  mock fallback) → Booking creates a real reservation when signed in on a live venue
  (reservationId carried on the local booking) → Check-In attempts platform verify →
  Review posts a real verified review; every step degrades honestly to demo mode.
- Operator: Star Finder + Promos pages on live data (send/create/list), mocks as fallback.
- Brand: `SitaraLogo` SVG monogram in header, footer, both sidebars.
- Verified: server tsc clean, client tsc clean, vite build passes.

## ✅ Slice 4 — linked sign-in + promoter hub on real backend (uncommitted)
- One login drives everything: SitaraApp mirrors the Pabandi session (+ live Star Power)
  into the Sitara store. Demo signed-out state untouched.
- Promoter API was pointing at dead singular `/promoter/*` endpoints — rewired to the real
  `/promoters/*` backend (me/stats/bookings/wallet/leaderboard/ref-link/register).
- Promoter Hub: become-a-promoter onboarding, stats, wallet, referral link + copy,
  attributed guests, leaderboard, Star Power referral note, jump-off to full PromoterOS.
- Verified: client tsc clean, vite build passes. (No server change needed.)

## ✅ Slice 5 — payment rails + tenant/operator live data (uncommitted)
- Payment rails ready: booking creates a deposit payment (`POST /payments`) against the
  live reservation; Safepay checkout URL surfaces as a Pay button when external.
  Rail is reservation → payment record → gateway — POS plugs into the same calls.
- Tenant portal: dashboard + lease pages read real leases from `/tenant/dashboard`
  (mock fallback). $PAB wallet already visible via linked auth session.
- Operator dashboard: live reservations/reviews/promos counts per owned business.
- Verified: server tsc clean, client tsc clean, vite build passes.

## ✅ Slice 6 — reservations complete + Square geo import (uncommitted)
- Reservations front+back: cancel flow in My Bookings (policy enforced server-side),
  no-past-dates guard in booking. Backend already had trust gates/hours/policy.
- Square: OAuth connect → locations import writes lat/lng/address onto the business
  (`SquareConnection` model, token refresh, re-sync). Honest 503 until
  SQUARE_APP_ID/SECRET set. Operator dashboard card handles the full loop.
- Note: Square has no 3rd-party discovery API — merchant-location import is the real
  geo answer; Foursquare/Yelp/OSM remain the public discovery sources.
- Verified: server tsc clean, client tsc clean, vite build passes.

## ❌ Remaining
- Branding: logo, colors, favicon, CSS variables
- Frontend pages need API service hooks (currently using mock data + local Zustand state)
- Smart contracts for on-chain SBT minting of reviews
