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

# Run database schema push on startup (forces schema to match Prisma schema)
CMD ["sh", "-c", "echo 'Pushing Prisma schema to database...' && npx prisma db push --accept-data-loss && echo 'Schema push complete, starting server...' && node dist/src/index.js"]
