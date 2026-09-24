FROM node:22-slim

ARG CACHE_BUST=12
RUN echo "Build: $(date +%s)" > /build-date.txt && cat /build-date.txt

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production

# Copy server package files
COPY server/package*.json ./server/
WORKDIR /app/server
RUN npm install --include=dev

# Copy server source (includes schema.prisma)
COPY server/ .

# Generate Prisma client at BUILD time with dummy DATABASE_URL
# (the schema must be present for this to work)
ENV DATABASE_URL="postgresql://dummy:dummy@localhost:5432/dummy"
RUN npx prisma generate

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

# Clean orphaned data, apply migrations, push schema, then start with tsx
CMD ["sh", "-c", "rm -rf dist && echo 'Applying scoped trust score migration...' && cat prisma/migrations/20260924_add_scoped_trust_scores_and_invoice_events/migration.sql | npx prisma db execute --stdin && echo 'Migration applied' && echo 'Cleaning orphaned AgentFeedback records...' && echo 'DELETE FROM \"AgentFeedback\" WHERE \"bookingId\" NOT IN (SELECT \"id\" FROM \"AgentBooking\");' | npx prisma db execute --stdin || true && echo 'Pushing Prisma schema to database...' && npx prisma db push --accept-data-loss && echo 'Schema push complete, starting server...' && npx tsx src/index.ts"]
