# Pabandi Partner Dashboard — Plan
_Planned for CoCreate follow-up after review/trust UX._

## Why
- Growth Partners program needs a partner-visible dashboard:
  referrals invited, sign-ups verified, bookings completed, expected payout, capped/frozen state.
- Captures exact page goal, routing, auth model, API surface, and partner invite UX
  before frontend work to avoid shipping broken entry points.

## Goals
1. One authenticated dashboard for growth partners / account managers.
2. Show verified referrals and 7-day earnings forecast.
3. Surface program caps, freeze state, and payout history.
4. Generate copy-paste invite links with source tracking.
5. Keep mobile-first one-handed UX consistent with `/business/dashboard`.

## Routing
- `/partners/dashboard` — main partner dashboard
- `/partners/invite` — simple share/CTA page
- `/partners/payouts` — payout ledger + KYC/program caps

## Auth
- Reuse `useAuthStore`.
- Only roles `PARTNER`, `BUSINESS_OWNER`, `ADMIN` can access.
- If not authorized, redirect to `/login?redirect=/partners/dashboard`.

## API surface to add
- `GET /partners/me`
- `GET /partners/referrals`
- `POST /partners/invite/create`
- `GET /partners/payouts`

## Components
- `PartnerDashboardPage.tsx`
- `PartnerInvitePage.tsx`
- `PartnerPayoutsPage.tsx`

## Next step
- Confirm if partner role/model exists in `server/prisma/schema.prisma`.
- If yes, build pages + routes; if not, do schema + backend first.
