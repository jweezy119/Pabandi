# Use Debian-based Node image so Prisma engine/OpenSSL work reliably
FROM node:18-slim AS builder

WORKDIR /app

# Install build tools and OpenSSL libraries required by Prisma
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    ca-certificates \
    python3 \
    make \
    g++ \
    git \
    && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci

# Copy the rest of the source code
COPY . .

# Generate Prisma Client and build TypeScript
RUN npx prisma generate
RUN npm run build

# --- Production Image ---
FROM node:18-slim

WORKDIR /app

# Runtime dependencies for Prisma engine
RUN apt-get update && apt-get install -y --no-install-recommends \
    openssl \
    ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy built artifacts and dependencies
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# Expose the API port
EXPOSE 8080

# Set production environment
ENV NODE_ENV=production

# Start the server (includes Prisma migration before start)
CMD ["sh", "-c", "npx prisma migrate deploy || npx prisma db push --accept-data-loss && node dist/src/index.js"]
