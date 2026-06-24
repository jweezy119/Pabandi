# Use Node.js Alpine for a lightweight footprint
FROM node:18-alpine AS builder

WORKDIR /app

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
FROM node:18-alpine

WORKDIR /app

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
CMD ["sh", "-c", "npx prisma migrate deploy || true && node dist/index.js"]
