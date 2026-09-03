FROM node:20-slim

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

COPY . .

# Generate Prisma client (no migrate — env vars not available during build)
RUN npx prisma generate

# Build the project
RUN npm run build

# Run migrations + start server with limited memory
CMD ["sh", "-c", "npx prisma migrate deploy && exec node --max-old-space-size=384 dist/src/index.js"]
