#!/usr/bin/env bash
# Pabandi combined deploy — keeps pabandi.com in sync with the latest SPA.
#
# WHY THIS EXISTS:
#   pabandi.com is served by FIREBASE HOSTING (project pabandi-42c5b, public=client/dist).
#   Render only serves the API (pabandi.onrender.com). Deploying the SPA to Render does
#   NOT update pabandi.com — that was the "stale site" bug. The SPA must be pushed to
#   Firebase. This script does that in one command.
#
# WHAT IT DOES:
#   1. Build the client SPA (client/dist).
#   2. Deploy client/dist to Firebase Hosting  -> pabandi.com + pabandi-42c5b.web.app.
#   3. (Optional) git push to trigger a Render API rebuild.
#
# THE API NOW BUILDS FROM SOURCE:
#   `server/dist` is no longer committed. The Dockerfile runs `prisma generate && tsc`,
#   so Render compiles the API from the pushed source. Previously the image copied a
#   committed artifact and ran it, which meant a correct push could deploy stale
#   JavaScript and still report a successful build.
#
#   Note: `autoDeploy: true` on Render means any push to main deploys immediately,
#   with no staging gate. For a deliberate deploy, set autoDeploy to false first,
#   push, verify, then re-enable.
#
# MIGRATIONS:
#   These run out-of-band via .github/workflows/manual-migrate.yml (`prisma migrate
#   deploy`), NOT as part of the Render deploy — render.yaml's preDeployCommand is a
#   no-op. So a schema change in this commit will NOT be applied by pushing alone.
#
# USAGE:
#   ./deploy.sh            # build + firebase deploy only
#   ./deploy.sh --push     # also git push origin main (triggers Render API rebuild)
#
set -euo pipefail

# Resolve repo root (script lives at repo root).
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

export PATH="$HOME/.local/bin:$PATH"

echo "==> [1/3] Building client SPA..."
( cd client && npm run build )
echo "    build done: client/dist"

echo "==> [2/3] Deploying SPA to Firebase Hosting (pabandi-42c5b)..."
firebase use pabandi-42c5b >/dev/null
firebase deploy --only hosting
echo "    pabandi.com should now serve the freshly built bundle."

if [[ "${1:-}" == "--push" ]]; then
  echo "==> [3/3] Pushing to origin/main to trigger Render API rebuild..."
  git add -A
  git commit -m "deploy: rebuild SPA + API" || echo "    (nothing to commit)"
  git push origin main
  echo "    Render will rebuild the API shortly."
else
  echo "==> [3/3] Skipped git push (no --push). Render API unchanged."
  echo "    To also rebuild the API: ./deploy.sh --push"
fi

echo "==> Done. Verify: https://pabandi.com/ (hard-refresh if cached)"
