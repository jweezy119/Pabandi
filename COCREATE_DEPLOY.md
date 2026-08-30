# CoCreate 2026 — Deploy & Runbook

## Live Services
- Frontend: `https://pabandi-42c5b.web.app`
- Backend API: `https://pabandi-backend-97129395003.asia-south1.run.app/api/v1`
- OpenWA: local gateway session ready

## Judge Demo Path
1. Open `/business/2a3b4c5d-1111-2222-3333-444455556666`
2. Use **Claim Listing** → WhatsApp claim flow
3. Use **Pay with Tap** or **Payment Link Card** for hosted checkout
4. Open `/passport/dashboard`

## Deploy Architecture (IMPORTANT)
- **`pabandi.com` is served by Firebase Hosting** (project `pabandi-42c5b`, `public: client/dist`).
- **Render (`pabandi.onrender.com`) serves ONLY the API.** Deploying the SPA to Render does NOT update `pabandi.com`.
- To update the live site, deploy `client/dist` to Firebase (see below). This was the root cause of the "stale site" bug.

## Deploy (local, one command)
```bash
./deploy.sh            # build client + deploy SPA to Firebase Hosting (updates pabandi.com)
./deploy.sh --push     # also git push origin main (triggers Render API rebuild)
```

## CI/CD
- Push to `main` triggers `.github/workflows/deploy.yml`
  - Builds Docker image from `server/Dockerfile` (API on Render/Cloud Run)
  - Deploys frontend to Firebase Hosting (`pabandi-42c5b`)
- Requires GitHub secrets for GCP + Firebase + DB

## Database Migration
- New risk-engine tables: `marketing/add_passport_risk_signals.sql`
- Run via `.github/workflows/manual-migrate.yml`:
  - Go to GitHub Actions → Manual Prisma Migration to Supabase → Run workflow
- Required secrets: `DATABASE_URL`, `DIRECT_URL`

## Risk Engine Artifacts
- Backend: `server/src/services/passport-risk.service.ts`
- Routes: `server/src/routes/passport.routes.ts`
- Schema additions: `server/prisma/schema.prisma`
- Migration: `marketing/add_passport_risk_signals.sql`
- Frontend dashboard: `client/src/pages/PassportDashboardPage.tsx`
- Developer docs: `client/src/pages/DeveloperPortalPage.tsx`
