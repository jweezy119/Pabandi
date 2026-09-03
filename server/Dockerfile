FROM node:20-slim

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build the project
RUN npm run build

# Start: resolve failed migrations, apply pending ones, then start server
CMD ["sh", "-c", "npx prisma migrate resolve --rolled-back 20260901_property_financials 2>/dev/null; npx prisma migrate resolve --applied 20260901_property_financials 2>/dev/null; npx prisma migrate deploy && exec node --max-old-space-size=384 dist/src/index.js"]
