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

# Start server immediately (for port scan), then run db push in background
CMD ["sh", "-c", "npx prisma db push --skip-generate --accept-data-loss 2>&1 & sleep 5 && exec node --max-old-space-size=384 dist/src/index.js"]
