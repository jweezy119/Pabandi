FROM node:20-slim

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

COPY . .

# Generate Prisma client
RUN npx prisma generate

# Fix failed migration history, then deploy all migrations
RUN npx prisma migrate resolve --rolled-back 20260901_property_financials 2>/dev/null; npx prisma migrate deploy

# Start server
CMD ["sh", "-c", "exec node --max-old-space-size=384 dist/src/index.js"]
