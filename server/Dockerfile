FROM node:20-slim

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

COPY . .

# Generate Prisma client (matches schema)
RUN npx prisma generate

# Run with ts-node --transpile-only (no build step, no dist/ caching)
CMD ["sh", "-c", "exec npx ts-node --transpile-only src/index.ts"]
