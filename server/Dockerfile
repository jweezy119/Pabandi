FROM node:20-slim

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

COPY . .

# Force clean: remove any cached build artifacts
RUN rm -rf dist .tsbuildinfo node_modules/.prisma node_modules/.cache

# Generate Prisma client and build
RUN npx prisma generate && npm run build

# Start server
CMD ["sh", "-c", "exec node --max-old-space-size=384 dist/src/index.js"]
