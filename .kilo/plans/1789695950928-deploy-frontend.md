# Deployment Plan

## Current State

- Git repo: `git@github.com:jweezy119/Pabandi.git`
- Local branch `main` is **1 commit ahead** of `origin/main`
- Uncommitted work: **none**
- Latest commit: `8d9307eef` - feat: implement business type management dashboard and profile access

## What the commit contains

- `client/src/App.tsx`:
  - `/dashboard` now uses `EnhancedDashboardPage`
  - New `/profile` route mapped to `ProfilePage`
- `client/src/pages/EnhancedDashboardPage.tsx`:
  - Business type selector
  - AI service integration for market insights
  - Filtered widgets per business type

## Infrastructure reality check

From `deploy.sh` and repo state:

| Layer | Provider | Path / URL |
|-------|----------|------------|
| Frontend SPA | Firebase Hosting | `pabandi.com` / `pabandi-42c5b.web.app` |
| Backend API | Render | `pabandi.onrender.com` |
| Database | Not confirmed in repo metadata | Likely Alibaba RDS per user statement |
| Source of truth | GitHub | `origin/main` |

Important: The repo metadata says Render hosts the API and Firebase hosts the SPA. If backend is actually on Alibaba RDS, that is the database backing the Render API, not a separate deploy target.

## Deployment steps

1. **Build client**
   - `cd client && npm run build`
   - Output: `client/dist`

2. **Deploy SPA to Firebase Hosting**
   - `firebase use pabandi-42c5b`
   - `firebase deploy --only hosting`
   - This updates `pabandi.com`

3. **Push to GitHub**
   - `git push origin main`
   - This can trigger Render API rebuild if webhook is configured

4. **Verify**
   - Frontend: https://pabandi.com/ (hard-refresh)
   - API health: https://pabandi-backend-97129395003.asia-south1.run.app/health

## Notes

- Do not deploy the SPA to Render; Render is for the API only.
- If the user wants DB migrations or backend-specific deployment, that should be handled separately from this frontend deploy.
- If backend has moved off Render, ignore the Render webhook trigger and deploy backend separately.
