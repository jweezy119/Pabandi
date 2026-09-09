FROM node:22-slim

ARG CACHE_BUST=1
RUN echo "Cache bust: $CACHE_BUST"

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=development

COPY package*.json ./
RUN npm install --include=dev

COPY . .

# Force Prisma client regeneration from the correct schema
RUN rm -rf node_modules/.prisma && npm run build

# Clean orphaned rows that block FK creation, then push schema on startup
# (|| true: cleanup is best-effort — a missing table must not kill startup)
CMD ["sh", "-c", "echo 'Cleaning orphaned AgentFeedback records...' && (npx prisma db execute --stdin <<<'DELETE FROM \"AgentFeedback\" WHERE \"bookingId\" NOT IN (SELECT \"id\" FROM \"AgentBooking\");' || true) && echo 'Pushing Prisma schema to database...' && npx prisma db push --accept-data-loss && echo 'Schema push complete, starting server...' && node dist/src/index.js"]
