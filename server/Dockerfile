# Stage 1: Build
FROM node:18-bullseye-slim AS builder

WORKDIR /usr/src/app

# Install native dependencies required for bcrypt, prisma, and tensorflow
RUN apt-get update && apt-get install -y python3 make g++ openssl && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma/

# Install ALL dependencies (including devDependencies for build)
RUN npm install

# Copy source and build
COPY . .
RUN npx prisma generate
RUN npm run build

# Stage 2: Production
FROM node:18-bullseye-slim

# Install OpenSSL (required by Prisma) and other runtime libs if needed
RUN apt-get update && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app

COPY package*.json ./
COPY prisma ./prisma/

# Copy built files and all compiled node_modules from builder
# This guarantees native modules (bcrypt, tensorflow) and Prisma client work perfectly
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/node_modules ./node_modules

# Cloud Run will set PORT=8080 automatically
ENV NODE_ENV production
EXPOSE 8080

CMD ["node", "dist/index.js"]
