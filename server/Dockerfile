FROM node:20-slim

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

COPY . .

# Bust cache to ensure fresh prisma generate
RUN echo "cache-bust-$(date +%s)" > /tmp/cache-bust

# Generate Prisma client and build
RUN npx prisma generate && npm run build

# Start server with memory limit
CMD ["sh", "-c", "exec node --max-old-space-size=384 dist/src/index.js"]
