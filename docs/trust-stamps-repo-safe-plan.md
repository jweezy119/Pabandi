# Trust Stamps Implementation — Repo-Safe Execution Plan

## Verified save point
- Trust roadmap: `/home/peesee/Pabandi/docs/trust-stamps-implementation-plan.md`
- Repo state: reverted to clean working tree
- Live deploy remains safe

## Why backend trust is paused
- Prisma schema changes for `UserTrustStamp`, `UserTrustScore`, and `TrustStampType` require a migration and a regenerated Prisma client.
- Attempting the service/controller routes without client regeneration breaks `server npx tsc --noEmit`.
- Next safe backend step: add migration, run prisma generate, then wire routes.

## Frontend-safe trust work now
Do frontend trust plumbing only, gated by existing API/feature patterns.

### 1) Trust API helper
Add a typed wrapper in `client/src/services/trustApi.ts` that:
- reads current user score via `/api/trust/score/me`
- reads stamps via `/api/trust/stamps/me`
- reads action requirements via `/api/trust/requirements/:action`
- checks action access via `/api/trust/action/:actionType/check`

### 2) Design-system trust components
Add non-breaking components:
- `client/src/components/TrustBadge.tsx`
- `client/src/components/TrustGate.tsx`
- `client/src/components/SoftGateModal.tsx`

Gate every trust component behind:
- existing api client auth
- route guards already used on Profile/Auth/Booking

### 3) Profile trust section
Add one trust summary block to `ProfilePage.tsx` using existing shape/theme tokens, no route changes.

## Deployment rule for trust
- No trust table/model changes in schema without a prepared migration file
- No new trust trustStamp service import until Prisma client is regenerated
- Only additive frontend work lands before migration

## Next concrete backend unlock
1. Add `server/prisma/migrations/YYYYMMDD_add_trust_stamps/` migration
2. Run `cd server && npx prisma generate`
3. Confirm `server npx tsc --noEmit` is clean
4. Reintroduce `trustStamp.service.ts`, trust routes, and trust controller exports
