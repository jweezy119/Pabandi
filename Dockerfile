FROM node:22-slim

ARG CACHE_BUST=5
RUN echo "Cache bust: $CACHE_BUST" && date > /build-date.txt

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production

# Copy server package files
COPY server/package*.json ./server/
WORKDIR /app/server
RUN npm install --include=dev

# Copy server source
COPY server/ .

# Build TypeScript
RUN rm -rf dist .tsbuildinfo && npm run build

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

# Clean orphaned data and push schema on startup
CMD ["sh", "-c", "echo 'Cleaning orphaned AgentFeedback records...' && (echo 'DELETE FROM \"AgentFeedback\" WHERE \"bookingId\" NOT IN (SELECT \"id\" FROM \"AgentBooking\");' | npx prisma db execute --stdin || true) && echo 'Pushing Prisma schema to database...' && npx prisma db push --accept-data-loss && echo 'Schema push complete, starting server...' && node dist/src/index.js"]
