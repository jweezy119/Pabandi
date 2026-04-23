# Stage 1: Build
FROM node:18-bullseye-slim AS builder

WORKDIR /usr/src/app

# Install native dependencies required for bcrypt and tensorflow
RUN apt-get update && apt-get install -y python3 make g++ && rm -rf /var/lib/apt/lists/*

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

WORKDIR /usr/src/app

# Install only production dependencies
COPY package*.json ./
COPY prisma ./prisma/
RUN npm install --omit=dev

# Copy built files from builder
COPY --from=builder /usr/src/app/dist ./dist
COPY --from=builder /usr/src/app/node_modules/.prisma ./node_modules/.prisma

# Run the web service on container startup.
ENV PORT 8080
ENV NODE_ENV production
EXPOSE 8080

CMD [ "npm", "start" ]

