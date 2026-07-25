# Backend Hardening Roadmap
This captures the highest-signal efficiency and safety fixes found from enabling stricter TypeScript checks and auditing production-bound backend code.

## Verified pre-work
- `server/tsconfig.json` now includes:
  - `noUnusedLocals`
  - `noUnusedParameters`
  - `noFallthroughCasesInSwitch`
  - `noImplicitReturns`
- Verified client `tsc --noEmit` remains clean after shared `getAuthToken()` helper rollout.
- Frontend trust components now route token gating through `client/src/utils/authToken.ts` instead of scattered `localStorage.getItem('token')` calls.
- Added shared `server/src/utils/apiResponse.ts` helpers `ok()` and `fail()` for typed API envelopes.

## Completed patches
- `server/src/controllers/checkout.controller.ts` - standardized response wrappers with `ok()`/`fail()`.
- `server/src/controllers/trust.controller.ts` - added strict response interfaces for public trust endpoints.
- `server/src/controllers/external.controller.ts` - migrated loose `res.status(...).json({...})` success/error wrappers to shared helpers.
- `server/src/controllers/hospitality.controller.ts` - migrated JSON-API responses to `ok()`/`fail()`; fixed Beds24/Cloudbeds webhook success paths to preserve existing timing.

## Remaining improvement clusters
1. **Unused imports/code removal**
   - Most common: `req`, `res`, `next`, domain services imported but never referenced.
   - High-volume files: `src/controllers/*`, `src/services/*`, `src/routes/*`.

2. **Return-path completeness**
   - Controller handlers switch early but continue after success without returning.
   - Example: `controllers/hospitality.controller.ts`, `controllers/admin.controller.ts`.

3. **Direct console usage in backend**
   - `src/utils/logger.ts` already exists for PII-redacted structured logging.
   - Many controllers/routes/services still call `console.log/warn/error` directly.
   - Migrate to `logger.*` or a small `logCaution` payload wrapper in place.

4. **Controller DTO/body typing**
   - Replace ad-hoc casts like `req.body as ...` with explicit interfaces and validation.
   - Target: `controllers/trust.controller.ts`, `controllers/hospitality.controller.ts`.

5. **Passport callback DRY**
   - `src/utils/passport.ts` repeats profile lookup/create/update for Google/Facebook/Twitter/LinkedIn/TikTok.
   - Extract `socialUsers.resolveSocialAccount({provider, profile, role})` helper.

6. **Business controller duplication**
   - OSM / LocationIQ / Overpass search + caching is split between `controllers/business.controller.ts` and `routes/business.routes.ts`.
   - Move to `services/businessSearch.service.ts` plus mapper/cache helpers.

## Suggested next patch targets
- `src/services/trustAttestation.service.ts` - unused `logger`
- `src/services/trustSignal.service.ts` - unused `buildHeaderValue` and param
- `src/controllers/badge.service.ts(162)` - unused `breakdown`
- `src/services/cryptoService.ts(597,642)` - unused vars
- `src/controllers/trust.controller.ts` - unused imports + return paths
- `src/controllers/admin.controller.ts` - unused imports + return paths
- `src/routes/livesell.routes.ts` - console → logger + implicit returns

## Execution policy
- Max 3 surgical edits per file.
- Always run `cd server && ./node_modules/.bin/tsc --noEmit` before committing.
- Use live probes only where auth and backend routes are already wired.
