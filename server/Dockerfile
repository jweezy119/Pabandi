FROM node:20-slim

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

COPY . .

# Generate Prisma client only (no build, no migrate — migrate runs at runtime)
RUN npx prisma generate

# Start: migrate then run with ts-node (avoids memory-huge dist/ folder)
CMD ["sh", "-c", "npx prisma migrate deploy && exec npx ts-node src/index.ts"]
