FROM node:22-slim

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# ══════════════════════════════════════════════════════════════════════════════
# Server — COMPILED, NOT COMMITTED
# ══════════════════════════════════════════════════════════════════════════════
#
# `server/dist` used to be tracked in git and this image never compiled anything:
# it copied the repo and ran whatever `dist/src/index.js` happened to contain.
# Because the build still succeeded, a stale artifact deployed as a healthy one —
# the live API ran three-week-old JavaScript while the source said otherwise, and
# nothing in CI or on Render could tell.
#
# Now the image builds from source, so the thing deployed is the thing written.
WORKDIR /app/server
# Dev dependencies are needed for the TypeScript build (NODE_ENV=production makes
# npm skip them by default); pruned again after the build.
COPY server/package*.json ./
# Dev dependencies are build tools here (typescript, prisma), not runtime ones,
# so they are installed and pruned again after the compile.
RUN npm install --include=dev
COPY server/ .
# `npm run compile`, not a bare `npx tsc`. Two reasons, both load-bearing:
#   1. tsc exits 2 on the pre-existing type errors, so a bare `npx tsc` fails
#      the build and the app never deploys. compile tolerates them by design.
#   2. compile runs scripts/build-assets.js, which stages dist/sql/*.sql. The
#      runtime table bootstrap reads those to create the fee and tokenomics
#      tables; without them it logs a warning and starts with no DDL.
# The `test -f` makes a build that silently produced no entrypoint fail loudly
# instead of deploying a container that cannot start.
RUN npm run compile && test -f dist/src/index.js
# Fails the build if src imports a package that package.json does not declare.
RUN npm run check:runtime-deps
RUN npm prune --omit=dev

WORKDIR /app

# ── Client SPA ────────────────────────────────────────────────────────────────
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install --include=dev --legacy-peer-deps
COPY client/ .
RUN npm run build

# The server serves the SPA out of its own tree, so it is copied there.
RUN mkdir -p /app/server/src/public/app && cp -r /app/client/dist/* /app/server/src/public/app/

EXPOSE 10000

WORKDIR /app/server

ENV NODE_ENV=production

CMD ["node", "dist/src/index.js"]