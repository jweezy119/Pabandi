FROM node:20-slim

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm install

COPY . .

# Generate Prisma client
RUN npx prisma generate

# Run directly with ts-node (avoids stale dist/ cache)
CMD ["sh", "-c", "exec npx ts-node src/index.ts"]
