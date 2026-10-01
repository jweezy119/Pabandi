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
COPY server/package*.json ./
# Dev dependencies are required to build: typescript and prisma are build tools,
# not runtime ones. NODE_ENV is set after the build rather than before it, so
# npm does not silently skip them.
RUN npm install --include=dev
COPY server/ .
RUN npx prisma generate && npx tsc

WORKDIR /app

# ── Client SPA ────────────────────────────────────────────────────────────────
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install --include=dev
COPY client/ .
RUN npm run build

# The server serves the SPA out of its own tree, so it is copied there.
RUN mkdir -p /app/server/src/public/app && cp -r /app/client/dist/* /app/server/src/public/app/

# ── Runtime: production dependencies only ─────────────────────────────────────
# Drops the ~800MB of build tooling pulled in above.
WORKDIR /app/server
RUN npm prune --omit=dev

ENV NODE_ENV=production
EXPOSE 10000

CMD ["node", "dist/src/index.js"]