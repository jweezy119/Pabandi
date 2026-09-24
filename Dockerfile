FROM node:22-slim

ARG CACHE_BUST=2026092401
RUN echo "Cache bust: $CACHE_BUST" && date > /build-date.txt

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production

# Copy server package files (force fresh install)
COPY server/package*.json ./server/
WORKDIR /app/server
RUN npm install --include=dev --force

# Copy server source (includes schema.prisma)
COPY server/ .

# Generate Prisma client (force clean)
RUN rm -rf node_modules/.prisma && npx prisma generate

# Build TypeScript (1.7GB heap to avoid OOM on Render's 2GB starter)
RUN rm -rf dist .tsbuildinfo && NODE_OPTIONS=--max-old-space-size=1700 npx tsc --noEmitOnError false && node -e \"require('fs').cpSync('src/public','dist/src/public',{recursive:true})\"

# Build client (static files)
WORKDIR /app/client
COPY client/package*.json ./
RUN npm install
COPY client/ .
RUN npm run build

# Copy client build to server public
RUN cp -r dist/* /app/server/src/public/app/ 2>/dev/null || true

EXPOSE 10000

WORKDIR /app/server

CMD ["node", "dist/src/index.js"]
