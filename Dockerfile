FROM node:22-slim

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production

# ---- Server ----
WORKDIR /app/server
# Dev dependencies are needed for the TypeScript build (NODE_ENV=production makes
# npm skip them by default); pruned again after the build.
COPY server/package*.json ./
RUN npm install --include=dev
COPY server/ .
# Compile the server here, never ship a committed dist/ — a stale prebuilt
# dist silently deploys code that predates the source it was built from.
RUN npm run compile && test -f dist/src/index.js
# Fails the build if src imports a package that package.json does not declare.
RUN npm run check:runtime-deps
RUN npm prune --omit=dev

# ---- Client ----
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install --include=dev --legacy-peer-deps
COPY client/ .
RUN npm run build

RUN mkdir -p /app/server/src/public/app && cp -r /app/client/dist/* /app/server/src/public/app/

EXPOSE 10000

WORKDIR /app/server

CMD ["node", "dist/src/index.js"]
